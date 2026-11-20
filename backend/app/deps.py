import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Business, User
from app.security import decode_token

bearer_scheme = HTTPBearer(auto_error=False)


def _load_user(creds: HTTPAuthorizationCredentials, db: Session) -> User:
    try:
        user_id = decode_token(creds.credentials)
    except (jwt.InvalidTokenError, KeyError, ValueError):
        raise HTTPException(401, "Token yaroqsiz yoki muddati tugagan!")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(401, "Foydalanuvchi topilmadi!")
    if not user.is_active:
        raise HTTPException(403, "Hisobingiz bloklangan. Qo'llab-quvvatlashga murojaat qiling.")
    return user


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if creds is None:
        raise HTTPException(401, "Avval tizimga kiring!")
    return _load_user(creds, db)


def get_optional_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User | None:
    """Ochiq sahifalar uchun: token bo'lmasa yoki yaroqsiz bo'lsa None."""
    if creds is None:
        return None
    try:
        return _load_user(creds, db)
    except HTTPException:
        return None


def get_admin_user(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(403, "Bu amal faqat admin uchun!")
    return current_user


def get_business_owner(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> tuple[User, Business]:
    business = db.query(Business).filter(Business.owner_id == current_user.id).first()
    if not business:
        raise HTTPException(403, "Bu amal faqat tasdiqlangan biznes egalari uchun!")
    if not business.is_active:
        raise HTTPException(403, "Biznesingiz vaqtincha bloklangan.")
    return current_user, business
