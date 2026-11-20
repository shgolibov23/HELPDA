import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.database import SessionLocal
from app.models import Category
from app import telegram
from app.routers import admin, auth, business, growth, orders, public, telegram_link
from app.storage import AVATAR_DIR

log = logging.getLogger("helpda")

# (nom, Ionicons belgisi). Mavjud nomlar o'zgartirilmaydi; yangilari qo'shiladi.
DEFAULT_CATEGORIES = [
    ("IT va texnologiya", "laptop-outline"),
    ("Uy xizmatlari", "home-outline"),
    ("Dizayn", "color-palette-outline"),
    ("Marketing", "megaphone-outline"),
    ("Logistika", "bus-outline"),
    ("Ta'lim", "school-outline"),
    ("Tozalash", "sparkles-outline"),
    ("Qurilish", "construct-outline"),
    ("Buxgalteriya", "calculator-outline"),
    ("Ta'mirlash xizmatlari", "build-outline"),
    ("Boshqa xizmatlar", "grid-outline"),
]


def seed_categories():
    db = SessionLocal()
    try:
        for name, icon in DEFAULT_CATEGORIES:
            existing = db.query(Category).filter(Category.name == name).first()
            if not existing:
                db.add(Category(name=name, icon=icon))
            elif not existing.icon:
                existing.icon = icon
        db.commit()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        seed_categories()
    except Exception as exc:  # jadvallar yo'q bo'lsa
        log.error(
            "Kategoriyalarni yaratib bo'lmadi (%s). 'alembic upgrade head' buyrug'ini ishga tushirdingizmi?",
            exc,
        )
    telegram.start_polling()
    yield
    telegram.stop_polling()


app = FastAPI(title="HELPDA API", description="HELPDA xizmatlar platformasi", version="2.0.0", lifespan=lifespan)
AVATAR_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/media", StaticFiles(directory=AVATAR_DIR), name="media")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8081", "http://127.0.0.1:8081"],
    allow_origin_regex=(
        r"^http://(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|"
        r"192\.168\.\d{1,3}\.\d{1,3}|"
        r"172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}):\d+$"
    ),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_handler(request: Request, exc: RequestValidationError):
    err = exc.errors()[0]
    msg = str(err.get("msg", "Ma'lumot noto'g'ri")).removeprefix("Value error, ")
    loc = [str(p) for p in err.get("loc", []) if p not in ("body", "query", "path")]
    field = loc[-1] if loc else None
    return JSONResponse(status_code=422, content={"detail": msg, "field": field})


for r in (auth.router, telegram_link.router, public.router, business.router, orders.router, growth.router, admin.router):
    app.include_router(r)
