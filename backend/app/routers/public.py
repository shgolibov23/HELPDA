from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.catalog import (
    business_dict,
    business_query,
    public_service_query,
    service_dict,
    services_response,
    favorite_ids,
)
from app.database import get_db
from app.deps import get_current_user, get_optional_user
from app.models import Business, Category, ContentReport, Order, Review, Service, User
from app.schemas import ContentReportSchema, ReviewSchema

router = APIRouter(tags=["catalog"])


@router.post("/reports", status_code=201)
def create_report(
    data: ContentReportSchema,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if (data.service_id is None) == (data.business_id is None):
        raise HTTPException(422, "Xizmat yoki biznesdan bittasini tanlang.")
    if data.service_id is not None:
        service = db.query(Service).filter(Service.id == data.service_id).first()
        if not service:
            raise HTTPException(404, "Xizmat topilmadi.")
        business = db.get(Business, service.business_id)
        if business and business.owner_id == user.id:
            raise HTTPException(400, "O‘z xizmatingiz haqida shikoyat yubora olmaysiz.")
        filters = (ContentReport.service_id == data.service_id,)
    else:
        business = db.query(Business).filter(Business.id == data.business_id).first()
        if not business or not business.is_active:
            raise HTTPException(404, "Biznes topilmadi.")
        if business.owner_id == user.id:
            raise HTTPException(400, "O‘z biznesingiz haqida shikoyat yubora olmaysiz.")
        filters = (ContentReport.business_id == data.business_id,)
    exists = (
        db.query(ContentReport.id)
        .filter(ContentReport.reporter_id == user.id, ContentReport.status == "pending", *filters)
        .first()
    )
    if exists:
        raise HTTPException(409, "Bu obyekt bo‘yicha shikoyatingiz ko‘rib chiqilmoqda.")
    report = ContentReport(
        reporter_id=user.id,
        service_id=data.service_id,
        business_id=data.business_id,
        reason=data.reason,
    )
    db.add(report)
    db.commit()
    return {"message": "Shikoyatingiz adminlarga yuborildi.", "id": report.id}


@router.get("/categories")
def get_categories(db: Session = Depends(get_db)):
    cats = db.query(Category).order_by(Category.id).all()
    return [{"id": c.id, "name": c.name, "icon": c.icon} for c in cats]


@router.get("/services")
def list_services(
    q: str | None = Query(None, max_length=100),
    category_id: int | None = None,
    city: str | None = Query(None, max_length=100),
    min_price: float | None = Query(None, ge=0),
    max_price: float | None = Query(None, ge=0),
    sort: str = Query("newest", pattern="^(newest|price_asc|price_desc|rating)$"),
    limit: int = Query(20, ge=1, le=50),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    query, rsq = public_service_query(db)
    if q and q.strip():
        like = f"%{q.strip()}%"
        query = query.filter(
            or_(Service.name.ilike(like), Service.description.ilike(like), Business.name.ilike(like))
        )
    if category_id:
        query = query.filter(Service.category_id == category_id)
    if city and city.strip():
        query = query.filter(Business.city.ilike(city.strip()))
    if min_price is not None:
        query = query.filter(Service.price >= min_price)
    if max_price is not None:
        query = query.filter(Service.price <= max_price)

    total = query.count()
    if sort == "price_asc":
        query = query.order_by(Service.price.asc(), Service.id.desc())
    elif sort == "price_desc":
        query = query.order_by(Service.price.desc(), Service.id.desc())
    elif sort == "rating":
        query = query.order_by(func.coalesce(rsq.c.avg, 0).desc(), rsq.c.cnt.desc().nullslast(), Service.id.desc())
    else:
        query = query.order_by(Service.id.desc())

    rows = query.limit(limit).offset(offset).all()
    return {"total": total, "items": services_response(db, rows, user)}


@router.get("/services/{service_id}")
def service_detail(
    service_id: int,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    query, _ = public_service_query(db)
    row = query.filter(Service.id == service_id).first()
    if not row:
        raise HTTPException(404, "Xizmat topilmadi!")
    return services_response(db, [row], user)[0]


def _reviews_list(db: Session, *conds) -> list[dict]:
    rows = (
        db.query(Review, User.full_name)
        .join(User, Review.user_id == User.id)
        .filter(*conds)
        .order_by(Review.id.desc())
        .limit(50)
        .all()
    )
    out = []
    for r, name in rows:
        parts = name.split()
        short = parts[0] + (f" {parts[-1][0]}." if len(parts) > 1 else "")
        out.append(
            {
                "id": r.id,
                "rating": r.rating,
                "comment": r.comment,
                "business_response": r.business_response,
                "business_response_at": r.business_response_at,
                "user_name": short,
                "created_at": r.created_at,
            }
        )
    return out


@router.get("/services/{service_id}/reviews")
def service_reviews(service_id: int, db: Session = Depends(get_db)):
    return _reviews_list(db, Review.service_id == service_id)


@router.get("/services/{service_id}/review-eligibility")
def review_eligibility(
    service_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    done = (
        db.query(Order.id)
        .filter(Order.service_id == service_id, Order.customer_id == user.id, Order.status == "completed")
        .first()
    )
    already = db.query(Review.id).filter(Review.service_id == service_id, Review.user_id == user.id).first()
    return {"can_review": bool(done) and not already, "has_reviewed": bool(already)}


@router.post("/services/{service_id}/reviews", status_code=201)
def create_review(
    service_id: int,
    data: ReviewSchema,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    service = db.query(Service).filter(Service.id == service_id).first()
    if not service:
        raise HTTPException(404, "Xizmat topilmadi!")
    done = (
        db.query(Order.id)
        .filter(Order.service_id == service_id, Order.customer_id == user.id, Order.status == "completed")
        .first()
    )
    if not done:
        raise HTTPException(403, "Sharh qoldirish uchun avval buyurtma yakunlangan bo'lishi kerak!")
    if db.query(Review.id).filter(Review.service_id == service_id, Review.user_id == user.id).first():
        raise HTTPException(409, "Siz bu xizmatga allaqachon sharh qoldirgansiz!")

    comment = data.comment.strip() if data.comment else None
    review = Review(
        user_id=user.id,
        service_id=service_id,
        business_id=service.business_id,
        rating=data.rating,
        comment=comment or None,
    )
    db.add(review)
    db.commit()
    return {"message": "Sharhingiz uchun rahmat!", "id": review.id}


@router.get("/businesses")
def list_businesses(
    q: str | None = Query(None, max_length=100),
    city: str | None = Query(None, max_length=100),
    limit: int = Query(20, ge=1, le=50),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    query, rsq, _ = business_query(db)
    query = query.filter(Business.is_active.is_(True))
    if q and q.strip():
        query = query.filter(Business.name.ilike(f"%{q.strip()}%"))
    if city and city.strip():
        query = query.filter(Business.city.ilike(city.strip()))
    rows = query.order_by(func.coalesce(rsq.c.avg, 0).desc(), Business.id.desc()).limit(limit).offset(offset).all()
    return [business_dict(r) for r in rows]


@router.get("/businesses/{business_id}")
def business_detail(
    business_id: int,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    query, _, _ = business_query(db)
    row = query.filter(Business.id == business_id, Business.is_active.is_(True)).first()
    if not row:
        raise HTTPException(404, "Biznes topilmadi!")
    sq, _ = public_service_query(db)
    srows = sq.filter(Service.business_id == business_id).order_by(Service.id.desc()).all()
    return {
        "business": business_dict(row),
        "services": services_response(db, srows, user),
        "reviews": _reviews_list(db, Review.business_id == business_id),
    }


@router.get("/home")
def home_feed(db: Session = Depends(get_db), user: User | None = Depends(get_optional_user)):
    q1, rsq = public_service_query(db)
    popular = (
        q1.filter(rsq.c.cnt.isnot(None))
        .order_by(func.coalesce(rsq.c.avg, 0).desc(), rsq.c.cnt.desc(), Service.id.desc())
        .limit(8)
        .all()
    )
    q2, _ = public_service_query(db)
    recent = q2.order_by(Service.id.desc()).limit(8).all()

    bq, brsq, _ = business_query(db)
    featured = bq.filter(Business.is_active.is_(True), Business.is_featured.is_(True)).order_by(Business.id.desc()).limit(10).all()
    bq2, brsq2, bssq2 = business_query(db)
    recommended = (
        bq2.filter(Business.is_active.is_(True), bssq2.c.scnt.isnot(None))
        .order_by(func.coalesce(brsq2.c.avg, 0).desc(), Business.id.desc())
        .limit(10)
        .all()
    )
    return {
        "popular": services_response(db, popular, user),
        "recent": services_response(db, recent, user),
        "featured_businesses": [business_dict(r) for r in featured],
        "recommended_businesses": [business_dict(r) for r in recommended],
    }
