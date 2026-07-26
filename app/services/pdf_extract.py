"""
Extract text from PDFs page-by-page: native text, tables (pdfplumber),
optional OCR (Tesseract), and handwriting OCR (EasyOCR).
"""

from __future__ import annotations

import io
import re
from dataclasses import dataclass, field
from typing import Literal

import fitz  # PyMuPDF
import pdfplumber

from app.core.config import get_settings
from app.services.handwriting_ocr import ocr_handwriting

_MAX_PAGES = 100
_MAX_OUTPUT_CHARS = 120_000
_MIN_IMAGE_SIDE = 40
_MAX_IMAGE_PIXELS = 2_500_000

DocumentType = Literal["auto", "printed", "handwritten"]

_ENGLISH_WORD_RE = re.compile(r"[a-zA-Z]{3,}")


@dataclass
class PdfExtractResult:
    chapter_text: str
    notes: str
    page_count: int
    table_count: int
    ocr_page_runs: int = 0
    ocr_image_runs: int = 0
    handwriting_ocr_page_runs: int = 0
    warnings: list[str] = field(default_factory=list)


def _truncate(s: str, limit: int) -> tuple[str, bool]:
    s = s.strip()
    if len(s) <= limit:
        return s, False
    return s[: limit - 20].rsplit("\n", 1)[0] + "\n\n[…truncated for model context…]", True


def _format_table(table: list[list[str | None]]) -> str:
    if not table:
        return ""
    rows: list[str] = []
    for row in table:
        cells = [re.sub(r"\s+", " ", str(c or "").strip()) for c in row]
        rows.append(" | ".join(cells))
    return "\n".join(rows)


def count_english_words(text: str) -> int:
    """Count English words (3+ letters) in extracted page text."""
    return len(_ENGLISH_WORD_RE.findall(text))


def needs_handwriting_ocr(page_text: str, *, min_words: int) -> bool:
    """True when page text is too sparse for reliable downstream generation."""
    stripped = page_text.strip()
    if not stripped:
        return True
    words = count_english_words(stripped)
    if words < min_words:
        return True
    # Very low alphanumeric ratio often indicates garbage OCR / metadata
    alnum = sum(1 for c in stripped if c.isalnum())
    if len(stripped) > 40 and alnum / len(stripped) < 0.35:
        return True
    return False


def pdf_looks_printed(pdf_bytes: bytes, *, min_words: int | None = None) -> bool:
    """True when most pages have enough native text to be printed/typed PDFs."""
    if not pdf_bytes or len(pdf_bytes) < 8 or not pdf_bytes[:5].startswith(b"%PDF"):
        return False

    if min_words is None:
        min_words = get_settings().handwriting_ocr_min_words_per_page

    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    try:
        n_pages = len(doc)
        if n_pages == 0:
            return False
        effective_pages = min(n_pages, _MAX_PAGES)
        printed_like_pages = 0
        for i in range(effective_pages):
            native = (doc[i].get_text("text") or "").strip()
            if not needs_handwriting_ocr(native, min_words=min_words):
                printed_like_pages += 1
        return printed_like_pages > 0 and printed_like_pages >= effective_pages / 2
    finally:
        doc.close()


def pdf_looks_handwritten(pdf_bytes: bytes, *, min_words: int | None = None) -> bool:
    """True when most pages lack enough native text for printed/typed extraction."""
    if not pdf_bytes or len(pdf_bytes) < 8 or not pdf_bytes[:5].startswith(b"%PDF"):
        return False

    if min_words is None:
        min_words = get_settings().handwriting_ocr_min_words_per_page

    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    try:
        n_pages = len(doc)
        if n_pages == 0:
            return False
        effective_pages = min(n_pages, _MAX_PAGES)
        handwritten_like_pages = 0
        for i in range(effective_pages):
            native = (doc[i].get_text("text") or "").strip()
            if needs_handwriting_ocr(native, min_words=min_words):
                handwritten_like_pages += 1
        return handwritten_like_pages > 0 and handwritten_like_pages >= effective_pages / 2
    finally:
        doc.close()


_PRINTED_PDF_HANDWRITTEN_MODE_ERROR = (
    'This PDF looks like a printed or typed document. '
    'Select "Printed / typed PDF" on the upload page.'
)
_HANDWRITTEN_PDF_PRINTED_MODE_ERROR = (
    'This PDF looks like handwritten notes or a scan. '
    'Select "Handwritten notes (scanned or photo PDF)" on the upload page.'
)


