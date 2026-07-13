from sqlalchemy.orm import Session

from app.models.groups import GroupAssignment, GroupMember


def find_student_assignment(
    db: Session,
    user_id: int,
    email: str,
    project_id: str,
) -> GroupAssignment | None:
    normalized_email = email.lower()
    memberships = (
        db.query(GroupMember)
        .filter((GroupMember.user_id == user_id) | (GroupMember.email == normalized_email))
        .all()
    )
    if not memberships:
        return None

    group_ids = [m.group_id for m in memberships]
    return (
        db.query(GroupAssignment)
        .filter(
            GroupAssignment.group_id.in_(group_ids),
            GroupAssignment.project_id == project_id,
        )
        .order_by(GroupAssignment.assigned_at.desc())
        .first()
    )


def get_student_group_ids(db: Session, user_id: int, email: str) -> list[int]:
    normalized_email = email.lower()
    memberships = (
        db.query(GroupMember)
        .filter((GroupMember.user_id == user_id) | (GroupMember.email == normalized_email))
        .all()
    )
    return [m.group_id for m in memberships]
