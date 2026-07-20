import anyio
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import CurrentUser, DbSession, require_roles
from app.models.groups import GroupAssignment, GroupMember, GroupMemberStatus, TeacherGroup
from app.models.user import GROUP_ROLES, User
from app.schemas.groups import (
    GroupAssignmentCreate,
    GroupAssignmentResponse,
    GroupCreate,
    GroupDetailResponse,
    GroupMemberResponse,
    GroupMembersAdd,
    GroupResponse,
    GroupUpdate,
)
from app.services.email import notify_added_to_group, notify_assignment

router = APIRouter()

TEACHER_ROLES = GROUP_ROLES


def _group_to_response(group: TeacherGroup, db: Session) -> GroupResponse:
    member_count = db.query(GroupMember).filter(GroupMember.group_id == group.id).count()
    assignment_count = (
        db.query(GroupAssignment).filter(GroupAssignment.group_id == group.id).count()
    )
    return GroupResponse(
        id=group.id,
        name=group.name,
        description=group.description,
        created_at=group.created_at,
        updated_at=group.updated_at,
        member_count=member_count,
        assignment_count=assignment_count,
    )


def _get_owned_group(db: Session, group_id: int, teacher_id: int) -> TeacherGroup:
    group = db.query(TeacherGroup).filter(TeacherGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")
    if group.teacher_id != teacher_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your group")
    return group


@router.get("", response_model=list[GroupResponse])
async def list_groups(
    db: DbSession,
    current_user: User = Depends(require_roles(*TEACHER_ROLES)),
) -> list[GroupResponse]:
    def _list() -> list[GroupResponse]:
        groups = (
            db.query(TeacherGroup)
            .filter(TeacherGroup.teacher_id == current_user.id)
            .order_by(TeacherGroup.updated_at.desc())
            .all()
        )
        return [_group_to_response(g, db) for g in groups]

    return await anyio.to_thread.run_sync(_list)


@router.post("", response_model=GroupResponse, status_code=status.HTTP_201_CREATED)
async def create_group(
    body: GroupCreate,
    db: DbSession,
    current_user: User = Depends(require_roles(*TEACHER_ROLES)),
) -> GroupResponse:
    def _create() -> GroupResponse:
        group = TeacherGroup(
            teacher_id=current_user.id,
            name=body.name.strip(),
            description=body.description.strip() if body.description else None,
        )
        db.add(group)
        db.commit()
        db.refresh(group)
        return _group_to_response(group, db)

    return await anyio.to_thread.run_sync(_create)


@router.get("/{group_id}", response_model=GroupDetailResponse)
async def get_group(
    group_id: int,
    db: DbSession,
    current_user: User = Depends(require_roles(*TEACHER_ROLES)),
) -> GroupDetailResponse:
    def _get() -> GroupDetailResponse:
        group = _get_owned_group(db, group_id, current_user.id)
        members = (
            db.query(GroupMember)
            .filter(GroupMember.group_id == group.id)
            .order_by(GroupMember.invited_at.desc())
            .all()
        )
        base = _group_to_response(group, db)
        return GroupDetailResponse(
            **base.model_dump(),
            members=[GroupMemberResponse.model_validate(m) for m in members],
        )

    return await anyio.to_thread.run_sync(_get)


@router.patch("/{group_id}", response_model=GroupResponse)
async def update_group(
    group_id: int,
    body: GroupUpdate,
    db: DbSession,
    current_user: User = Depends(require_roles(*TEACHER_ROLES)),
) -> GroupResponse:
    def _update() -> GroupResponse:
        group = _get_owned_group(db, group_id, current_user.id)
        if body.name is not None:
            group.name = body.name.strip()
        if body.description is not None:
            group.description = body.description.strip() or None
        db.add(group)
        db.commit()
        db.refresh(group)
        return _group_to_response(group, db)

    return await anyio.to_thread.run_sync(_update)


@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_group(
    group_id: int,
    db: DbSession,
    current_user: User = Depends(require_roles(*TEACHER_ROLES)),
) -> None:
    def _delete() -> None:
        group = _get_owned_group(db, group_id, current_user.id)
        db.delete(group)
        db.commit()

    await anyio.to_thread.run_sync(_delete)


@router.post("/{group_id}/members", response_model=list[GroupMemberResponse])
async def add_members(
    group_id: int,
    body: GroupMembersAdd,
    db: DbSession,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_roles(*TEACHER_ROLES)),
) -> list[GroupMemberResponse]:
    def _add() -> tuple[list[GroupMemberResponse], str, list[str]]:
        group = _get_owned_group(db, group_id, current_user.id)
        added: list[GroupMember] = []

        for raw_email in body.emails:
            email = raw_email.lower().strip()
            if not email:
                continue

            existing = (
                db.query(GroupMember)
                .filter(GroupMember.group_id == group.id, GroupMember.email == email)
                .first()
            )
            if existing:
                continue

            user = db.query(User).filter(User.email == email).first()
            member = GroupMember(
                group_id=group.id,
                email=email,
                user_id=user.id if user else None,
                status=GroupMemberStatus.active if user else GroupMemberStatus.pending,
            )
            db.add(member)
            added.append(member)

        db.commit()
        for member in added:
            db.refresh(member)
        return (
            [GroupMemberResponse.model_validate(m) for m in added],
            group.name,
            [m.email for m in added],
        )

    responses, group_name, emails = await anyio.to_thread.run_sync(_add)
    teacher_name = current_user.full_name
    for email in emails:
        background_tasks.add_task(
            notify_added_to_group,
            email,
            group_name=group_name,
            teacher_name=teacher_name,
        )
    return responses


