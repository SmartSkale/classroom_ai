import io
import re

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

from app.schemas.quiz import QuizGenerateResponse

COLUMNS = ["question", "option1", "option2", "option3", "option4", "correct_answer", "reasoning", "difficulty_level"]
_WIDTHS = {
    "question": 60,
    "option1": 30,
    "option2": 30,
    "option3": 30,
    "option4": 30,
    "correct_answer": 30,
    "reasoning": 70,
    "difficulty_level": 18,
}
_DIFFICULTY_LABELS = {"easy": "Easy", "medium": "Medium", "hard": "Hard"}


def _safe_filename(topic: str) -> str:
    s = re.sub(r"[^\w\- ]+", "", topic).strip()
    s = re.sub(r"\s+", "_", s)[:60]
    return f"{s or 'classroomai'}_quiz.xlsx"


def build_quiz_xlsx(quiz: QuizGenerateResponse) -> tuple[bytes, str]:
    """One row per question: question, four options, correct answer text, reasoning, and difficulty level."""
    wb = Workbook()
    ws = wb.active
    ws.title = "Quiz"

    header_fill = PatternFill("solid", fgColor="1E1B4B")
    header_font = Font(bold=True, color="FFFFFF")
    wrap = Alignment(wrap_text=True, vertical="top")

    ws.append(COLUMNS)
    for col_idx, name in enumerate(COLUMNS, start=1):
        cell = ws.cell(row=1, column=col_idx)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(vertical="center")
        ws.column_dimensions[get_column_letter(col_idx)].width = _WIDTHS[name]

    for q in quiz.questions:
        options = list(q.options[:4]) + [""] * (4 - len(q.options[:4]))
        correct = options[q.correct_option_index] if 0 <= q.correct_option_index < len(options) else ""
        level = _DIFFICULTY_LABELS.get(q.difficulty or "", "")
        ws.append([q.question, *options, correct, q.correct_explanation, level])

    for row in ws.iter_rows(min_row=2):
        for cell in row:
            cell.alignment = wrap

    ws.freeze_panes = "A2"
    ws.auto_filter.ref = ws.dimensions

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue(), _safe_filename(quiz.topic)
