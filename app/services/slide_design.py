"""Slide visuals and PowerPoint layout: themed backgrounds, framed photos, and the .pptx builder."""

import io
from dataclasses import dataclass

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageOps

SLIDE_W_IN, SLIDE_H_IN = 13.333, 7.5
PIXEL_W, PIXEL_H = 1920, 1080
PHOTO_DPI = 150
CORNER_RADIUS_IN = 0.18

# (top colour, bottom colour, accent colour) per deck theme; each slide rotates through them.
PALETTES: tuple[tuple[tuple[int, int, int], tuple[int, int, int], tuple[int, int, int]], ...] = (
    ((12, 18, 38), (30, 58, 138), (99, 102, 241)),
    ((8, 28, 36), (15, 93, 92), (45, 212, 191)),
    ((28, 14, 40), (88, 28, 135), (192, 132, 252)),
    ((30, 16, 12), (146, 64, 14), (251, 146, 60)),
)

# Photo frame (left, top, width, height) in inches for each content layout.
LAYOUT_PHOTO: dict[str, tuple[float, float, float, float]] = {
    "split_right": (7.2, 0.9, 5.4, 5.7),
    "split_left": (0.7, 0.9, 5.4, 5.7),
    "hero": (0.7, 0.5, 11.93, 3.3),
}

CONTENT_LAYOUTS = ("split_right", "split_left", "hero")


@dataclass
class RenderedSlide:
    kind: str  # "cover" or "content"
    layout: str  # "cover", "split_right", "split_left", "hero", or "text"
    title: str
    bullets: list[str]
    speaker_notes: str | None
    background: bytes  # JPEG, full slide
    photo: bytes | None  # PNG with rounded corners, sized for its layout
    accent: tuple[int, int, int]


def palette_for(index: int) -> tuple[tuple[int, int, int], tuple[int, int, int], tuple[int, int, int]]:
    return PALETTES[index % len(PALETTES)]


def layout_for(content_index: int) -> str:
    """Rotate layouts so consecutive slides do not look the same."""
    return CONTENT_LAYOUTS[content_index % len(CONTENT_LAYOUTS)]


def _jpeg(img: Image.Image) -> bytes:
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=88, optimize=True)
    return buf.getvalue()


def _cover_fit(raw: bytes, size: tuple[int, int]) -> Image.Image:
    return ImageOps.fit(Image.open(io.BytesIO(raw)).convert("RGB"), size, Image.Resampling.LANCZOS)


def background_jpeg(index: int) -> bytes:
    """Smooth themed gradient with a soft glow in one corner."""
    top, bot, accent = palette_for(index)
    img = Image.new("RGB", (PIXEL_W, PIXEL_H), top)
    draw = ImageDraw.Draw(img)
    for y in range(PIXEL_H):
        t = y / (PIXEL_H - 1)
        draw.line(
            [(0, y), (PIXEL_W, y)],
            fill=tuple(int(top[c] + (bot[c] - top[c]) * t) for c in range(3)),
        )

    glow = Image.new("RGB", (PIXEL_W, PIXEL_H), (0, 0, 0))
    cx, cy = int(PIXEL_W * 0.85), int(PIXEL_H * 0.15)
    ImageDraw.Draw(glow).ellipse((cx - 420, cy - 420, cx + 420, cy + 420), fill=accent)
    glow = glow.filter(ImageFilter.GaussianBlur(180)).point(lambda v: int(v * 0.4))
    return _jpeg(ImageChops.add(img, glow))


def cover_jpeg(raw: bytes | None, index: int) -> bytes:
    """Full-bleed cover photo, darkened toward the bottom so the title reads clearly."""
    if raw is None:
        return background_jpeg(index)
    img = _cover_fit(raw, (PIXEL_W, PIXEL_H))
    overlay = Image.new("RGB", (PIXEL_W, PIXEL_H), (6, 8, 18))
    mask = Image.linear_gradient("L").resize((PIXEL_W, PIXEL_H)).point(lambda v: int(40 + v * 0.6))
    return _jpeg(Image.composite(overlay, img, mask))


