"""SQLAlchemy ORM models."""
from datetime import date, datetime, timezone

from sqlalchemy import Date, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str] = mapped_column(String(120), nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    food_entries: Mapped[list["FoodEntry"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    recipes: Mapped[list["Recipe"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    chat_messages: Mapped[list["ChatMessage"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    goals: Mapped["Goals | None"] = relationship(back_populates="user", uselist=False, cascade="all, delete-orphan")
    weight_entries: Mapped[list["WeightEntry"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class FoodEntry(Base):
    """A single logged food item / meal."""
    __tablename__ = "food_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    servings: Mapped[float] = mapped_column(Float, default=1.0)

    # Per-serving nutrition. Multiplied by `servings` for totals.
    calories: Mapped[float] = mapped_column(Float, default=0.0)
    protein_g: Mapped[float] = mapped_column(Float, default=0.0)
    carbs_g: Mapped[float] = mapped_column(Float, default=0.0)
    fat_g: Mapped[float] = mapped_column(Float, default=0.0)

    # breakfast | lunch | dinner | snack | None
    meal: Mapped[str | None] = mapped_column(String(20), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    consumed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    user: Mapped[User] = relationship(back_populates="food_entries")


class Recipe(Base):
    """A saved recipe / favorite the user can re-log with one click."""
    __tablename__ = "recipes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Per-serving nutrition.
    calories: Mapped[float] = mapped_column(Float, default=0.0)
    protein_g: Mapped[float] = mapped_column(Float, default=0.0)
    carbs_g: Mapped[float] = mapped_column(Float, default=0.0)
    fat_g: Mapped[float] = mapped_column(Float, default=0.0)
    default_servings: Mapped[float] = mapped_column(Float, default=1.0)

    is_favorite: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    user: Mapped[User] = relationship(back_populates="recipes")


class ChatMessage(Base):
    """Persisted nutrition-chat history per user."""
    __tablename__ = "chat_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)

    role: Mapped[str] = mapped_column(String(20), nullable=False)  # "user" | "assistant"
    content: Mapped[str] = mapped_column(Text, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, index=True)

    user: Mapped[User] = relationship(back_populates="chat_messages")


class Goals(Base):
    """One row per user. Daily nutrition targets + weight goal.

    All fields are optional so a user can set any subset (e.g. just calories).
    Weights are stored in pounds. `weekly_rate_lb` is signed:
        negative = losing, positive = gaining, 0/None = maintaining.
    """
    __tablename__ = "goals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True, index=True, nullable=False)

    # Daily nutrition targets (per day, not per serving).
    calorie_target: Mapped[float | None] = mapped_column(Float, nullable=True)
    protein_target_g: Mapped[float | None] = mapped_column(Float, nullable=True)
    carbs_target_g: Mapped[float | None] = mapped_column(Float, nullable=True)
    fat_target_g: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Weight goal.
    start_weight_lb: Mapped[float | None] = mapped_column(Float, nullable=True)
    target_weight_lb: Mapped[float | None] = mapped_column(Float, nullable=True)
    weekly_rate_lb: Mapped[float | None] = mapped_column(Float, nullable=True)
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    user: Mapped[User] = relationship(back_populates="goals")


class WeightEntry(Base):
    """A dated weight measurement (in pounds)."""
    __tablename__ = "weight_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)

    weight_lb: Mapped[float] = mapped_column(Float, nullable=False)
    measured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, index=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    user: Mapped[User] = relationship(back_populates="weight_entries")