def _ocr_image(pil_img) -> str | None:
    try:
        import pytesseract
    except ImportError:
        return None
    try:
        pytesseract.get_tesseract_version()
    except Exception:
        return None
    try:
        return pytesseract.image_to_string(pil_img, lang="eng+hin").strip()
    except Exception:
        try:
            return pytesseract.image_to_string(pil_img, lang="eng").strip()
        except Exception:
            return None


def _ocr_from_pixmap(pix: fitz.Pixmap) -> str | None:
    from PIL import Image

    try:
        img = Image.open(io.BytesIO(pix.tobytes("png")))
        if img.mode != "RGB":
            img = img.convert("RGB")
        return _ocr_image(img)
    except Exception:
        return None


def _page_to_pil(page: fitz.Page, scale: float):
    from PIL import Image

    mat = fitz.Matrix(scale, scale)
    pix = page.get_pixmap(matrix=mat, alpha=False)
    img = Image.open(io.BytesIO(pix.tobytes("png")))
    if img.mode != "RGB":
        img = img.convert("RGB")
    return img


def _handwriting_ocr_page(page: fitz.Page, scale: float) -> str:
    img = _page_to_pil(page, scale)
    return ocr_handwriting(img).strip()


def extract_pdf_to_text(
    pdf_bytes: bytes,
    *,
    ocr_pages: bool = True,
    ocr_images: bool = True,
    document_type: DocumentType = "auto",
) -> PdfExtractResult:
    if not pdf_bytes or len(pdf_bytes) < 8 or not pdf_bytes[:5].startswith(b"%PDF"):
        raise ValueError("Invalid or empty PDF file.")

    settings = get_settings()
    min_words = settings.handwriting_ocr_min_words_per_page
    hw_scale = settings.handwriting_ocr_render_scale
    use_handwriting = document_type == "handwritten"
    auto_handwriting = document_type == "auto" and settings.handwriting_ocr_enabled
    printed_only = document_type == "printed"

    if use_handwriting and pdf_looks_printed(pdf_bytes, min_words=min_words):
        raise ValueError(_PRINTED_PDF_HANDWRITTEN_MODE_ERROR)

    if printed_only and pdf_looks_handwritten(pdf_bytes, min_words=min_words):
        raise ValueError(_HANDWRITTEN_PDF_PRINTED_MODE_ERROR)

    warnings: list[str] = []
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    n_pages = len(doc)
    if n_pages == 0:
        doc.close()
        raise ValueError("PDF has no pages.")
    if n_pages > _MAX_PAGES:
        warnings.append(f"Only first {_MAX_PAGES} of {n_pages} pages were processed.")
    effective_pages = min(n_pages, _MAX_PAGES)

    ocr_page_runs = 0
    ocr_image_runs = 0
    handwriting_ocr_page_runs = 0
    table_count = 0
    parts: list[str] = []

    plumber = pdfplumber.open(io.BytesIO(pdf_bytes))
    try:
        for i in range(effective_pages):
            page = doc[i]
            page_num = i + 1
            block_lines: list[str] = []

            if use_handwriting:
                try:
                    hw_text = _handwriting_ocr_page(page, hw_scale)
                    if hw_text:
                        handwriting_ocr_page_runs += 1
                        block_lines.append(
                            f"\n[Page {page_num} — handwriting OCR]\n{hw_text}\n"
                        )
                except ValueError as exc:
                    warnings.append(f"Handwriting OCR failed on page {page_num}: {exc}")
                except Exception:
                    warnings.append(f"Handwriting OCR failed on page {page_num}.")

                page_body = "\n".join(block_lines).strip()
                if page_body:
                    parts.append(f"=== Page {page_num} ===\n{page_body}")
                continue

            native = (page.get_text("text") or "").strip()
            if native:
                block_lines.append(native)

            try:
                p_page = plumber.pages[i]
                tables = p_page.extract_tables() or []
                for ti, table in enumerate(tables):
                    if not table:
                        continue
                    formatted = _format_table(table)
                    if formatted.strip():
                        table_count += 1
                        block_lines.append(f"\n[Table {ti + 1} on page {page_num}]\n{formatted}\n")
            except Exception:
                warnings.append(f"Table extraction skipped on page {page_num}.")

            if ocr_images and not printed_only:
                try:
                    from PIL import Image

                    for img in page.get_images(full=True):
                        xref = img[0]
                        try:
                            base = doc.extract_image(xref)
                        except Exception:
                            continue
                        w, h = int(base.get("width", 0)), int(base.get("height", 0))
                        if w < _MIN_IMAGE_SIDE or h < _MIN_IMAGE_SIDE:
                            continue
                        if w * h > _MAX_IMAGE_PIXELS:
                            continue
                        try:
                            pil_img = Image.open(io.BytesIO(base["image"]))
                            if pil_img.mode not in ("RGB", "L"):
                                pil_img = pil_img.convert("RGB")
                        except Exception:
                            continue
                        ocr_t = _ocr_image(pil_img)
                        if ocr_t and len(ocr_t) > 15:
                            ocr_image_runs += 1
                            block_lines.append(
                                f"\n[Text from image on page {page_num}]\n{ocr_t}\n"
                            )
                except Exception:
                    pass

            if ocr_pages:
                page_so_far = "\n".join(block_lines).strip()
                sparse = len(re.sub(r"\s+", "", native)) < 80
                tesseract_text = ""
                if sparse or not native:
                    try:
                        mat = fitz.Matrix(1.8, 1.8)
                        pix = page.get_pixmap(matrix=mat, alpha=False)
                        tesseract_text = (_ocr_from_pixmap(pix) or "").strip()
                        if tesseract_text and len(tesseract_text) > 20:
                            ocr_page_runs += 1
                            block_lines.append(
                                f"\n[Page {page_num} — OCR from page image]\n{tesseract_text}\n"
                            )
                    except Exception:
                        pass

                page_body_candidate = "\n".join(block_lines).strip()
                if auto_handwriting and needs_handwriting_ocr(
                    page_body_candidate, min_words=min_words
                ):
                    try:
                        hw_text = _handwriting_ocr_page(page, hw_scale)
                        if hw_text:
                            handwriting_ocr_page_runs += 1
                            block_lines = [
                                f"\n[Page {page_num} — handwriting OCR]\n{hw_text}\n"
                            ]
                        elif not page_body_candidate:
                            warnings.append(
                                f"Handwriting OCR returned no text on page {page_num}."
                            )
                    except ValueError as exc:
                        warnings.append(str(exc))
                    except Exception:
                        warnings.append(f"Handwriting OCR failed on page {page_num}.")

            page_body = "\n".join(block_lines).strip()
            if page_body:
                parts.append(f"=== Page {page_num} ===\n{page_body}")
    finally:
        plumber.close()

    doc.close()

    merged = "\n\n".join(parts).strip()
    if not merged:
        if use_handwriting or auto_handwriting:
            raise ValueError(
                "No text could be extracted from this handwritten PDF. "
                "Ensure EasyOCR is installed (pip install easyocr) and HANDWRITING_OCR_ENABLED=true."
            )
        raise ValueError("No text could be extracted from this PDF. Try OCR with Tesseract installed.")

    truncated, was_trunc = _truncate(merged, _MAX_OUTPUT_CHARS)
    if was_trunc:
        warnings.append(f"Extracted content truncated to {_MAX_OUTPUT_CHARS} characters.")

    ocr_note: list[str] = []
    if handwriting_ocr_page_runs:
        ocr_note.append(f"Handwriting OCR: {handwriting_ocr_page_runs} page(s).")
    if ocr_page_runs or ocr_image_runs:
        ocr_note.append(f"Tesseract OCR: {ocr_page_runs} page(s), {ocr_image_runs} embedded image(s).")
    elif not handwriting_ocr_page_runs and (ocr_pages or ocr_images) and not use_handwriting:
        ocr_note.append(
            "Tesseract OCR did not add text (install Tesseract + pytesseract for scanned printed pages)."
        )

    notes = (
        f"PDF: {effective_pages} page(s), {table_count} table(s), mode={document_type}. "
        + " ".join(ocr_note + warnings[:3])
    ).strip()

    return PdfExtractResult(
        chapter_text=truncated,
        notes=notes,
        page_count=effective_pages,
        table_count=table_count,
        ocr_page_runs=ocr_page_runs,
        ocr_image_runs=ocr_image_runs,
        handwriting_ocr_page_runs=handwriting_ocr_page_runs,
        warnings=warnings,
    )
