"""Barcode -> nutrition lookup using OpenFoodFacts (free, no API key required).

OpenFoodFacts returns nutrition per 100g/100ml. We surface that as a single
serving estimate; the frontend can let the user adjust `servings` after.
"""
from __future__ import annotations

from typing import Optional

import httpx

from .schemas import NutritionEstimate

OFF_URL = "https://world.openfoodfacts.org/api/v2/product/{barcode}.json"


def lookup_barcode(barcode: str) -> Optional[NutritionEstimate]:
    barcode = barcode.strip()
    if not barcode.isdigit():
        return None

    try:
        with httpx.Client(timeout=10.0, headers={"User-Agent": "NutriTrack/0.1 (dev)"}) as client:
            response = client.get(OFF_URL.format(barcode=barcode))
    except httpx.HTTPError:
        return None

    if response.status_code != 200:
        return None
    body = response.json()
    if body.get("status") != 1:
        return None

    product = body.get("product", {}) or {}
    name = product.get("product_name") or product.get("generic_name") or "Unknown product"
    nutriments = product.get("nutriments", {}) or {}

    # Prefer per-serving values if available, otherwise fall back to per-100g.
    cals = nutriments.get("energy-kcal_serving") or nutriments.get("energy-kcal_100g")
    protein = nutriments.get("proteins_serving") or nutriments.get("proteins_100g")
    carbs = nutriments.get("carbohydrates_serving") or nutriments.get("carbohydrates_100g")
    fat = nutriments.get("fat_serving") or nutriments.get("fat_100g")

    if cals is None and protein is None and carbs is None and fat is None:
        return None

    return NutritionEstimate(
        name=name,
        servings=1.0,
        calories=float(cals or 0),
        protein_g=float(protein or 0),
        carbs_g=float(carbs or 0),
        fat_g=float(fat or 0),
        confidence="high",
        notes=(
            "Per single serving from OpenFoodFacts."
            if nutriments.get("energy-kcal_serving") is not None
            else "Per 100g from OpenFoodFacts — adjust servings to match what you ate."
        ),
    )
