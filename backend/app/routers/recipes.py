"""Saved recipes / favorites."""
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import schemas
from ..auth import CurrentUser
from ..database import get_db
from ..models import FoodEntry, Recipe

router = APIRouter()


@router.post("", response_model=schemas.RecipeOut, status_code=201)
def create_recipe(
    payload: schemas.RecipeCreate,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
):
    recipe = Recipe(user_id=current_user.id, **payload.model_dump())
    db.add(recipe)
    db.commit()
    db.refresh(recipe)
    return recipe


@router.get("", response_model=list[schemas.RecipeOut])
def list_recipes(
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
    favorites_only: bool = False,
):
    q = db.query(Recipe).filter(Recipe.user_id == current_user.id)
    if favorites_only:
        q = q.filter(Recipe.is_favorite.is_(True))
    return q.order_by(Recipe.is_favorite.desc(), Recipe.name.asc()).all()


@router.patch("/{recipe_id}", response_model=schemas.RecipeOut)
def update_recipe(
    recipe_id: int,
    payload: schemas.RecipeBase,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
):
    recipe = db.get(Recipe, recipe_id)
    if recipe is None or recipe.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Recipe not found")
    for k, v in payload.model_dump().items():
        setattr(recipe, k, v)
    db.commit()
    db.refresh(recipe)
    return recipe


@router.delete("/{recipe_id}", status_code=204)
def delete_recipe(
    recipe_id: int,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
):
    recipe = db.get(Recipe, recipe_id)
    if recipe is None or recipe.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Recipe not found")
    db.delete(recipe)
    db.commit()


@router.post("/{recipe_id}/log", response_model=schemas.FoodEntryOut, status_code=201)
def log_recipe(
    recipe_id: int,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
    servings: float | None = None,
):
    """Log this recipe as a food entry for today, optionally overriding servings."""
    recipe = db.get(Recipe, recipe_id)
    if recipe is None or recipe.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Recipe not found")

    entry = FoodEntry(
        user_id=current_user.id,
        name=recipe.name,
        servings=servings if servings is not None else recipe.default_servings,
        calories=recipe.calories,
        protein_g=recipe.protein_g,
        carbs_g=recipe.carbs_g,
        fat_g=recipe.fat_g,
        notes=f"Logged from recipe #{recipe.id}",
        consumed_at=datetime.now(timezone.utc),
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry
