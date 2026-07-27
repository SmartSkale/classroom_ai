"""
Extract text from PDFs page-by-page: native text and tables (pdfplumber).
"""

from __future__ import annotations

import io
import re
from dataclasses import dataclass, field

import fitz  # PyMuPDF
import pdfplumber

_MAX_PAGES = 100
_MAX_OUTPUT_CHARS = 120_000


@dataclass
class PdfExtractResult:
    chapter_text: str
    notes: str
    page_count: int
    table_count: int
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


def extract_pdf_to_text(pdf_bytes: bytes) -> PdfExtractResult:
    if not pdf_bytes or len(pdf_bytes) < 8 or not pdf_bytes[:5].startswith(b"%PDF"):
        raise ValueError("Invalid or empty PDF file.")

    warnings: list[str] = []
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    n_pages = len(doc)
    if n_pages == 0:
        doc.close()
        raise ValueError("PDF has no pages.")
    if n_pages > _MAX_PAGES:
        warnings.append(f"Only first {_MAX_PAGES} of {n_pages} pages were processed.")
    effective_pages = min(n_pages, _MAX_PAGES)

    table_count = 0
    parts: list[str] = []

    plumber = pdfplumber.open(io.BytesIO(pdf_bytes))
    try:
        for i in range(effective_pages):
            page = doc[i]
            page_num = i + 1
            block_lines: list[str] = []

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

            page_body = "\n".join(block_lines).strip()
            if page_body:
                parts.append(f"=== Page {page_num} ===\n{page_body}")
    finally:
        plumber.close()

    doc.close()

    merged = "\n\n".join(parts).strip()
    if not merged:
        raise ValueError(
            "No text could be extracted from this PDF. "
            "Use a PDF with selectable text, or paste the content as plain text."
        )

    truncated, was_trunc = _truncate(merged, _MAX_OUTPUT_CHARS)
    if was_trunc:
        warnings.append(f"Extracted content truncated to {_MAX_OUTPUT_CHARS} characters.")

    notes = (
        f"PDF: {effective_pages} page(s), {table_count} table(s). "
        + " ".join(warnings[:3])
    ).strip()

    return PdfExtractResult(
        chapter_text=truncated,
        notes=notes,
        page_count=effective_pages,
        table_count=table_count,
        warnings=warnings,
    )
