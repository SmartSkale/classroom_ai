import anyio
from fastapi import APIRouter
from sqlalchemy.orm import Session

from app.core.deps import CurrentUser, DbSession
from app.models.groups import GroupAssignment, GroupMember, TeacherGroup
from app.models.quiz_attempt import QuizAttempt
from app.schemas.groups import StudentAssignmentResponse

router = APIRouter()


def _latest_quiz_by_project(db: Session, student_id: int, project_ids: list[str]) -> dict[str, QuizAttempt]:
    if not project_ids:
        return {}
    attempts = (
        db.query(QuizAttempt)
        .filter(QuizAttempt.student_id == student_id, QuizAttempt.project_id.in_(project_ids))
        .order_by(QuizAttempt.submitted_at.desc())
        .all()
    )
    latest: dict[str, QuizAttempt] = {}
    for attempt in attempts:
        if attempt.project_id not in latest:
            latest[attempt.project_id] = attempt
    return latest


def _list_student_assignments(db: Session, user_id: int, email: str) -> list[StudentAssignmentResponse]:
    normalized_email = email.lower()
    memberships = (
        db.query(GroupMember)
        .filter((GroupMember.user_id == user_id) | (GroupMember.email == normalized_email))
        .all()
    )
    if not memberships:
        return []

    group_ids = {m.group_id for m in memberships}
    groups = db.query(TeacherGroup).filter(TeacherGroup.id.in_(group_ids)).all()
    group_names = {g.id: g.name for g in groups}

    rows = (
        db.query(GroupAssignment)
        .filter(GroupAssignment.group_id.in_(group_ids))
        .order_by(GroupAssignment.assigned_at.desc())
        .all()
    )

    seen: set[str] = set()
    unique_rows: list[GroupAssignment] = []
    for row in rows:
        if row.project_id in seen:
            continue
        seen.add(row.project_id)
        unique_rows.append(row)

    quiz_map = _latest_quiz_by_project(db, user_id, [r.project_id for r in unique_rows])

    results: list[StudentAssignmentResponse] = []
    for row in unique_rows:
        attempt = quiz_map.get(row.project_id)
        results.append(
            StudentAssignmentResponse(
                assignment_id=row.id,
                group_id=row.group_id,
                group_name=group_names.get(row.group_id, "Class group"),
                project_id=row.project_id,
                title=row.title,
                outputs=row.outputs or [],
                assigned_at=row.assigned_at,
                content_snapshot=row.content_snapshot,
                last_quiz_percent=attempt.percent if attempt else None,
                last_quiz_passed=attempt.passed if attempt else None,
            )
        )
    return results


@router.get("", response_model=list[StudentAssignmentResponse])
async def list_my_assignments(db: DbSession, current_user: CurrentUser) -> list[StudentAssignmentResponse]:
    return await anyio.to_thread.run_sync(
        lambda: _list_student_assignments(db, current_user.id, current_user.email)
    )
