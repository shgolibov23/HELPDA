"""Xizmat va bizneslarni qidirish hamda javob shakllari uchun umumiy funksiyalar."""
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import Business, Category, Favorite, Order, Review, Service, User


def user_dict(u: User) -> dict:
    return {
        "id": u.id,
        "full_name": u.full_name,
        "phone": u.phone,
        "email": u.email,
        "role": u.role,
        "avatar_url": u.avatar_url,
    }


def verification_dict(b: Business) -> dict:
    return {
        "level": b.verification_level,
        "registry_verified": b.verification_level == "registry_verified",
    }


def service_query(db: Session):
    rsq = (
        db.query(
            Review.service_id.label("sid"),
            func.avg(Review.rating).label("avg"),
            func.count(Review.id).label("cnt"),
        )
        .group_by(Review.service_id)
        .subquery()
    )
    q = (
        db.query(Service, Business, Category, rsq.c.avg, rsq.c.cnt)
        .join(Business, Service.business_id == Business.id)
        .outerjoin(Category, Service.category_id == Category.id)
        .outerjoin(rsq, rsq.c.sid == Service.id)
    )
    return q, rsq


def public_service_query(db: Session):
    q, rsq = service_query(db)
    q = q.filter(
        Service.is_active.is_(True),
        Service.is_blocked.is_(False),
        Business.is_active.is_(True),
    )
    return q, rsq


def service_dict(row, fav_ids: set | None = None) -> dict:
    s, b, c, avg, cnt = row
    return {
        "id": s.id,
        "name": s.name,
        "description": s.description,
        "price": s.price or 0,
        "image_url": s.image_url,
        "is_active": bool(s.is_active),
        "is_blocked": bool(s.is_blocked),
        "created_at": s.created_at,
        "category": {"id": c.id, "name": c.name, "icon": c.icon} if c else None,
        "business": {
            "id": b.id,
            "name": b.name,
            "logo": b.logo,
            "city": b.city,
            "address": b.address,
            "phone": b.phone,
            "verification": verification_dict(b),
        },
        "rating": round(float(avg), 1) if avg is not None else None,
        "review_count": int(cnt or 0),
        "is_favorite": (s.id in fav_ids) if fav_ids is not None else False,
    }


def favorite_ids(db: Session, user: User | None, service_ids: list[int]) -> set | None:
    if user is None:
        return None
    if not service_ids:
        return set()
    rows = (
        db.query(Favorite.service_id)
        .filter(Favorite.user_id == user.id, Favorite.service_id.in_(service_ids))
        .all()
    )
    return {r[0] for r in rows}


def services_response(db: Session, rows, user: User | None) -> list[dict]:
    fav = favorite_ids(db, user, [r[0].id for r in rows])
    return [service_dict(r, fav) for r in rows]


def business_query(db: Session):
    rsq = (
        db.query(
            Review.business_id.label("bid"),
            func.avg(Review.rating).label("avg"),
            func.count(Review.id).label("cnt"),
        )
        .group_by(Review.business_id)
        .subquery()
    )
    ssq = (
        db.query(Service.business_id.label("bid"), func.count(Service.id).label("scnt"))
        .filter(Service.is_active.is_(True), Service.is_blocked.is_(False))
        .group_by(Service.business_id)
        .subquery()
    )
    q = (
        db.query(Business, rsq.c.avg, rsq.c.cnt, ssq.c.scnt)
        .outerjoin(rsq, rsq.c.bid == Business.id)
        .outerjoin(ssq, ssq.c.bid == Business.id)
    )
    return q, rsq, ssq


def business_dict(row) -> dict:
    b, avg, cnt, scnt = row
    return {
        "id": b.id,
        "name": b.name,
        "description": b.description,
        "working_hours": b.working_hours,
        "portfolio_images": [url for url in (b.portfolio_images or "").splitlines() if url],
        "maps_url": b.maps_url,
        "logo": b.logo,
        "phone": b.phone,
        "city": b.city,
        "address": b.address,
        "business_type": b.business_type,
        "categories": [{"id": c.id, "name": c.name, "icon": c.icon} for c in b.categories],
        "is_featured": bool(b.is_featured),
        "is_active": bool(b.is_active),
        "verification": verification_dict(b),
        "rating": round(float(avg), 1) if avg is not None else None,
        "review_count": int(cnt or 0),
        "services_count": int(scnt or 0),
        "created_at": b.created_at,
    }


def order_dict(o: Order, business: Business | None = None, customer: User | None = None) -> dict:
    d = {
        "id": o.id,
        "service_id": o.service_id,
        "service_name": o.service_name,
        "price": o.price or 0,
        "original_price": o.original_price if o.original_price is not None else (o.price or 0),
        "discount_amount": o.discount_amount or 0,
        "redeemed_points": o.redeemed_points or 0,
        "booking_slot_id": o.booking_slot_id,
        "agreed_scope": o.agreed_scope,
        "deadline_at": o.deadline_at,
        "status": o.status,
        "message": o.message,
        "contact_phone": o.contact_phone,
        "address": o.address,
        "rejection_reason": o.rejection_reason,
        "created_at": o.created_at,
        "updated_at": o.updated_at,
    }
    if business is not None:
        d["business"] = {"id": business.id, "name": business.name, "phone": business.phone}
    if customer is not None:
        d["customer"] = {"id": customer.id, "full_name": customer.full_name}
    return d
