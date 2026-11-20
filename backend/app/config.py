"""Sozlamalar. Barcha sirlar .env faylidan o'qiladi (kodga yozilmaydi)."""
import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")


def _bool(name: str, default: bool = False) -> bool:
    return os.getenv(name, str(default)).strip().lower() in ("1", "true", "yes")


def _int_list(name: str) -> list[int]:
    out: list[int] = []
    for part in os.getenv(name, "").split(","):
        part = part.strip()
        if part.lstrip("-").isdigit():
            out.append(int(part))
    return out


class Settings:
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", "postgresql+psycopg://localhost/helpda_db"
    )
    SECRET_KEY: str | None = os.getenv("SECRET_KEY")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_HOURS: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_HOURS", "24"))
    # Faqat dasturlash vaqtida True qiling
    ENABLE_DB_TEST: bool = _bool("ENABLE_DB_TEST", False)
    LOGIN_MAX_ATTEMPTS: int = int(os.getenv("LOGIN_MAX_ATTEMPTS", "5"))
    LOGIN_WINDOW_SECONDS: int = int(os.getenv("LOGIN_WINDOW_SECONDS", "300"))
    # Telegram bot (ixtiyoriy). Token bo'lmasa bot butunlay o'chiq.
    TELEGRAM_BOT_TOKEN: str | None = os.getenv("TELEGRAM_BOT_TOKEN") or None
    TELEGRAM_BOT_USERNAME: str = (os.getenv("TELEGRAM_BOT_USERNAME") or "").lstrip("@")
    TELEGRAM_ADMIN_IDS: list[int] = _int_list("TELEGRAM_ADMIN_IDS")
    TELEGRAM_POLLING: bool = _bool("TELEGRAM_POLLING", True)
    OPENAI_API_KEY: str | None = os.getenv("OPENAI_API_KEY") or None
    OPENAI_MODEL: str = os.getenv("OPENAI_MODEL", "gpt-4o-mini")


settings = Settings()

if not settings.SECRET_KEY or len(settings.SECRET_KEY) < 16:
    raise RuntimeError(
        "SECRET_KEY topilmadi yoki juda qisqa. backend/.env faylida SECRET_KEY "
        "belgilang (README'dagi buyruq bilan yarating)."
    )
