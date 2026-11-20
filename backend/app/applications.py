"""Biznes arizasini tasdiqlash / rad etish mantig'i.
Ilovadagi admin paneli ham, Telegram bot ham aynan shu funksiyalardan foydalanadi."""
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import Business, BusinessApplication, User


class ApplicationError(Exception):
    def __init__(self, status_code: int, message: str):
        super().__init__(message)
        self.status_code = status_code
        self.message = message


def _pending(db: Session, application_id: int) -> BusinessApplication:
    application = db.query(BusinessApplication).filter(BusinessApplication.id == application_id).first()
    if not application:
        raise ApplicationError(404, "Ariza topilmadi!")
    if application.status != "pending":
        raise ApplicationError(400, "Bu ariza allaqachon ko'rib chiqilgan!")
    return application


def approve(db: Session, application_id: int) -> tuple[BusinessApplication, User, Business]:
    application = _pending(db, application_id)
    applicant = db.query(User).filter(User.id == application.applicant_id).first()
    if not applicant:
        raise ApplicationError(404, "Ariza egasi topilmadi!")
    if db.query(Business.id).filter(Business.owner_id == applicant.id).first():
        raise ApplicationError(409, "Bu foydalanuvchida allaqachon biznes mavjud!")

    business = Business(
        name=application.business_name,
        phone=application.business_phone,
        city=application.city,
        address=application.address,
        owner_id=applicant.id,
        business_type=application.business_type,
        registration_number=application.registration_number,
        application_id=application.id,
        description=application.description,
        verification_level="manual_review",
    )
    business.categories = list(application.categories)
    db.add(business)
    if applicant.role == "client":
        applicant.role = "business"
    application.status = "approved"
    application.rejection_reason = None
    try:
        db.commit()
        db.refresh(business)
        db.refresh(application)
    except IntegrityError:
        db.rollback()
        raise ApplicationError(400, "Biznesni tasdiqlashda xatolik yuz berdi!")
    return application, applicant, business


def reject(db: Session, application_id: int, reason: str) -> BusinessApplication:
    reason = (reason or "").strip()
    if len(reason) < 5:
        raise ApplicationError(422, "Rad etish sababi kamida 5 ta belgidan iborat bo'lsin")
    application = _pending(db, application_id)
    application.status = "rejected"
    application.rejection_reason = reason
    db.commit()
    db.refresh(application)
    return application
