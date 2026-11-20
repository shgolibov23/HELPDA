from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.catalog import user_dict
from app.config import settings
from app.database import engine, get_db
from app.deps import get_current_user
from app.models import User
from app.schemas import LoginSchema, ProfileUpdateSchema, RegisterSchema, UserResponse
from app.security import create_access_token, hash_password, verify_password
from app.storage import read_avatar, remove_stored_file, save_avatar
from app.utils import login_limiter, normalize_phone
from sqlalchemy import text

router = APIRouter(tags=["auth"])


@router.get("/")
def home():
    return {"message": "HELPDA backend ishlayapti!", "status": "success"}


@router.get("/db-test")
def database_test():
    if not settings.ENABLE_DB_TEST:
        raise HTTPException(404, "Topilmadi")
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))
    return {"message": "Baza ulandi!", "status": "success"}


@router.post("/register", status_code=201)
def register(data: RegisterSchema, db: Session = Depends(get_db)):
    if db.query(User).filter(User.phone == data.phone).first():
        raise HTTPException(409, "Bu telefon raqami allaqachon ro'yxatdan o'tgan!")
    if data.email and db.query(User).filter(User.email == data.email).first():
        raise HTTPException(409, "Bu email allaqachon ishlatilgan!")

    user = User(
        full_name=data.full_name,
        phone=data.phone,
        email=data.email,
        hashed_password=hash_password(data.password),
        role="client",
    )
    db.add(user)
    try:
        db.commit()
        db.refresh(user)
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Bu telefon yoki email allaqachon mavjud!")

    return {
        "message": "Ro'yxatdan o'tish muvaffaqiyatli!",
        "access_token": create_access_token(user.id),
        "token_type": "bearer",
        "user": user_dict(user),
    }


@router.post("/login")
def login(data: LoginSchema, request: Request, db: Session = Depends(get_db)):
    key = f"{request.client.host if request.client else 'unknown'}:{data.phone.strip()}"
    if login_limiter.blocked(key, settings.LOGIN_MAX_ATTEMPTS, settings.LOGIN_WINDOW_SECONDS):
        raise HTTPException(429, "Juda ko'p urinish. Bir necha daqiqadan keyin qayta urinib ko'ring.")

    candidates = [data.phone.strip()]
    try:
        candidates.append(normalize_phone(data.phone))
    except ValueError:
        pass
    user = db.query(User).filter(User.phone.in_(candidates)).first()

    if not user or not verify_password(data.password, user.hashed_password):
        login_limiter.fail(key)
        raise HTTPException(401, "Telefon raqami yoki parol noto'g'ri!")
    if not user.is_active:
        raise HTTPException(403, "Hisobingiz bloklangan. Qo'llab-quvvatlashga murojaat qiling.")

    login_limiter.reset(key)
    return {
        "message": "Tizimga muvaffaqiyatli kirdingiz!",
        "access_token": create_access_token(user.id),
        "token_type": "bearer",
        "user": user_dict(user),
    }


@router.get("/me", response_model=UserResponse)
def get_my_profile(current_user: User = Depends(get_current_user)):
    return current_user


@router.put("/me", response_model=UserResponse)
def update_my_profile(
    data: ProfileUpdateSchema,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if data.email and data.email != current_user.email:
        taken = db.query(User).filter(User.email == data.email, User.id != current_user.id).first()
        if taken:
            raise HTTPException(409, "Bu email allaqachon ishlatilgan!")
    current_user.full_name = data.full_name
    current_user.email = data.email
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Bu email allaqachon ishlatilgan!")
    db.refresh(current_user)
    return current_user


@router.put("/me/avatar", response_model=UserResponse)
async def update_my_avatar(
    image: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    content, extension = await read_avatar(image)
    filename = save_avatar(content, extension)
    previous = current_user.avatar_url.removeprefix("/media/") if current_user.avatar_url else None
    current_user.avatar_url = f"/media/{filename}"
    try:
        db.commit()
        db.refresh(current_user)
    except Exception:
        db.rollback()
        remove_stored_file(filename)
        raise
    remove_stored_file(previous)
    return current_user