@router.delete("/{group_id}/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    group_id: int,
    member_id: int,
    db: DbSession,
    current_user: User = Depends(require_roles(*TEACHER_ROLES)),
) -> None:
    def _remove() -> None:
        _get_owned_group(db, group_id, current_user.id)
        member = (
            db.query(GroupMember)
            .filter(GroupMember.id == member_id, GroupMember.group_id == group_id)
            .first()
        )
        if not member:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")
        db.delete(member)
        db.commit()

    await anyio.to_thread.run_sync(_remove)


@router.get("/{group_id}/assignments", response_model=list[GroupAssignmentResponse])
async def list_group_assignments(
    group_id: int,
    db: DbSession,
    current_user: User = Depends(require_roles(*TEACHER_ROLES)),
) -> list[GroupAssignmentResponse]:
    def _list() -> list[GroupAssignmentResponse]:
        _get_owned_group(db, group_id, current_user.id)
        rows = (
            db.query(GroupAssignment)
            .filter(GroupAssignment.group_id == group_id)
            .order_by(GroupAssignment.assigned_at.desc())
            .all()
        )
        return [GroupAssignmentResponse.model_validate(r) for r in rows]

    return await anyio.to_thread.run_sync(_list)


@router.post(
    "/{group_id}/assignments",
    response_model=GroupAssignmentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def assign_content(
    group_id: int,
    body: GroupAssignmentCreate,
    db: DbSession,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_roles(*TEACHER_ROLES)),
) -> GroupAssignmentResponse:
    def _assign() -> tuple[GroupAssignmentResponse, str, list[str]]:
        group = _get_owned_group(db, group_id, current_user.id)
        assignment = GroupAssignment(
            group_id=group_id,
            assigned_by_id=current_user.id,
            project_id=body.project_id,
            title=body.title.strip(),
            outputs=body.outputs,
            content_snapshot=body.content_snapshot,
        )
        db.add(assignment)
        db.commit()
        db.refresh(assignment)
        member_emails = [
            m.email
            for m in db.query(GroupMember).filter(GroupMember.group_id == group_id).all()
        ]
        return (
            GroupAssignmentResponse.model_validate(assignment),
            group.name,
            member_emails,
        )

    response, group_name, member_emails = await anyio.to_thread.run_sync(_assign)
    teacher_name = current_user.full_name
    assignment_title = response.title
    for email in member_emails:
        background_tasks.add_task(
            notify_assignment,
            email,
            group_name=group_name,
            assignment_title=assignment_title,
            teacher_name=teacher_name,
        )
    return response


@router.delete(
    "/{group_id}/assignments/{assignment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_assignment(
    group_id: int,
    assignment_id: int,
    db: DbSession,
    current_user: User = Depends(require_roles(*TEACHER_ROLES)),
) -> None:
    def _remove() -> None:
        _get_owned_group(db, group_id, current_user.id)
        assignment = (
            db.query(GroupAssignment)
            .filter(
                GroupAssignment.id == assignment_id,
                GroupAssignment.group_id == group_id,
            )
            .first()
        )
        if not assignment:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")
        db.delete(assignment)
        db.commit()

    await anyio.to_thread.run_sync(_remove)
