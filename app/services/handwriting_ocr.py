"""Local handwriting OCR via EasyOCR (English)."""

from __future__ import annotations

import logging
import threading
from typing import Any

from PIL import Image, ImageEnhance, ImageFilter

logger = logging.getLogger(__name__)

_reader: object | None = None
_reader_lock = threading.Lock()

_MIN_OCR_WIDTH = 1500


def _get_reader() -> Any:
    """Lazy singleton EasyOCR reader (downloads models on first use)."""
    global _reader
    if _reader is not None:
        return _reader

    with _reader_lock:
        if _reader is not None:
            return _reader
        try:
            import easyocr
        except ImportError as exc:
            raise ValueError(
                "EasyOCR is not installed. Run: pip install easyocr>=1.7.0 "
                "(first run downloads ~100–200 MB of English models)."
            ) from exc
        logger.info("Initializing EasyOCR reader (English); first run may download models.")
        _reader = easyocr.Reader(["en"], gpu=False, verbose=False)
        return _reader


def reset_reader_for_tests() -> None:
    """Clear the cached reader (tests only)."""
    global _reader
    with _reader_lock:
        _reader = None


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


def ocr_handwriting(pil_image: Image.Image) -> str:
    """
    Run EasyOCR on a page image and return joined text lines (top-to-bottom).
    Raises ValueError if EasyOCR is unavailable or disabled via settings.
    """
    from app.core.config import get_settings

    settings = get_settings()
    if not settings.handwriting_ocr_enabled:
        raise ValueError(
            "Handwriting OCR is disabled. Set HANDWRITING_OCR_ENABLED=true in .env "
            "or use printed PDF mode."
        )

    reader = _get_reader()
    prepared = preprocess_for_handwriting(pil_image)
    import numpy as np

    arr = np.array(prepared)
    results = reader.readtext(arr, detail=1, paragraph=False)
    if not results:
        return ""

    # Sort by vertical position (top of bounding box), then left
    results.sort(key=lambda r: (r[0][0][1], r[0][0][0]))
    lines = [str(text).strip() for _box, text, _conf in results if str(text).strip()]
    return "\n".join(lines)
