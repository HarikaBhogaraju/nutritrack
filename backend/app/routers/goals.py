"""Daily nutrition + weight goal, and weight-log endpoints."""
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from .. import schemas
from ..auth import CurrentUser
from ..database import get_db
from ..models import Goals, WeightEntry

router = APIRouter()


# -------- Goals (single row per user) --------

def _get_or_create_goals(db: Session, user_id: int) -> Goals:
    goals = db.query(Goals).filter(Goals.user_id == user_id).first()
    if goals is None:
        goals = Goals(user_id=user_id)
        db.add(goals)
        db.commit()
        db.refresh(goals)
    return goals


@router.get("", response_model=schemas.GoalsOut)
def get_goals(current_user: CurrentUser, db: Annotated[Session, Depends(get_db)]):
    return _get_or_create_goals(db, current_user.id)


@router.put("", response_model=schemas.GoalsOut)
def update_goals(
    payload: schemas.GoalsBase,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
):
    """Upsert: replaces all goal fields. Send `null` to clear an individual one."""
    goals = _get_or_create_goals(db, current_user.id)
    for k, v in payload.model_dump().items():
        setattr(goals, k, v)
    db.commit()
    db.refresh(goals)
    return goals


# -------- Weight log --------

@router.get("/weight", response_model=list[schemas.WeightEntryOut])
def list_weights(
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
    days: int = Query(default=180, ge=1, le=3650, description="Look back this many days"),
):
    """Return weight entries from the last `days` days, oldest first (chart-friendly)."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    return (
        db.query(WeightEntry)
        .filter(WeightEntry.user_id == current_user.id)
        .filter(WeightEntry.measured_at >= cutoff)
        .order_by(WeightEntry.measured_at.asc())
        .all()
    )


@router.post("/weight", response_model=schemas.WeightEntryOut, status_code=201)
def add_weight(
    payload: schemas.WeightEntryCreate,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
):
    entry = WeightEntry(
        user_id=current_user.id,
        weight_lb=payload.weight_lb,
        measured_at=payload.measured_at or datetime.now(timezone.utc),
        notes=payload.notes,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/weight/{entry_id}", status_code=204)
def delete_weight(
    entry_id: int,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
):
    entry = db.get(WeightEntry, entry_id)
    if entry is None or entry.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Weight entry not found")
    db.delete(entry)
    db.commit()
