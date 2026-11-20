import os
import tempfile

_tmp = tempfile.mkdtemp()
os.environ["SECRET_KEY"] = "test-secret-key-for-pytest-only-1234567890"
# Testlar hech qachon haqiqiy Telegram botga ulanmasligi uchun majburan o'chiriladi
os.environ["TELEGRAM_BOT_TOKEN"] = ""
os.environ["TELEGRAM_ADMIN_IDS"] = ""
os.environ["TELEGRAM_POLLING"] = "false"
os.environ["OPENAI_API_KEY"] = ""
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp}/test.db"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.database import SessionLocal, engine  # noqa: E402
from app.main import app, seed_categories  # noqa: E402
from app.models import Base, User  # noqa: E402
from app.storage import AVATAR_DIR, PRIVATE_DOCUMENT_DIR  # noqa: E402
from app.utils import login_limiter  # noqa: E402


@pytest.fixture(autouse=True)
def fresh_db():
    stored_before = {
        path.resolve()
        for directory in (AVATAR_DIR, PRIVATE_DOCUMENT_DIR)
        if directory.exists()
        for path in directory.iterdir()
        if path.is_file()
    }
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    seed_categories()
    login_limiter.clear_all()
    yield
    for directory in (AVATAR_DIR, PRIVATE_DOCUMENT_DIR):
        if directory.exists():
            for path in directory.iterdir():
                if path.is_file() and path.resolve() not in stored_before:
                    path.unlink()


@pytest.fixture()
def client():
    return TestClient(app)


class Api:
    def __init__(self, client):
        self.c = client

    def register(self, phone, name="Test User", password="password123", **extra):
        r = self.c.post("/register", json={"full_name": name, "phone": phone, "password": password, **extra})
        assert r.status_code == 201, r.text
        return r.json()["access_token"], r.json()["user"]

    def h(self, token):
        return {"Authorization": f"Bearer {token}"}

    def make_admin(self, phone="998900000001"):
        token, user = self.register(phone, "Admin User")
        db = SessionLocal()
        db.query(User).filter(User.id == user["id"]).update({"role": "admin"})
        db.commit()
        db.close()
        return token

    APPLICATION = {
        "business_type": "mchj",
        "business_name": "Digital Studio",
        "registration_number": "123456789",
        "business_phone": "998711234567",
        "city": "Toshkent",
        "address": "Amir Temur ko'chasi 1",
        "applicant_position": "Direktor",
        "category_ids": [1, 3, 7],
        "description": "Raqamli xizmatlar va bizneslar uchun zamonaviy veb yechimlar.",
    }

    def approved_business(self, phone, reg="123456789", name="Digital Studio"):
        """Foydalanuvchi + admin tasdiqlagan biznes. Qaytaradi: owner_token, admin_token."""
        admin = self.make_admin("998900000099") if not hasattr(self, "_admin") else self._admin
        self._admin = admin
        token, _ = self.register(phone, "Biznes Egasi")
        app_data = {**self.APPLICATION, "registration_number": reg, "business_name": name}
        r = self.c.post("/business/apply", json=app_data, headers=self.h(token))
        assert r.status_code == 201, r.text
        app_id = r.json()["application"]["id"]
        r = self.c.post(f"/admin/business-applications/{app_id}/approve", headers=self.h(admin))
        assert r.status_code == 200, r.text
        return token, admin


@pytest.fixture()
def api(client):
    return Api(client)
