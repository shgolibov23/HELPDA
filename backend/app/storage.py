from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile

STORAGE_ROOT = Path(__file__).resolve().parent.parent / "storage"
AVATAR_DIR = STORAGE_ROOT / "profile-photos"
PRIVATE_DOCUMENT_DIR = STORAGE_ROOT / "private-documents"
MAX_AVATAR_BYTES = 5 * 1024 * 1024
MAX_DOCUMENT_BYTES = 10 * 1024 * 1024


async def read_avatar(upload: UploadFile) -> tuple[bytes, str]:
    content = await upload.read(MAX_AVATAR_BYTES + 1)
    if len(content) > MAX_AVATAR_BYTES:
        raise HTTPException(413, "Profil rasmi 5 MB dan kichik bo‘lishi kerak.")
    formats = (
        (content.startswith(b"\xff\xd8\xff"), ".jpg"),
        (content.startswith(b"\x89PNG\r\n\x1a\n"), ".png"),
        (len(content) >= 12 and content[:4] == b"RIFF" and content[8:12] == b"WEBP", ".webp"),
    )
    extension = next((ext for valid, ext in formats if valid), None)
    if extension is None:
        raise HTTPException(415, "Faqat JPG, PNG yoki WebP formatidagi rasm qabul qilinadi.")
    return content, extension


async def read_pdf(upload: UploadFile | None) -> bytes | None:
    if upload is None:
        return None
    content = await upload.read(MAX_DOCUMENT_BYTES + 1)
    if len(content) > MAX_DOCUMENT_BYTES:
        raise HTTPException(413, "PDF hujjat 10 MB dan kichik bo‘lishi kerak.")
    if not content.startswith(b"%PDF-"):
        raise HTTPException(415, "Faqat haqiqiy PDF hujjat yuklash mumkin.")
    return content


def save_avatar(content: bytes, extension: str) -> str:
    AVATAR_DIR.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid4().hex}{extension}"
    (AVATAR_DIR / filename).write_bytes(content)
    return filename


def save_private_pdf(content: bytes) -> str:
    PRIVATE_DOCUMENT_DIR.mkdir(mode=0o700, parents=True, exist_ok=True)
    PRIVATE_DOCUMENT_DIR.chmod(0o700)
    filename = f"{uuid4().hex}.pdf"
    path = PRIVATE_DOCUMENT_DIR / filename
    path.write_bytes(content)
    path.chmod(0o600)
    return f"private-documents/{filename}"


def remove_stored_file(relative_path: str | None) -> None:
    if not relative_path:
        return
    path = (STORAGE_ROOT / relative_path).resolve()
    if path.is_relative_to(STORAGE_ROOT.resolve()) and path.is_file():
        path.unlink()
