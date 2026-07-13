import anyio
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import CurrentUser, DbSession, require_roles
from app.models.groups import GroupMember, TeacherGroup
from app.models.quiz_attempt import QuizAttempt
from app.models.user import User, UserRole
from app.schemas.quiz_attempts import (
    GroupQuizResultItem,
    QuizAttemptSubmit,
    QuizResultResponse,
)
from app.services.quiz_scoring import (
    attempt_to_response,
    extract_quiz_from_snapshot,
    questions_from_input,
    score_quiz,
)
from app.services.student_assignments import find_student_assignment

router = APIRouter()

TEACHER_ROLES = (UserRole.teacher, UserRole.course_creator, UserRole.admin)


def _get_latest_attempt(db: Session, student_id: int, project_id: str) -> QuizAttempt | None:
    return (
        db.query(QuizAttempt)
        .filter(QuizAttempt.student_id == student_id, QuizAttempt.project_id == project_id)
        .order_by(QuizAttempt.submitted_at.desc())
        .first()
    )


def _submit_attempt(db: Session, user: User, body: QuizAttemptSubmit) -> QuizResultResponse:
    assignment = find_student_assignment(db, user.id, user.email, body.project_id)

    questions = extract_quiz_from_snapshot(assignment.content_snapshot if assignment else None)
    if not questions:
        questions = questions_from_input(body.questions)

    if not questions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Quiz questions not available for this lesson.",
        )

    if len(body.answers) < len(questions):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Answer every question before submitting.",
        )

    scored = score_quiz(questions, body.answers, body.time_taken_seconds)

    attempt = QuizAttempt(
        student_id=user.id,
        project_id=body.project_id,
        group_id=assignment.group_id if assignment else None,
        assignment_id=assignment.id if assignment else None,
        score=scored["score"],
        total=scored["total"],
        percent=scored["percent"],
        passed=scored["passed"],
        time_taken_seconds=scored["timeTakenSeconds"],
        answers=body.answers,
        result_items=scored["items"],
    )
    db.add(attempt)
    db.commit()
    db.refresh(attempt)
    return QuizResultResponse.model_validate(attempt_to_response(attempt))


@router.post("/submit", response_model=QuizResultResponse, status_code=status.HTTP_201_CREATED)
async def submit_quiz_attempt(
    body: QuizAttemptSubmit,
    db: DbSession,
    current_user: CurrentUser,
) -> QuizResultResponse:
    return await anyio.to_thread.run_sync(lambda: _submit_attempt(db, current_user, body))


@router.get(
    "/groups/{group_id}/projects/{project_id}",
    response_model=list[GroupQuizResultItem],
)
async def get_group_quiz_results(
    group_id: int,
    project_id: str,
    db: DbSession,
    current_user: User = Depends(require_roles(*TEACHER_ROLES)),
) -> list[GroupQuizResultItem]:
    def _list() -> list[GroupQuizResultItem]:
        group = db.query(TeacherGroup).filter(TeacherGroup.id == group_id).first()
        if not group:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")
        if group.teacher_id != current_user.id and current_user.role != UserRole.admin:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your group")

        members = db.query(GroupMember).filter(GroupMember.group_id == group_id).all()
        results: list[GroupQuizResultItem] = []

        for member in members:
            student_id = member.user_id
            student_email = member.email
            student_name = None

            if student_id:
                student = db.query(User).filter(User.id == student_id).first()
                if student:
                    student_name = student.full_name
                    student_email = student.email

            attempt = None
            if student_id:
                attempt = _get_latest_attempt(db, student_id, project_id)

            results.append(
                GroupQuizResultItem(
                    student_id=student_id,
                    student_email=student_email,
                    student_name=student_name,
                    percent=attempt.percent if attempt else None,
                    passed=attempt.passed if attempt else None,
                    submitted_at=attempt.submitted_at if attempt else None,
                )
            )

        return results

    return await anyio.to_thread.run_sync(_list)


@router.get("/{project_id}/history", response_model=list[QuizResultResponse])
async def get_quiz_history(
    project_id: str,
    db: DbSession,
    current_user: CurrentUser,
) -> list[QuizResultResponse]:
    def _list() -> list[QuizResultResponse]:
        attempts = (
            db.query(QuizAttempt)
            .filter(QuizAttempt.student_id == current_user.id, QuizAttempt.project_id == project_id)
            .order_by(QuizAttempt.submitted_at.desc())
            .all()
        )
        return [QuizResultResponse.model_validate(attempt_to_response(a)) for a in attempts]

    return await anyio.to_thread.run_sync(_list)


@router.get("/{project_id}", response_model=QuizResultResponse)
async def get_latest_quiz_result(
    project_id: str,
    db: DbSession,
    current_user: CurrentUser,
) -> QuizResultResponse:
    def _get() -> QuizResultResponse:
        attempt = _get_latest_attempt(db, current_user.id, project_id)
        if not attempt:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No quiz results found for this lesson.",
            )
        return QuizResultResponse.model_validate(attempt_to_response(attempt))

    return await anyio.to_thread.run_sync(_get)
