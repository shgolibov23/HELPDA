from datetime import datetime, timezone
import math

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.catalog import order_dict
from app.database import get_db
from app.deps import get_current_user
from app.models import (
    AppNotification,
    AvailabilitySlot,
    Business,
    Coupon,
    CouponRedemption,
    Favorite,
    LoyaltyTransaction,
    Order,
    Service,
    User,
)
from app.catalog import favorite_ids, public_service_query, services_response
from app.notifications import create_notification, mark_read
from app.schemas import OrderCreateSchema

router = APIRouter(tags=["orders"])


@router.post("/orders", status_code=201)
def create_order(
    data: OrderCreateSchema, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    row = (
        db.query(Service, Business)
        .join(Business, Service.business_id == Business.id)
        .filter(
            Service.id == data.service_id,
            Service.is_active.is_(True),
            Service.is_blocked.is_(False),
            Business.is_active.is_(True),
        )
        .first()
    )
    if not row:
        raise HTTPException(404, "Xizmat topilmadi yoki hozir mavjud emas!")
    service, business = row
    if business.owner_id == user.id:
        raise HTTPException(400, "O'zingizning xizmatingizga buyurtma bera olmaysiz!")
    if user.role != "client":
        raise HTTPException(403, "Buyurtmani faqat mijozlar yuborishi mumkin.")

    pending = (
        db.query(Order.id)
        .filter(Order.customer_id == user.id, Order.service_id == service.id, Order.status.in_(["pending", "accepted"]))
        .first()
    )
    if pending:
        raise HTTPException(409, "Bu xizmatga sizda faol buyurtma mavjud!")

    slot = None
    if data.booking_slot_id is not None:
        slot = (
            db.query(AvailabilitySlot)
            .filter(
                AvailabilitySlot.id == data.booking_slot_id,
                AvailabilitySlot.business_id == business.id,
                AvailabilitySlot.status == "available",
                AvailabilitySlot.starts_at > datetime.now(timezone.utc),
            )
            .with_for_update()
            .first()
        )
        if not slot:
            raise HTTPException(409, "Tanlangan vaqt band yoki mavjud emas.")

    original_price = float(service.price or 0)
    discount = 0.0
    coupon = None
    if data.coupon_code:
        coupon = (
            db.query(Coupon)
            .filter(
                Coupon.business_id == business.id,
                Coupon.code == data.coupon_code.strip().upper(),
                Coupon.is_active.is_(True),
            )
            .with_for_update()
            .first()
        )
        now = datetime.now(timezone.utc)
        if not coupon or coupon.starts_at and coupon.starts_at > now or coupon.ends_at and coupon.ends_at <= now:
            raise HTTPException(400, "Kupon yaroqsiz yoki amal qilish muddati tugagan.")
        if db.query(CouponRedemption.id).filter(CouponRedemption.coupon_id == coupon.id, CouponRedemption.user_id == user.id).first():
            raise HTTPException(409, "Bu kuponni avval ishlatgansiz.")
        used = db.query(CouponRedemption.id).filter(CouponRedemption.coupon_id == coupon.id).count()
        if coupon.max_redemptions is not None and used >= coupon.max_redemptions:
            raise HTTPException(409, "Kupon ishlatish limiti tugagan.")
        coupon_discount = original_price * coupon.value / 100 if coupon.discount_type == "percent" else coupon.value
        discount = min(original_price, coupon_discount)

    redeemed_points = 0
    if data.redeem_points:
        balance = int(
            db.query(func.coalesce(func.sum(LoyaltyTransaction.points), 0))
            .filter(LoyaltyTransaction.user_id == user.id)
            .scalar()
            or 0
        )
        redeem_cap = int(original_price * 0.2 / 100)
        redeemed_points = min(max(balance, 0), redeem_cap)
        discount = min(original_price, discount + redeemed_points * 100)

    order = Order(
        service_id=service.id,
        service_name=service.name,
        price=max(0, original_price - discount),
        original_price=original_price,
        discount_amount=discount,
        redeemed_points=redeemed_points,
        booking_slot_id=slot.id if slot else None,
        customer_id=user.id,
        business_id=business.id,
        message=data.message.strip() if data.message else None,
        contact_phone=data.contact_phone or user.phone,
        address=data.address.strip() if data.address else None,
        status="pending",
    )
    db.add(order)
    db.flush()
    if slot:
        slot.status = "reserved"
    if coupon:
        db.add(
            CouponRedemption(
                coupon_id=coupon.id,
                user_id=user.id,
                order_id=order.id,
                discount_amount=min(original_price, original_price * coupon.value / 100 if coupon.discount_type == "percent" else coupon.value),
            )
        )
    if redeemed_points:
        db.add(
            LoyaltyTransaction(
                user_id=user.id,
                order_id=order.id,
                points=-redeemed_points,
                kind="redeem",
            )
        )
    create_notification(
        db,
        business.owner_id,
        "order",
        "Yangi buyurtma",
        f"{user.full_name} “{service.name}” xizmatiga buyurtma berdi.",
        order.id,
    )
    db.commit()
    db.refresh(order)
    return {"message": "Buyurtmangiz yuborildi!", "order": order_dict(order, business)}


@router.get("/orders/my")
def my_orders(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = (
        db.query(Order, Business)
        .join(Business, Order.business_id == Business.id)
        .filter(Order.customer_id == user.id)
        .order_by(Order.id.desc())
        .limit(200)
        .all()
    )
    return [order_dict(o, b) for o, b in rows]


@router.post("/orders/{order_id}/cancel")
def cancel_order(order_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id, Order.customer_id == user.id).first()
    if not order:
        raise HTTPException(404, "Buyurtma topilmadi!")
    if order.status not in ("pending", "accepted"):
        raise HTTPException(400, "Bu buyurtmani bekor qilib bo'lmaydi!")
    order.status = "cancelled"
    if order.booking_slot_id:
        slot = db.get(AvailabilitySlot, order.booking_slot_id)
        if slot and slot.status in ("reserved", "booked"):
            slot.status = "available" if slot.starts_at > datetime.now(timezone.utc) else "cancelled"
    if order.status == "cancelled":
        db.query(CouponRedemption).filter(CouponRedemption.order_id == order.id).delete()
    if order.redeemed_points:
        db.add(
            LoyaltyTransaction(
                user_id=order.customer_id,
                order_id=order.id,
                points=order.redeemed_points,
                kind="refund",
            )
        )
    business = db.get(Business, order.business_id)
    if business:
        create_notification(
            db,
            business.owner_id,
            "order",
            "Buyurtma bekor qilindi",
            f"Mijoz “{order.service_name}” buyurtmasini bekor qildi.",
            order.id,
        )
    db.commit()
    return {"message": "Buyurtma bekor qilindi!", "status": order.status}


@router.get("/notifications")
def list_notifications(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = (
        db.query(AppNotification)
        .filter(AppNotification.user_id == user.id)
        .order_by(AppNotification.id.desc())
        .limit(100)
        .all()
    )
    unread_count = (
        db.query(AppNotification.id)
        .filter(AppNotification.user_id == user.id, AppNotification.read_at.is_(None))
        .count()
    )
    return {
        "unread_count": unread_count,
        "items": [
            {
                "id": item.id,
                "kind": item.kind,
                "title": item.title,
                "message": item.message,
                "order_id": item.order_id,
                "read_at": item.read_at,
                "created_at": item.created_at,
            }
            for item in rows
        ],
    }


@router.post("/notifications/{notification_id}/read")
def read_notification(
    notification_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    item = (
        db.query(AppNotification)
        .filter(AppNotification.id == notification_id, AppNotification.user_id == user.id)
        .first()
    )
    if not item:
        raise HTTPException(404, "Bildirishnoma topilmadi.")
    mark_read(item)
    db.commit()
    return {"read": True}


# ---------- Sevimlilar ----------

@router.get("/favorites")
def list_favorites(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    q, _ = public_service_query(db)
    ids = [r[0] for r in db.query(Favorite.service_id).filter(Favorite.user_id == user.id).all()]
    if not ids:
        return []
    rows = q.filter(Service.id.in_(ids)).order_by(Service.id.desc()).all()
    return services_response(db, rows, user)


@router.post("/favorites/{service_id}", status_code=201)
def add_favorite(service_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not db.query(Service.id).filter(Service.id == service_id).first():
        raise HTTPException(404, "Xizmat topilmadi!")
    if not db.query(Favorite.id).filter(Favorite.user_id == user.id, Favorite.service_id == service_id).first():
        db.add(Favorite(user_id=user.id, service_id=service_id))
        db.commit()
    return {"is_favorite": True}


@router.delete("/favorites/{service_id}")
def remove_favorite(service_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.query(Favorite).filter(Favorite.user_id == user.id, Favorite.service_id == service_id).delete()
    db.commit()
    return {"is_favorite": False}
