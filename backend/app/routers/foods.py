"""Food entry CRUD + dashboard aggregations.

All "today"/"yesterday" math is timezone-aware. The frontend sends:
  - `date=YYYY-MM-DD` — the date in the user's local timezone
  - `tz_offset=N` — minutes that UTC differs from local, signed the same way
                    JavaScript's `Date.getTimezoneOffset()` returns
                    (e.g. New York EST → +300, Tokyo JST → −540)

We convert that to a UTC range and filter `consumed_at` (which is stored UTC).
"""
from datetime import date as date_cls, datetime, time, timedelta, timezone
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


def _local_day_range_utc(local_date: date_cls, tz_offset_min: int) -> tuple[datetime, datetime]:
    """Return (start_utc, end_utc) for the given local-date and tz offset.

    JavaScript's `Date.getTimezoneOffset()` returns `(UTC - local) / minute`.
    So local midnight in UTC is local-midnight + offset_minutes.
    """
    local_midnight_naive = datetime.combine(local_date, time.min)
    start_utc = local_midnight_naive.replace(tzinfo=timezone.utc) + timedelta(minutes=tz_offset_min)
    end_utc = start_utc + timedelta(days=1)
    return start_utc, end_utc


def _local_today(tz_offset_min: int) -> date_cls:
    """The current date in the user's local timezone."""
    return (datetime.now(timezone.utc) - timedelta(minutes=tz_offset_min)).date()


def _as_utc(dt: datetime) -> datetime:
    """SQLite drops timezone info on read. Treat any naive datetime as UTC."""
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


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
    date: str | None = Query(default=None, description="YYYY-MM-DD in the user's local timezone; defaults to local today"),
    tz_offset: int = Query(default=0, description="Minutes UTC differs from local, like JS Date.getTimezoneOffset()"),
):
    target = date_cls.fromisoformat(date) if date else _local_today(tz_offset)
    start, end = _local_day_range_utc(target, tz_offset)
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
def dashboard(
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
    tz_offset: int = Query(default=0, description="Minutes UTC differs from local"),
):
    """Today's totals + the last 7 days' daily totals — all in the user's local timezone."""
    today = _local_today(tz_offset)
    seven_days_ago = today - timedelta(days=6)

    # Build 7 (start_utc, end_utc) ranges keyed by local-date string.
    ranges: list[tuple[str, datetime, datetime]] = []
    for offset in range(7):
        d = seven_days_ago + timedelta(days=offset)
        s, e = _local_day_range_utc(d, tz_offset)
        ranges.append((d.isoformat(), s, e))

    overall_start = ranges[0][1]
    overall_end = ranges[-1][2]

    rows = (
        db.query(FoodEntry)
        .filter(FoodEntry.user_id == current_user.id)
        .filter(FoodEntry.consumed_at >= overall_start)
        .filter(FoodEntry.consumed_at < overall_end)
        .all()
    )

    buckets: dict[str, dict[str, float]] = {
        d: {"calories": 0.0, "protein_g": 0.0, "carbs_g": 0.0, "fat_g": 0.0, "entry_count": 0}
        for d, _, _ in ranges
    }
    # For each entry, bucket it into whichever local-date range contains its consumed_at.
    for entry in rows:
        consumed = _as_utc(entry.consumed_at)
        for d, s, e in ranges:
            if s <= consumed < e:
                cals, p, c, f = _entry_totals(entry)
                b = buckets[d]
                b["calories"] += cals
                b["protein_g"] += p
                b["carbs_g"] += c
                b["fat_g"] += f
                b["entry_count"] += 1
                break

    last_7 = [
        schemas.DailyTotals(date=d, **{k: round(v, 1) if isinstance(v, float) else v for k, v in totals.items()})
        for d, totals in sorted(buckets.items())
    ]
    today_iso = today.isoformat()
    today_totals = next((dt for dt in last_7 if dt.date == today_iso), schemas.DailyTotals(
        date=today_iso, calories=0, protein_g=0, carbs_g=0, fat_g=0, entry_count=0
    ))
    return schemas.DashboardResponse(today=today_totals, last_7_days=last_7)
