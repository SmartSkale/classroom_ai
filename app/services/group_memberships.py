from sqlalchemy.orm import Session

from app.models.groups import GroupMember, GroupMemberStatus
from app.models.user import User


def link_user_to_group_memberships(db: Session, user: User) -> None:
    """Attach pending group invites to a user when they register or log in."""
    members = db.query(GroupMember).filter(GroupMember.email == user.email.lower()).all()
    if not members:
        return
    for member in members:
        member.user_id = user.id
        member.status = GroupMemberStatus.active
        db.add(member)
    db.commit()
