"""Local handwriting OCR via Tesseract (English)."""

from __future__ import annotations

import logging
import re

from PIL import Image, ImageEnhance, ImageFilter

logger = logging.getLogger(__name__)

_MIN_OCR_WIDTH = 1500
_HANDWRITING_OEM = 1


def tesseract_available() -> bool:
    """Return True when pytesseract and the Tesseract binary are available."""
    try:
        import pytesseract
    except ImportError:
        return False
    try:
        pytesseract.get_tesseract_version()
    except Exception:
        return False
    return True


def tesseract_ocr(
    pil_img: Image.Image,
    *,
    lang: str = "eng",
    config: str = "",
) -> str | None:
    """Run Tesseract OCR on a PIL image. Returns None when unavailable or on failure."""
    if not tesseract_available():
        return None
    import pytesseract

    try:
        return pytesseract.image_to_string(pil_img, lang=lang, config=config).strip()
    except Exception:
        if lang != "eng":
            try:
                return pytesseract.image_to_string(pil_img, lang="eng", config=config).strip()
            except Exception:
                return None
        return None


def preprocess_for_handwriting(img: Image.Image, *, min_width: int = _MIN_OCR_WIDTH) -> Image.Image:
    """Grayscale, upscale, sharpen, and boost contrast for scan/handwriting OCR."""
    if img.mode != "L":
        img = img.convert("L")

    w, h = img.size
    if w < min_width and w > 0:
        scale = min_width / w
        new_w = int(w * scale)
        new_h = int(h * scale)
        img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)

    img = img.filter(ImageFilter.SHARPEN)
    img = ImageEnhance.Contrast(img).enhance(1.4)
    return img


def _normalize_ocr_text(text: str) -> str:
    """Collapse excessive blank lines and trim."""
    collapsed = re.sub(r"\n{3,}", "\n\n", text.strip())
    return collapsed


def ocr_handwriting(pil_image: Image.Image) -> str:
    """
    Run Tesseract on a page image and return extracted text.
    Raises ValueError if Tesseract is unavailable or disabled via settings.
    """
    from app.core.config import get_settings

    settings = get_settings()
    if not settings.handwriting_ocr_enabled:
        raise ValueError(
            "Handwriting OCR is disabled. Set HANDWRITING_OCR_ENABLED=true in .env "
            "or use printed PDF mode."
        )

    if not tesseract_available():
        raise ValueError(
            "Tesseract is not installed. Install the system binary "
            "(e.g. brew install tesseract on macOS, apt install tesseract-ocr on Linux) "
            "and ensure pytesseract is installed (pip install pytesseract)."
        )

    prepared = preprocess_for_handwriting(pil_image)
    psm = settings.handwriting_ocr_tesseract_psm
    config = f"--oem {_HANDWRITING_OEM} --psm {psm}"
    text = tesseract_ocr(prepared, lang="eng", config=config)
    if not text:
        return ""
    return _normalize_ocr_text(text)
