from datetime import datetime, timedelta, timezone
from pathlib import Path

import jwt
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import applications, telegram
from app.applications import ApplicationError
from app.catalog import business_dict, business_query, service_dict, service_query
from app.database import get_db
from app.config import settings
from app.deps import get_admin_user
from app.models import Business, BusinessApplication, ContentReport, Order, Review, Service, User
from app.schemas import ActiveSchema, BlockSchema, BusinessRejectionSchema, ContentReportResolveSchema, FeaturedSchema
from app.storage import PRIVATE_DOCUMENT_DIR

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/stats")
def stats(admin: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    def grouped(col, model):
        return dict(db.query(col, func.count(model.id)).group_by(col).all())

    apps = grouped(BusinessApplication.status, BusinessApplication)
    orders = grouped(Order.status, Order)
    return {
        "users": db.query(func.count(User.id)).scalar(),
        "businesses": db.query(func.count(Business.id)).scalar(),
        "services": db.query(func.count(Service.id)).scalar(),
        "blocked_services": db.query(func.count(Service.id)).filter(Service.is_blocked.is_(True)).scalar(),
        "reviews": db.query(func.count(Review.id)).scalar(),
        "applications": {s: apps.get(s, 0) for s in ("pending", "approved", "rejected")},
        "orders": {s: orders.get(s, 0) for s in ("pending", "accepted", "rejected", "completed", "cancelled")},
        "orders_last_30_days": db.query(func.count(Order.id)).filter(Order.created_at >= datetime.now(timezone.utc) - timedelta(days=30)).scalar(),
    }


@router.get("/reports")
def list_reports(
    status: str = Query("pending", pattern="^(pending|resolved|dismissed)$"),
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(ContentReport, User.full_name, Service.name, Business.name)
        .join(User, ContentReport.reporter_id == User.id)
        .outerjoin(Service, ContentReport.service_id == Service.id)
        .outerjoin(Business, ContentReport.business_id == Business.id)
        .filter(ContentReport.status == status)
        .order_by(ContentReport.id.desc())
        .limit(200)
        .all()
    )
    return [
        {
            "id": report.id,
            "reporter_name": reporter_name,
            "service_id": report.service_id,
            "service_name": service_name,
            "business_id": report.business_id,
            "business_name": business_name,
            "reason": report.reason,
            "status": report.status,
            "admin_note": report.admin_note,
            "created_at": report.created_at,
        }
        for report, reporter_name, service_name, business_name in rows
    ]


@router.patch("/reports/{report_id}")
def resolve_report(
    report_id: int,
    data: ContentReportResolveSchema,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    report = db.query(ContentReport).filter(ContentReport.id == report_id).first()
    if not report:
        raise HTTPException(404, "Shikoyat topilmadi.")
    if report.status != "pending":
        raise HTTPException(409, "Bu shikoyat avval ko‘rib chiqilgan.")
    report.status = data.status
    report.admin_note = data.admin_note.strip() if data.admin_note else None
    report.resolved_at = datetime.now(timezone.utc)
    db.commit()
    return {"id": report.id, "status": report.status}


@router.get("/business-applications")
def list_applications(
    status: str | None = Query(None, pattern="^(pending|approved|rejected)$"),
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    q = db.query(BusinessApplication, User).join(User, BusinessApplication.applicant_id == User.id)
    if status:
        q = q.filter(BusinessApplication.status == status)
    rows = q.order_by(BusinessApplication.id.desc()).limit(200).all()
    return [
        {
            "id": a.id,
            "applicant_name": u.full_name,
            "applicant_phone": u.phone,
            "business_type": a.business_type,
            "business_name": a.business_name,
            "registration_number": a.registration_number,
            "business_phone": a.business_phone,
            "city": a.city,
            "address": a.address,
            "applicant_position": a.applicant_position,
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
            "verification_note": "Faqat qo'lda ko'rib chiqish. Davlat reyestri tekshiruvi o'tkazilmagan.",
        }
        for a, u in rows
    ]


@router.get("/business-applications/{application_id}/document-link")
def application_document_link(
    application_id: int,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    application = db.get(BusinessApplication, application_id)
    if not application or not application.document_path:
        raise HTTPException(404, "Ariza hujjati topilmadi.")
    token = jwt.encode(
        {
            "sub": str(admin.id),
            "scope": "business_application_document",
            "application_id": application.id,
            "exp": datetime.now(timezone.utc) + timedelta(minutes=3),
        },
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )
    return {"url": f"/admin/business-applications/{application.id}/document?token={token}"}


@router.get("/business-applications/{application_id}/document")
def application_document(
    application_id: int,
    token: str = Query(..., min_length=20, max_length=2048),
    db: Session = Depends(get_db),
):
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        admin_id = int(payload["sub"])
        if payload.get("scope") != "business_application_document" or payload.get("application_id") != application_id:
            raise HTTPException(403, "Hujjat havolasi noto‘g‘ri.")
    except jwt.InvalidTokenError as exc:
        raise HTTPException(401, "Hujjat havolasi eskirgan. Qayta urinib ko‘ring.") from exc
    admin = db.get(User, admin_id)
    application = db.get(BusinessApplication, application_id)
    if not admin or admin.role != "admin" or not admin.is_active:
        raise HTTPException(403, "Ruxsat yo‘q.")
    if not application or not application.document_path:
        raise HTTPException(404, "Ariza hujjati topilmadi.")
    filename = Path(application.document_path).name
    document = (PRIVATE_DOCUMENT_DIR / filename).resolve()
    if not document.is_relative_to(PRIVATE_DOCUMENT_DIR.resolve()) or not document.is_file():
        raise HTTPException(404, "Ariza hujjati topilmadi.")
    return FileResponse(
        document,
        media_type="application/pdf",
        filename=f"biznes-ariza-{application_id}.pdf",
        headers={"Cache-Control": "private, no-store"},
    )


@router.post("/business-applications/{application_id}/approve")
def approve_application(
    application_id: int,
    background: BackgroundTasks,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    try:
        application, applicant, business = applications.approve(db, application_id)
    except ApplicationError as e:
        raise HTTPException(e.status_code, e.message)
    background.add_task(telegram.notify_decision, application.id, admin.full_name)
    return {
        "message": "Biznes muvaffaqiyatli tasdiqlandi!",
        "business_id": business.id,
        "business_name": business.name,
        "owner_id": applicant.id,
        "status": application.status,
    }


@router.post("/business-applications/{application_id}/reject")
def reject_application(
    application_id: int,
    data: BusinessRejectionSchema,
    background: BackgroundTasks,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    try:
        application = applications.reject(db, application_id, data.reason)
    except ApplicationError as e:
        raise HTTPException(e.status_code, e.message)
    background.add_task(telegram.notify_decision, application.id, admin.full_name)
    return {
        "message": "Biznes arizasi rad etildi!",
        "application_id": application.id,
        "status": application.status,
        "reason": application.rejection_reason,
    }


@router.get("/users")
def list_users(
    q: str | None = Query(None, max_length=100),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    query = db.query(User)
    if q and q.strip():
        like = f"%{q.strip()}%"
        query = query.filter(or_(User.full_name.ilike(like), User.phone.ilike(like)))
    total = query.count()
    users = query.order_by(User.id.desc()).limit(limit).offset(offset).all()
    return {
        "total": total,
        "items": [
            {
                "id": u.id,
                "full_name": u.full_name,
                "phone": u.phone,
                "email": u.email,
                "role": u.role,
                "is_active": bool(u.is_active),
                "created_at": u.created_at,
            }
            for u in users
        ],
    }


@router.patch("/users/{user_id}/active")
def set_user_active(
    user_id: int, data: ActiveSchema, admin: User = Depends(get_admin_user), db: Session = Depends(get_db)
):
    if user_id == admin.id:
        raise HTTPException(400, "O'zingizni bloklab bo'lmaydi!")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "Foydalanuvchi topilmadi!")
    user.is_active = data.is_active
    db.commit()
    return {"id": user.id, "is_active": user.is_active}


@router.get("/businesses")
def list_businesses(admin: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    q, _, _ = business_query(db)
    rows = q.order_by(Business.id.desc()).limit(200).all()
    return [business_dict(r) for r in rows]


@router.patch("/businesses/{business_id}/active")
def set_business_active(
    business_id: int, data: ActiveSchema, admin: User = Depends(get_admin_user), db: Session = Depends(get_db)
):
    business = db.query(Business).filter(Business.id == business_id).first()
    if not business:
        raise HTTPException(404, "Biznes topilmadi!")
    business.is_active = data.is_active
    db.commit()
    return {"id": business.id, "is_active": business.is_active}


@router.patch("/businesses/{business_id}/featured")
def set_business_featured(
    business_id: int, data: FeaturedSchema, admin: User = Depends(get_admin_user), db: Session = Depends(get_db)
):
    business = db.query(Business).filter(Business.id == business_id).first()
    if not business:
        raise HTTPException(404, "Biznes topilmadi!")
    business.is_featured = data.is_featured
    db.commit()
    return {"id": business.id, "is_featured": business.is_featured}


@router.get("/services")
def list_services(admin: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    q, _ = service_query(db)
    rows = q.order_by(Service.id.desc()).limit(200).all()
    return [service_dict(r) for r in rows]


@router.patch("/services/{service_id}/block")
def block_service(
    service_id: int, data: BlockSchema, admin: User = Depends(get_admin_user), db: Session = Depends(get_db)
):
    service = db.query(Service).filter(Service.id == service_id).first()
    if not service:
        raise HTTPException(404, "Xizmat topilmadi!")
    service.is_blocked = data.is_blocked
    db.commit()
    return {"id": service.id, "is_blocked": service.is_blocked}
