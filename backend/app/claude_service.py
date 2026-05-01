"""Wrapper around the Anthropic SDK for nutrition chat + photo recognition.

The chat strategy:
- Send a system prompt that asks Claude to act as a nutrition estimator and to
  ALWAYS append a JSON block in a specific format whenever it's confident it
  has produced a nutrition estimate.
- Parse the JSON out of the response, return both the prose `reply` and the
  structured `estimate` to the frontend.
- Tool-use is a natural next step (have Claude call a `log_food` tool). For
  this MVP we keep it simple with structured output.
"""
from __future__ import annotations

import base64
import json
import re
from typing import Optional

import anthropic

from .config import get_settings
from .schemas import ChatTurn, NutritionEstimate

settings = get_settings()

NUTRITION_SYSTEM_PROMPT = """\
You are NutriTrack's nutrition assistant. Your job is to help the user estimate
the calories and macronutrients of foods they describe — whether that's a
home recipe with ingredients and quantities, a restaurant menu description, or
just a casual "what's in a Big Mac" question.

How to respond:
1. Briefly explain how you arrived at the estimate (1-3 short sentences). Note
   key assumptions (portion sizes, oil used, etc.) so the user can correct you.
2. If the user has given you enough information to produce a nutrition
   estimate, append a single JSON code block at the end of your reply with
   exactly this shape:

```json
{
  "name": "Short dish name",
  "servings": 1.0,
  "calories": 650,
  "protein_g": 35,
  "carbs_g": 60,
  "fat_g": 28,
  "confidence": "medium",
  "notes": "Optional caveats"
}
```

3. If the user's question isn't about a specific food (e.g. they're asking a
   general nutrition question), DO NOT include a JSON block — just answer
   normally.
4. Numbers should be per single serving as defined in the `servings` field
   (which is usually 1.0). Be honest about uncertainty via the `confidence`
   field: "low", "medium", or "high".
5. If the user describes multiple dishes, pick the primary one for the JSON
   block and discuss the others in prose.
"""


PHOTO_SYSTEM_PROMPT = """\
You are NutriTrack's vision-based food estimator. The user will send you a
photo of food. Identify what's in the photo and estimate the nutrition for one
realistic serving as visible. Be conservative when you can't tell portion size.

Respond with 1-2 sentences describing what you see, then end with a single
JSON code block in this exact shape:

```json
{
  "name": "Short dish name",
  "servings": 1.0,
  "calories": 650,
  "protein_g": 35,
  "carbs_g": 60,
  "fat_g": 28,
  "confidence": "low",
  "notes": "Hard to tell portion size from photo"
}
```
"""


_JSON_BLOCK_RE = re.compile(r"```(?:json)?\s*(\{.*?\})\s*```", re.DOTALL)


def _client() -> anthropic.Anthropic:
    if not settings.ANTHROPIC_API_KEY:
        raise RuntimeError(
            "ANTHROPIC_API_KEY is not set. Add it to backend/.env to enable Claude features."
        )
    return anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)


def _extract_estimate(text: str) -> Optional[NutritionEstimate]:
    """Pull the first JSON code block out of a Claude response and parse it."""
    match = _JSON_BLOCK_RE.search(text)
    if not match:
        return None
    try:
        data = json.loads(match.group(1))
        return NutritionEstimate.model_validate(data)
    except (json.JSONDecodeError, ValueError):
        return None


def _strip_json_block(text: str) -> str:
    """Remove the JSON code block from the prose so the user just sees the explanation."""
    return _JSON_BLOCK_RE.sub("", text).strip()


def chat(user_message: str, history: list[ChatTurn]) -> tuple[str, Optional[NutritionEstimate]]:
    """Run a chat turn against Claude. Returns (prose_reply, optional_estimate)."""
    messages = [{"role": turn.role, "content": turn.content} for turn in history]
    messages.append({"role": "user", "content": user_message})

    response = _client().messages.create(
        model=settings.CLAUDE_MODEL,
        max_tokens=1024,
        system=NUTRITION_SYSTEM_PROMPT,
        messages=messages,
    )

    text = "".join(block.text for block in response.content if getattr(block, "type", None) == "text")
    estimate = _extract_estimate(text)
    prose = _strip_json_block(text) if estimate else text
    return prose, estimate


def estimate_from_photo(image_bytes: bytes, media_type: str) -> tuple[str, Optional[NutritionEstimate]]:
    """Send a photo to Claude's vision API and parse the nutrition estimate."""
    b64 = base64.standard_b64encode(image_bytes).decode("utf-8")
    response = _client().messages.create(
        model=settings.CLAUDE_MODEL,
        max_tokens=1024,
        system=PHOTO_SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {"type": "base64", "media_type": media_type, "data": b64},
                    },
                    {"type": "text", "text": "What food is this and what's the nutrition for one serving?"},
                ],
            }
        ],
    )
    text = "".join(block.text for block in response.content if getattr(block, "type", None) == "text")
    estimate = _extract_estimate(text)
    prose = _strip_json_block(text) if estimate else text
    return prose, estimate
