import secrets

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import telegram
from app.config import settings
from app.database import get_db
from app.deps import get_current_user
from app.models import User

router = APIRouter(prefix="/me/telegram", tags=["telegram"])


@router.get("")
def status(user: User = Depends(get_current_user)):
    return {
        "configured": telegram.enabled() and bool(settings.TELEGRAM_BOT_USERNAME),
        "linked": user.telegram_chat_id is not None,
    }


@router.post("/link")
def create_link(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not (telegram.enabled() and settings.TELEGRAM_BOT_USERNAME):
        raise HTTPException(503, "Telegram bot hozircha sozlanmagan.")
    user.telegram_link_token = secrets.token_urlsafe(16)
    db.commit()
    return {"url": f"https://t.me/{settings.TELEGRAM_BOT_USERNAME}?start={user.telegram_link_token}"}


@router.delete("")
def unlink(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    user.telegram_chat_id = None
    user.telegram_link_token = None
    db.commit()
    return {"linked": False}