def photo_png(raw: bytes, layout: str) -> bytes:
    """Crop a photo to its layout frame and round the corners (PNG keeps transparency)."""
    _, _, width_in, height_in = LAYOUT_PHOTO[layout]
    w, h = round(width_in * PHOTO_DPI), round(height_in * PHOTO_DPI)
    img = _cover_fit(raw, (w, h)).convert("RGBA")
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, w - 1, h - 1), radius=round(CORNER_RADIUS_IN * PHOTO_DPI), fill=255)
    img.putalpha(mask)
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def build_pptx_bytes(*, deck_title: str, slides: list[RenderedSlide]) -> bytes:
    from pptx import Presentation
    from pptx.dml.color import RGBColor
    from pptx.enum.shapes import MSO_SHAPE
    from pptx.util import Inches, Pt

    prs = Presentation()
    prs.slide_width = Inches(SLIDE_W_IN)
    prs.slide_height = Inches(SLIDE_H_IN)
    try:
        prs.core_properties.title = deck_title[:200]
    except Exception:
        pass
    blank = prs.slide_layouts[6]

    def rgb(c: tuple[int, int, int]) -> RGBColor:
        return RGBColor(*c)

    def text_box(slide, left, top, width, height, lines, *, size, bold=False, color=(248, 250, 252), bullets=False):
        box = slide.shapes.add_textbox(Inches(left), Inches(top), Inches(width), Inches(height))
        tf = box.text_frame
        tf.word_wrap = True
        for i, line in enumerate(lines):
            p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
            p.text = f"•  {line}" if bullets else line
            p.font.size = Pt(size)
            p.font.bold = bold
            p.font.color.rgb = rgb(color)
            p.space_after = Pt(10 if bullets else 0)
            p.line_spacing = 1.1
        return box

    for s in slides:
        slide = prs.slides.add_slide(blank)
        slide.shapes.add_picture(io.BytesIO(s.background), 0, 0, width=prs.slide_width, height=prs.slide_height)

        if s.kind == "cover":
            bar = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.9), Inches(3.3), Inches(1.1), Inches(0.08))
            bar.fill.solid()
            bar.fill.fore_color.rgb = rgb(s.accent)
            bar.line.fill.background()
            text_box(slide, 0.9, 3.5, 11.5, 1.7, [s.title], size=46, bold=True)
            subtitle = s.bullets[0] if s.bullets else ""
            text_box(slide, 0.9, 5.3, 11.0, 0.9, [subtitle], size=20, color=(210, 220, 235))
            text_box(slide, 0.9, 6.8, 6.0, 0.4, ["ClassroomAI"], size=11, color=(170, 180, 200))
        else:
            if s.photo is not None:
                left, top, width, height = LAYOUT_PHOTO[s.layout]
                slide.shapes.add_picture(io.BytesIO(s.photo), Inches(left), Inches(top), Inches(width), Inches(height))

            if s.layout == "split_right":
                title_box, body_box = (0.8, 0.8, 6.1, 1.3), (0.8, 2.3, 6.1, 4.5)
            elif s.layout == "split_left":
                title_box, body_box = (6.6, 0.8, 6.0, 1.3), (6.6, 2.3, 6.0, 4.5)
            elif s.layout == "hero":
                title_box, body_box = (0.7, 4.0, 11.9, 0.9), (0.7, 5.0, 11.9, 2.2)
            else:  # text-only
                title_box, body_box = (0.8, 0.8, 11.7, 1.3), (0.8, 2.3, 11.7, 4.6)

            title_size = 30 if s.layout == "hero" else 34
            body_size = 17 if s.layout == "hero" else 20
            text_box(slide, *title_box, [s.title], size=title_size, bold=True)
            text_box(slide, *body_box, s.bullets[:8], size=body_size, color=(214, 222, 235), bullets=True)

        if s.speaker_notes:
            slide.notes_slide.notes_text_frame.text = s.speaker_notes[:4500]

    buf = io.BytesIO()
    prs.save(buf)
    return buf.getvalue()
