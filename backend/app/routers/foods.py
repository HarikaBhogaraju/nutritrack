"""Food entry CRUD + dashboard aggregations."""
from datetime import datetime, time, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from .. import schemas
from ..auth import CurrentUser
from ..database import get_db
from ..models import FoodEntry

router = APIRouter()


def _entry_totals(entry: FoodEntry) -> tuple[float, float, float, float]:
    """Multiply per-serving nutrition by servings."""
    s = entry.servings or 1.0
    return entry.calories * s, entry.protein_g * s, entry.carbs_g * s, entry.fat_g * s


@router.post("", response_model=schemas.FoodEntryOut, status_code=201)
def create_entry(
    payload: schemas.FoodEntryCreate,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
):
    entry = FoodEntry(
        user_id=current_user.id,
        name=payload.name,
        servings=payload.servings,
        calories=payload.calories,
        protein_g=payload.protein_g,
        carbs_g=payload.carbs_g,
        fat_g=payload.fat_g,
        meal=payload.meal,
        notes=payload.notes,
        consumed_at=payload.consumed_at or datetime.now(timezone.utc),
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.get("", response_model=list[schemas.FoodEntryOut])
def list_entries(
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
    date: str | None = Query(default=None, description="YYYY-MM-DD; defaults to today"),
):
    target = datetime.fromisoformat(date).date() if date else datetime.now(timezone.utc).date()
    start = datetime.combine(target, time.min, tzinfo=timezone.utc)
    end = start + timedelta(days=1)
    return (
        db.query(FoodEntry)
        .filter(FoodEntry.user_id == current_user.id)
        .filter(FoodEntry.consumed_at >= start)
        .filter(FoodEntry.consumed_at < end)
        .order_by(FoodEntry.consumed_at.asc())
        .all()
    )


@router.delete("/{entry_id}", status_code=204)
def delete_entry(
    entry_id: int,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
):
    entry = db.get(FoodEntry, entry_id)
    if entry is None or entry.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Entry not found")
    db.delete(entry)
    db.commit()


@router.get("/dashboard", response_model=schemas.DashboardResponse)
def dashboard(current_user: CurrentUser, db: Annotated[Session, Depends(get_db)]):
    """Today's totals + the last 7 days' daily totals."""
    today = datetime.now(timezone.utc).date()
    seven_days_ago = today - timedelta(days=6)
    start = datetime.combine(seven_days_ago, time.min, tzinfo=timezone.utc)

    rows = (
        db.query(FoodEntry)
        .filter(FoodEntry.user_id == current_user.id)
        .filter(FoodEntry.consumed_at >= start)
        .all()
    )

    # Bucket by date.
    buckets: dict[str, dict[str, float]] = {}
    for offset in range(7):
        d = (seven_days_ago + timedelta(days=offset)).isoformat()
        buckets[d] = {"calories": 0.0, "protein_g": 0.0, "carbs_g": 0.0, "fat_g": 0.0, "entry_count": 0}

    for entry in rows:
        d = entry.consumed_at.date().isoformat()
        if d not in buckets:
            continue
        cals, p, c, f = _entry_totals(entry)
        b = buckets[d]
        b["calories"] += cals
        b["protein_g"] += p
        b["carbs_g"] += c
        b["fat_g"] += f
        b["entry_count"] += 1

    last_7 = [
        schemas.DailyTotals(date=d, **{k: round(v, 1) if isinstance(v, float) else v for k, v in totals.items()})
        for d, totals in sorted(buckets.items())
    ]
    today_iso = today.isoformat()
    today_totals = next((dt for dt in last_7 if dt.date == today_iso), schemas.DailyTotals(
        date=today_iso, calories=0, protein_g=0, carbs_g=0, fat_g=0, entry_count=0
    ))
    return schemas.DashboardResponse(today=today_totals, last_7_days=last_7)
