from datetime import datetime, timezone

import anyio
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import DbSession, require_roles
from app.models.project import Project
from app.models.user import User, UserRole
from app.schemas.projects import ProjectResponse, ProjectSummaryResponse, ProjectUpsertRequest

router = APIRouter()

TEACHER_ROLES = (UserRole.teacher, UserRole.course_creator, UserRole.admin)


def _to_response(row: Project) -> ProjectResponse:
    return ProjectResponse(
        id=row.id,
        name=row.name,
        type=row.project_type,
        outputs=row.outputs or [],
        done=row.done,
        created_at=row.created_at,
        updated_at=row.updated_at,
        job=row.job_data or {},
    )


def _to_summary(row: Project) -> ProjectSummaryResponse:
    return ProjectSummaryResponse(
        id=row.id,
        name=row.name,
        type=row.project_type,
        outputs=row.outputs or [],
        done=row.done,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _get_owned_project(db: Session, project_id: str, owner_id: int) -> Project:
    row = db.query(Project).filter(Project.id == project_id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    if row.owner_id != owner_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your project")
    return row


@router.get("", response_model=list[ProjectSummaryResponse])
async def list_projects(
    db: DbSession,
    current_user: User = Depends(require_roles(*TEACHER_ROLES)),
) -> list[ProjectSummaryResponse]:
    def _list() -> list[ProjectSummaryResponse]:
        rows = (
            db.query(Project)
            .filter(Project.owner_id == current_user.id)
            .order_by(Project.updated_at.desc())
            .all()
        )
        return [_to_summary(row) for row in rows]

    return await anyio.to_thread.run_sync(_list)


@router.get("/jobs", response_model=list[ProjectResponse])
async def list_project_jobs(
    db: DbSession,
    current_user: User = Depends(require_roles(*TEACHER_ROLES)),
) -> list[ProjectResponse]:
    """Return full job snapshots for hydrating the teacher generation context."""

    def _list() -> list[ProjectResponse]:
        rows = (
            db.query(Project)
            .filter(Project.owner_id == current_user.id)
            .order_by(Project.updated_at.desc())
            .all()
        )
        return [_to_response(row) for row in rows]

    return await anyio.to_thread.run_sync(_list)


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: str,
    db: DbSession,
    current_user: User = Depends(require_roles(*TEACHER_ROLES)),
) -> ProjectResponse:
    def _get() -> ProjectResponse:
        return _to_response(_get_owned_project(db, project_id, current_user.id))

    return await anyio.to_thread.run_sync(_get)


@router.put("/{project_id}", response_model=ProjectResponse)
async def upsert_project(
    project_id: str,
    body: ProjectUpsertRequest,
    db: DbSession,
    current_user: User = Depends(require_roles(*TEACHER_ROLES)),
) -> ProjectResponse:
    def _upsert() -> ProjectResponse:
        row = db.query(Project).filter(Project.id == project_id).first()
        now = datetime.now(timezone.utc)
        job = dict(body.job)
        job["id"] = project_id

        if row is None:
            row = Project(
                id=project_id,
                owner_id=current_user.id,
                name=body.name.strip(),
                project_type=body.type,
                outputs=list(body.outputs),
                done=body.done,
                job_data=job,
                created_at=body.created_at or now,
                updated_at=now,
            )
            db.add(row)
        else:
            if row.owner_id != current_user.id:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your project")
            row.name = body.name.strip()
            row.project_type = body.type
            row.outputs = list(body.outputs)
            row.done = body.done
            row.job_data = job
            row.updated_at = now

        db.commit()
        db.refresh(row)
        return _to_response(row)

    return await anyio.to_thread.run_sync(_upsert)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: str,
    db: DbSession,
    current_user: User = Depends(require_roles(*TEACHER_ROLES)),
) -> None:
    def _delete() -> None:
        row = _get_owned_project(db, project_id, current_user.id)
        db.delete(row)
        db.commit()

    await anyio.to_thread.run_sync(_delete)
