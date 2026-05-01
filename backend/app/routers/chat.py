"""Nutrition chat with Claude. Persists the conversation history per user."""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import schemas
from ..auth import CurrentUser
from ..claude_service import chat as claude_chat
from ..database import get_db
from ..models import ChatMessage

router = APIRouter()


@router.get("/history", response_model=list[schemas.ChatTurn])
def history(
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
    limit: int = 50,
):
    rows = (
        db.query(ChatMessage)
        .filter(ChatMessage.user_id == current_user.id)
        .order_by(ChatMessage.created_at.desc())
        .limit(limit)
        .all()
    )
    rows.reverse()
    return [schemas.ChatTurn(role=m.role, content=m.content) for m in rows]


@router.post("", response_model=schemas.ChatResponse)
def send_message(
    payload: schemas.ChatRequest,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
):
    # Use the persisted history if the client didn't provide one.
    if payload.history:
        history_turns = payload.history
    else:
        rows = (
            db.query(ChatMessage)
            .filter(ChatMessage.user_id == current_user.id)
            .order_by(ChatMessage.created_at.asc())
            .all()
        )
        history_turns = [schemas.ChatTurn(role=m.role, content=m.content) for m in rows]

    try:
        prose, estimate = claude_chat(payload.message, history_turns)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:  # noqa: BLE001 - surface unexpected errors clearly during dev
        raise HTTPException(status_code=502, detail=f"Claude request failed: {exc}")

    db.add(ChatMessage(user_id=current_user.id, role="user", content=payload.message))
    # Store the full assistant text (including any JSON block) so we can re-parse later.
    full_assistant_text = prose
    if estimate is not None:
        full_assistant_text = (
            prose
            + "\n\n```json\n"
            + estimate.model_dump_json(indent=2)
            + "\n```"
        )
    db.add(ChatMessage(user_id=current_user.id, role="assistant", content=full_assistant_text))
    db.commit()

    return schemas.ChatResponse(reply=prose, estimate=estimate)
