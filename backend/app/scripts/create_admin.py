"""Admin yaratish yoki mavjud foydalanuvchini admin qilish.

Ishga tushirish (backend papkasida):  python -m app.scripts.create_admin
"""
import getpass
import sys

from app.database import SessionLocal
from app.models import User
from app.security import hash_password
from app.utils import normalize_phone


def main():
    phone = normalize_phone(input("Admin telefon raqami (998901234567): "))
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.phone == phone).first()
        if user:
            user.role = "admin"
            db.commit()
            print(f"'{user.full_name}' endi admin.")
            return
        name = input("To'liq ism: ").strip()
        password = getpass.getpass("Parol (kamida 8 belgi): ")
        if len(name) < 3 or len(password) < 8:
            print("Ism kamida 3, parol kamida 8 belgidan iborat bo'lsin.")
            sys.exit(1)
        db.add(User(full_name=name, phone=phone, hashed_password=hash_password(password), role="admin"))
        db.commit()
        print("Admin yaratildi.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
