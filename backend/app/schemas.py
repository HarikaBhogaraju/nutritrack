"""Pydantic request/response schemas."""
from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field


# -------- Auth --------

class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    display_name: str = ""


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    email: EmailStr
    display_name: str


# -------- Food entries --------

class FoodEntryBase(BaseModel):
    name: str
    servings: float = 1.0
    calories: float = 0.0
    protein_g: float = 0.0
    carbs_g: float = 0.0
    fat_g: float = 0.0
    meal: Optional[Literal["breakfast", "lunch", "dinner", "snack"]] = None
    notes: Optional[str] = None
    consumed_at: Optional[datetime] = None


class FoodEntryCreate(FoodEntryBase):
    pass


class FoodEntryOut(FoodEntryBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    consumed_at: datetime
    created_at: datetime


class DailyTotals(BaseModel):
    date: str  # YYYY-MM-DD
    calories: float
    protein_g: float
    carbs_g: float
    fat_g: float
    entry_count: int


class DashboardResponse(BaseModel):
    today: DailyTotals
    last_7_days: list[DailyTotals]


# -------- Recipes --------

class RecipeBase(BaseModel):
    name: str
    description: Optional[str] = None
    calories: float = 0.0
    protein_g: float = 0.0
    carbs_g: float = 0.0
    fat_g: float = 0.0
    default_servings: float = 1.0
    is_favorite: bool = False


class RecipeCreate(RecipeBase):
    pass


class RecipeOut(RecipeBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime


# -------- Chat --------

class ChatRequest(BaseModel):
    message: str
    # Optional: include recent message history if the client is keeping state.
    history: list["ChatTurn"] = []


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class NutritionEstimate(BaseModel):
    """Structured nutrition output Claude returns alongside its prose answer."""
    name: str
    servings: float = 1.0
    calories: float
    protein_g: float
    carbs_g: float
    fat_g: float
    confidence: Literal["low", "medium", "high"] = "medium"
    notes: Optional[str] = None


class ChatResponse(BaseModel):
    reply: str
    estimate: Optional[NutritionEstimate] = None


# -------- Lookup --------

class BarcodeLookupResponse(BaseModel):
    found: bool
    estimate: Optional[NutritionEstimate] = None
    raw_name: Optional[str] = None


class PhotoLookupResponse(BaseModel):
    estimate: Optional[NutritionEstimate] = None
    description: Optional[str] = None


ChatRequest.model_rebuild()
