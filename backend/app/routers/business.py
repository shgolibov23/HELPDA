from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import ai_review
from app.catalog import (
    business_dict,
    business_query,
    order_dict,
    service_dict,
    service_query,
    verification_dict,
)
from app.config import settings
from app.database import get_db
from app.deps import get_business_owner, get_current_user
from app.models import (
    AvailabilitySlot,
    Business,
    BusinessApplication,
    Category,
    Favorite,
    LoyaltyTransaction,
    Order,
    Review,
    Service,
    User,
)
from app.notifications import create_notification
from app.storage import read_pdf, remove_stored_file, save_private_pdf
from app.schemas import (
    BusinessApplicationSchema,
    BusinessUpdateSchema,
    OrderActionSchema,
    ReviewReplySchema,
    ServiceSchema,
)

router = APIRouter(prefix="/business", tags=["business"])

VERIFICATION_NOTE = (
    "Ariza admin tomonidan qo'lda ko'rib chiqiladi. "
    "Davlat reyestri bilan avtomatik tekshiruv hozircha mavjud emas."
)


def _application_dict(a: BusinessApplication) -> dict:
    return {
        "id": a.id,
        "business_name": a.business_name,
        "business_type": a.business_type,
        "registration_number": a.registration_number,
        "business_phone": a.business_phone,
        "city": a.city,
        "address": a.address,
        "applicant_position": a.applicant_position,
        "category_ids": [category.id for category in a.categories],
        "categories": [{"id": c.id, "name": c.name, "icon": c.icon} for c in a.categories],
        "description": a.description,
        "status": a.status,
        "rejection_reason": a.rejection_reason,
        "ai_status": a.ai_status,
        "ai_recommendation": a.ai_recommendation,
        "ai_confidence": a.ai_confidence,
        "ai_summary": a.ai_summary,
        "document_available": a.document_path is not None,
        "created_at": a.created_at,
        "verification_note": VERIFICATION_NOTE,
    }


def _create_application(
    data: BusinessApplicationSchema,
    document: bytes | None,
    background: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if db.query(Business).filter(Business.owner_id == current_user.id).first():
        raise HTTPException(409, "Sizda allaqachon biznes mavjud!")

    active = BusinessApplication.status.in_(["pending", "approved"])
    if db.query(BusinessApplication).filter(BusinessApplication.applicant_id == current_user.id, active).first():
        raise HTTPException(409, "Sizda allaqachon faol biznes arizasi mavjud!")
    if db.query(BusinessApplication).filter(
        BusinessApplication.registration_number == data.registration_number, active
    ).first():
        raise HTTPException(409, "Bu ro'yxat raqami bilan ariza allaqachon mavjud!")

    categories = db.query(Category).filter(Category.id.in_(data.category_ids)).all()
    if len(categories) != len(data.category_ids):
        raise HTTPException(400, "Tanlangan yo‘nalishlardan biri topilmadi.")
    application = BusinessApplication(
        applicant_id=current_user.id,
        status="pending",
        business_type=data.business_type,
        business_name=data.business_name.strip(),
        registration_number=data.registration_number,
        business_phone=data.business_phone,
        city=data.city.strip(),
        address=data.address.strip(),
        applicant_position=data.applicant_position.strip(),
        description=data.description.strip(),
        categories=categories,
        ai_status="pending" if settings.OPENAI_API_KEY else "not_configured",
    )
    if document:
        application.document_path = save_private_pdf(document)
    db.add(application)
    try:
        db.commit()
        db.refresh(application)
    except IntegrityError:
        db.rollback()
        if application.document_path:
            remove_stored_file(application.document_path)
        raise HTTPException(409, "Bu ariza yoki ro'yxat raqami allaqachon mavjud!")

    background.add_task(ai_review.review_and_notify, application.id)
    return {"message": "Biznes arizangiz yuborildi!", "application": _application_dict(application)}


@router.post("/apply", status_code=201)
def apply_for_business(
    data: BusinessApplicationSchema,
    background: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _create_application(data, None, background, current_user, db)


@router.post("/apply-with-document", status_code=201)
async def apply_for_business_with_document(
    background: BackgroundTasks,
    data: Annotated[BusinessApplicationSchema, Form()],
    document: UploadFile | None = File(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    pdf_content = await read_pdf(document)
    return _create_application(data, pdf_content, background, current_user, db)


@router.get("/my-application")
def get_my_business_application(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    application = (
        db.query(BusinessApplication)
        .filter(BusinessApplication.applicant_id == current_user.id)
        .order_by(BusinessApplication.id.desc())
        .first()
    )
    if not application:
        return {"message": "Siz hali biznes arizasi yubormagansiz!", "application": None}
    return {"application": _application_dict(application)}


@router.get("/me")
def my_business(ctx=Depends(get_business_owner), db: Session = Depends(get_db)):
    _, business = ctx
    query, _, _ = business_query(db)
    row = query.filter(Business.id == business.id).first()

    total = db.query(func.count(Service.id)).filter(Service.business_id == business.id).scalar()
    active = (
        db.query(func.count(Service.id))
        .filter(Service.business_id == business.id, Service.is_active.is_(True), Service.is_blocked.is_(False))
        .scalar()
    )
    by_status = dict(
        db.query(Order.status, func.count(Order.id)).filter(Order.business_id == business.id).group_by(Order.status).all()
    )
    since = datetime.now(timezone.utc) - timedelta(days=30)
    last_30_days = db.query(Order).filter(Order.business_id == business.id, Order.created_at >= since)
    orders_last_30_days = last_30_days.count()
    completed_last_30_days = last_30_days.filter(Order.status == "completed").count()
    revenue_last_30_days = (
        last_30_days.filter(Order.status == "completed")
        .with_entities(func.coalesce(func.sum(Order.price), 0))
        .scalar()
    )
    return {
        "business": business_dict(row),
        "stats": {
            "total_services": total,
            "active_services": active,
            "orders": {s: by_status.get(s, 0) for s in ("pending", "accepted", "rejected", "completed", "cancelled")},
            "total_orders": sum(by_status.values()),
            "orders_last_30_days": orders_last_30_days,
            "completed_last_30_days": completed_last_30_days,
            "revenue_last_30_days": float(revenue_last_30_days or 0),
        },
    }


@router.put("/me")
def update_my_business(
    data: BusinessUpdateSchema, ctx=Depends(get_business_owner), db: Session = Depends(get_db)
):
    _, business = ctx
    business.description = data.description.strip() if data.description else None
    business.phone = data.phone
    business.city = data.city.strip()
    business.address = data.address.strip()
    business.logo = data.logo
    if "working_hours" in data.model_fields_set:
        business.working_hours = data.working_hours.strip() if data.working_hours else None
    if "portfolio_images" in data.model_fields_set:
        business.portfolio_images = "\n".join(url for url in (data.portfolio_images or []) if url) or None
    if "maps_url" in data.model_fields_set:
        business.maps_url = data.maps_url
    if data.category_ids is not None:
        categories = db.query(Category).filter(Category.id.in_(data.category_ids)).all()
        if len(categories) != len(data.category_ids):
            raise HTTPException(400, "Tanlangan yo‘nalishlardan biri topilmadi.")
        category_ids = {category.id for category in categories}
        services_outside_categories = (
            db.query(Service.id)
            .filter(Service.business_id == business.id, Service.category_id.notin_(category_ids))
            .first()
        )
        if services_outside_categories:
            raise HTTPException(
                409,
                "Yo‘nalishni olib tashlashdan oldin shu yo‘nalishdagi xizmatlarni boshqa tanlangan yo‘nalishga o‘tkazing yoki o‘chiring.",
            )
        business.categories = categories
    db.commit()
    return {"message": "Biznes ma'lumotlari yangilandi!"}


# ---------- Xizmatlar ----------

def _own_service(db: Session, business: Business, service_id: int) -> Service:
    service = db.query(Service).filter(Service.id == service_id, Service.business_id == business.id).first()
    if not service:
        raise HTTPException(404, "Xizmat topilmadi!")
    return service


def _check_category(db: Session, business: Business, category_id: int):
    if not db.query(Category.id).filter(Category.id == category_id).first():
        raise HTTPException(400, "Kategoriya topilmadi!")
    if category_id not in {category.id for category in business.categories}:
        raise HTTPException(400, "Bu yo‘nalish biznes profilingizda tanlanmagan.")


@router.get("/services")
def my_services(ctx=Depends(get_business_owner), db: Session = Depends(get_db)):
    _, business = ctx
    q, _ = service_query(db)
    rows = q.filter(Service.business_id == business.id).order_by(Service.id.desc()).all()
    return [service_dict(r) for r in rows]


@router.get("/services/{service_id}")
def my_service(service_id: int, ctx=Depends(get_business_owner), db: Session = Depends(get_db)):
    _, business = ctx
    _own_service(db, business, service_id)
    q, _ = service_query(db)
    return service_dict(q.filter(Service.id == service_id).first())


@router.post("/services", status_code=201)
def create_service(data: ServiceSchema, ctx=Depends(get_business_owner), db: Session = Depends(get_db)):
    _, business = ctx
    _check_category(db, business, data.category_id)
    service = Service(
        name=data.name.strip(),
        description=data.description.strip() if data.description else None,
        price=data.price,
        category_id=data.category_id,
        image_url=data.image_url,
        business_id=business.id,
        is_active=True,
    )
    db.add(service)
    db.commit()
    db.refresh(service)
    return {"message": "Xizmat qo'shildi!", "id": service.id}


@router.put("/services/{service_id}")
def update_service(
    service_id: int, data: ServiceSchema, ctx=Depends(get_business_owner), db: Session = Depends(get_db)
):
    _, business = ctx
    service = _own_service(db, business, service_id)
    _check_category(db, business, data.category_id)
    service.name = data.name.strip()
    service.description = data.description.strip() if data.description else None
    service.price = data.price
    service.category_id = data.category_id
    service.image_url = data.image_url
    db.commit()
    return {"message": "Xizmat yangilandi!"}


@router.patch("/services/{service_id}/toggle")
def toggle_service(service_id: int, ctx=Depends(get_business_owner), db: Session = Depends(get_db)):
    _, business = ctx
    service = _own_service(db, business, service_id)
    service.is_active = not bool(service.is_active)
    db.commit()
    return {"is_active": service.is_active}


@router.delete("/services/{service_id}")
def delete_service(service_id: int, ctx=Depends(get_business_owner), db: Session = Depends(get_db)):
    _, business = ctx
    service = _own_service(db, business, service_id)
    # Buyurtmalar tarixda qoladi (xizmat nomi nusxalangan), qolganlari o'chadi
    db.query(Order).filter(Order.service_id == service.id).update({Order.service_id: None})
    db.query(Favorite).filter(Favorite.service_id == service.id).delete()
    db.query(Review).filter(Review.service_id == service.id).delete()
    db.delete(service)
    db.commit()
    return {"message": "Xizmat o'chirildi!"}


# ---------- Buyurtmalar ----------

@router.get("/orders")
def business_orders(
    status: str | None = Query(None, pattern="^(pending|accepted|rejected|completed|cancelled)$"),
    ctx=Depends(get_business_owner),
    db: Session = Depends(get_db),
):
    _, business = ctx
    q = db.query(Order, User).join(User, Order.customer_id == User.id).filter(Order.business_id == business.id)
    if status:
        q = q.filter(Order.status == status)
    rows = q.order_by(Order.id.desc()).limit(200).all()
    return [order_dict(o, customer=u) | {"customer_phone": o.contact_phone} for o, u in rows]


@router.patch("/orders/{order_id}")
def order_action(
    order_id: int, data: OrderActionSchema, ctx=Depends(get_business_owner), db: Session = Depends(get_db)
):
    _, business = ctx
    order = db.query(Order).filter(Order.id == order_id, Order.business_id == business.id).first()
    if not order:
        raise HTTPException(404, "Buyurtma topilmadi!")

    if data.action == "accept" and order.status == "pending":
        if data.deadline_at and data.deadline_at <= datetime.now(timezone.utc):
            raise HTTPException(422, "Bajarish muddati kelajakda bo‘lishi kerak.")
        if data.final_price is not None:
            order.price = data.final_price
        if data.agreed_scope is not None:
            order.agreed_scope = data.agreed_scope.strip()
        elif not order.agreed_scope:
            order.agreed_scope = order.message or f"Xizmat: {order.service_name}"
        if data.deadline_at is not None:
            order.deadline_at = data.deadline_at
        order.status = "accepted"
        if order.booking_slot_id:
            slot = db.get(AvailabilitySlot, order.booking_slot_id)
            if slot and slot.status == "reserved":
                slot.status = "booked"
    elif data.action == "reject" and order.status == "pending":
        if not data.reason or len(data.reason.strip()) < 3:
            raise HTTPException(422, "Rad etish sababini yozing")
        order.status = "rejected"
        order.rejection_reason = data.reason.strip()
        if order.booking_slot_id:
            slot = db.get(AvailabilitySlot, order.booking_slot_id)
            if slot and slot.status == "reserved":
                slot.status = "available"
    elif data.action == "complete" and order.status == "accepted":
        order.status = "completed"
        points = int(max(order.price or 0, 0) // 10_000)
        if points:
            already_earned = db.query(LoyaltyTransaction.id).filter(
                LoyaltyTransaction.order_id == order.id,
                LoyaltyTransaction.kind == "earn",
            ).first()
            if not already_earned:
                db.add(LoyaltyTransaction(user_id=order.customer_id, order_id=order.id, points=points, kind="earn"))
                create_notification(
                    db,
                    order.customer_id,
                    "loyalty",
                    "Sodiqlik ballari qo‘shildi",
                    f"Buyurtma yakunlandi: {points} ball hisobingizga qo‘shildi.",
                    order.id,
                )
    else:
        raise HTTPException(400, "Bu buyurtma holatida bu amalni bajarib bo'lmaydi!")
    status_text = {
        "accepted": "qabul qilindi",
        "rejected": "rad etildi",
        "completed": "yakunlandi",
    }[order.status]
    create_notification(
        db,
        order.customer_id,
        "order",
        "Buyurtma holati yangilandi",
        f"“{order.service_name}” buyurtmangiz {status_text}.",
        order.id,
    )
    db.commit()
    return {"message": "Buyurtma yangilandi!", "status": order.status}


@router.patch("/reviews/{review_id}/reply")
def reply_to_review(
    review_id: int,
    data: ReviewReplySchema,
    ctx=Depends(get_business_owner),
    db: Session = Depends(get_db),
):
    _, business = ctx
    review = (
        db.query(Review)
        .filter(Review.id == review_id, Review.business_id == business.id)
        .first()
    )
    if not review:
        raise HTTPException(404, "Sharh topilmadi.")
    review.business_response = data.response.strip()
    review.business_response_at = datetime.now(timezone.utc)
    create_notification(
        db,
        review.user_id,
        "review_reply",
        "Biznes sharhingizga javob berdi",
        f"“{business.name}” biznesi sharhingizga javob yozdi.",
    )
    db.commit()
    return {"message": "Javob saqlandi."}
