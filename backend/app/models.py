from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Table,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy.sql import func

Base = declarative_base()

ACTIVE_APP_STATUSES = ("pending", "approved")


def _ts():
    return Column(DateTime(timezone=True), server_default=func.now())


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(100), nullable=False)
    phone = Column(String(20), unique=True, nullable=False)
    email = Column(String(100), unique=True, nullable=True)
    hashed_password = Column(String(255), nullable=False)
    avatar_url = Column(String(500), nullable=True)
    # client | business | admin
    role = Column(String(20), default="client")
    is_active = Column(Boolean, nullable=False, default=True, server_default=text("true"))
    telegram_chat_id = Column(BigInteger, unique=True, nullable=True)
    telegram_link_token = Column(String(64), unique=True, nullable=True)
    created_at = _ts()


class Business(Base):
    __tablename__ = "businesses"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)
    working_hours = Column(String(300), nullable=True)
    portfolio_images = Column(Text, nullable=True)
    maps_url = Column(String(1000), nullable=True)
    phone = Column(String(20), nullable=False)
    city = Column(String(100), nullable=True)
    address = Column(String(255), nullable=True)
    logo = Column(String(255), nullable=True)
    owner_id = Column(Integer, ForeignKey("users.id"))
    # mchj | ytt | self_employed
    business_type = Column(String(30), nullable=True)
    registration_number = Column(String(30), nullable=True)
    application_id = Column(Integer, ForeignKey("business_applications.id"), nullable=True)
    # manual_review = admin ariza ma'lumotlarini qo'lda ko'rib chiqdi.
    # registry_verified = davlat reyestri orqali rasmiy tekshiruv (hozircha
    # hech qachon avtomatik belgilanmaydi - kelajak uchun).
    verification_level = Column(
        String(30), nullable=False, default="manual_review", server_default="manual_review"
    )
    is_active = Column(Boolean, nullable=False, default=True, server_default=text("true"))
    is_featured = Column(Boolean, nullable=False, default=False, server_default=text("false"))
    created_at = _ts()


class BusinessApplication(Base):
    __tablename__ = "business_applications"

    id = Column(Integer, primary_key=True, index=True)
    applicant_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    business_type = Column(String(30), nullable=False)
    business_name = Column(String(150), nullable=False)
    registration_number = Column(String(30), nullable=False)
    business_phone = Column(String(20), nullable=False)
    city = Column(String(100), nullable=False)
    address = Column(String(255), nullable=False)
    applicant_position = Column(String(100), nullable=False)
    # pending | approved | rejected
    status = Column(String(20), default="pending", nullable=False)
    rejection_reason = Column(Text, nullable=True)
    description = Column(Text, nullable=False, default="")
    document_path = Column(String(500), nullable=True)
    ai_status = Column(String(24), nullable=False, default="not_configured")
    ai_recommendation = Column(String(24), nullable=True)
    ai_confidence = Column(Float, nullable=True)
    ai_summary = Column(Text, nullable=True)
    created_at = _ts()
    categories = relationship("Category", secondary="business_application_categories", lazy="selectin")

    __table_args__ = (
        # Bazaning o'zi: bitta foydalanuvchi / bitta raqam uchun bitta faol ariza
        Index(
            "uq_active_application_applicant",
            "applicant_id",
            unique=True,
            postgresql_where=text("status IN ('pending','approved')"),
            sqlite_where=text("status IN ('pending','approved')"),
        ),
        Index(
            "uq_active_application_regnum",
            "registration_number",
            unique=True,
            postgresql_where=text("status IN ('pending','approved')"),
            sqlite_where=text("status IN ('pending','approved')"),
        ),
    )


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    icon = Column(String(100), nullable=True)  # Ionicons nomi


business_application_categories = Table(
    "business_application_categories",
    Base.metadata,
    Column("application_id", Integer, ForeignKey("business_applications.id", ondelete="CASCADE"), primary_key=True),
    Column("category_id", Integer, ForeignKey("categories.id", ondelete="CASCADE"), primary_key=True),
)

business_categories = Table(
    "business_categories",
    Base.metadata,
    Column("business_id", Integer, ForeignKey("businesses.id", ondelete="CASCADE"), primary_key=True),
    Column("category_id", Integer, ForeignKey("categories.id", ondelete="CASCADE"), primary_key=True),
)

Business.categories = relationship("Category", secondary=business_categories, lazy="selectin")


class Service(Base):
    __tablename__ = "services"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)
    price = Column(Float, default=0)
    business_id = Column(Integer, ForeignKey("businesses.id"))
    category_id = Column(Integer, ForeignKey("categories.id"))
    is_active = Column(Boolean, default=True)
    image_url = Column(String(255), nullable=True)
    # Admin moderatsiyasi
    is_blocked = Column(Boolean, nullable=False, default=False, server_default=text("false"))
    created_at = _ts()


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    service_id = Column(Integer, ForeignKey("services.id", ondelete="SET NULL"), nullable=True)
    service_name = Column(String(150), nullable=False)  # xizmat o'chirilsa ham qoladi
    price = Column(Float, default=0)
    original_price = Column(Float, nullable=True)
    discount_amount = Column(Float, nullable=False, default=0, server_default="0")
    redeemed_points = Column(Integer, nullable=False, default=0, server_default="0")
    booking_slot_id = Column(Integer, ForeignKey("availability_slots.id", ondelete="SET NULL"), nullable=True)
    agreed_scope = Column(Text, nullable=True)
    deadline_at = Column(DateTime(timezone=True), nullable=True)
    customer_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=False, index=True)
    message = Column(Text, nullable=True)
    contact_phone = Column(String(20), nullable=False)
    address = Column(String(255), nullable=True)
    # pending | accepted | rejected | completed | cancelled
    status = Column(String(20), nullable=False, default="pending")
    rejection_reason = Column(Text, nullable=True)
    created_at = _ts()
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Favorite(Base):
    __tablename__ = "favorites"
    __table_args__ = (UniqueConstraint("user_id", "service_id", name="uq_favorite"),)

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    service_id = Column(Integer, ForeignKey("services.id", ondelete="CASCADE"), nullable=False)
    created_at = _ts()


class Review(Base):
    __tablename__ = "reviews"
    __table_args__ = (UniqueConstraint("user_id", "service_id", name="uq_review"),)

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    service_id = Column(Integer, ForeignKey("services.id", ondelete="CASCADE"), nullable=False, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=False, index=True)
    rating = Column(Integer, nullable=False)
    comment = Column(Text, nullable=True)
    business_response = Column(Text, nullable=True)
    business_response_at = Column(DateTime(timezone=True), nullable=True)
    created_at = _ts()


class AppNotification(Base):
    __tablename__ = "notifications"
    __table_args__ = (Index("ix_notifications_user_unread", "user_id", "read_at"),)

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    kind = Column(String(30), nullable=False)
    title = Column(String(160), nullable=False)
    message = Column(String(500), nullable=False)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="SET NULL"), nullable=True)
    read_at = Column(DateTime(timezone=True), nullable=True)
    created_at = _ts()


class ContentReport(Base):
    __tablename__ = "content_reports"

    id = Column(Integer, primary_key=True)
    reporter_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    service_id = Column(Integer, ForeignKey("services.id", ondelete="SET NULL"), nullable=True)
    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="SET NULL"), nullable=True)
    reason = Column(String(1000), nullable=False)
    status = Column(String(20), nullable=False, default="pending", server_default="pending")
    admin_note = Column(String(500), nullable=True)
    created_at = _ts()
    resolved_at = Column(DateTime(timezone=True), nullable=True)


class ServiceRequest(Base):
    __tablename__ = "service_requests"
    __table_args__ = (Index("ix_service_requests_status_created", "status", "created_at"),)

    id = Column(Integer, primary_key=True)
    customer_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="SET NULL"), nullable=True)
    title = Column(String(150), nullable=False)
    description = Column(Text, nullable=False)
    city = Column(String(100), nullable=False)
    budget_min = Column(Float, nullable=True)
    budget_max = Column(Float, nullable=True)
    desired_date = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(20), nullable=False, default="open", server_default="open")
    created_at = _ts()


class ServiceOffer(Base):
    __tablename__ = "service_offers"
    __table_args__ = (UniqueConstraint("request_id", "business_id", name="uq_service_offer_business"),)

    id = Column(Integer, primary_key=True)
    request_id = Column(Integer, ForeignKey("service_requests.id", ondelete="CASCADE"), nullable=False, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True)
    price = Column(Float, nullable=False)
    duration_days = Column(Integer, nullable=True)
    message = Column(Text, nullable=False)
    status = Column(String(20), nullable=False, default="pending", server_default="pending")
    created_at = _ts()


class AvailabilitySlot(Base):
    __tablename__ = "availability_slots"
    __table_args__ = (Index("ix_availability_slots_business_status_start", "business_id", "status", "starts_at"),)

    id = Column(Integer, primary_key=True)
    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True)
    starts_at = Column(DateTime(timezone=True), nullable=False)
    ends_at = Column(DateTime(timezone=True), nullable=False)
    status = Column(String(20), nullable=False, default="available", server_default="available")
    created_at = _ts()


class OrderMessage(Base):
    __tablename__ = "order_messages"

    id = Column(Integer, primary_key=True)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True)
    sender_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    body = Column(String(2000), nullable=False)
    created_at = _ts()


class Coupon(Base):
    __tablename__ = "coupons"
    __table_args__ = (UniqueConstraint("business_id", "code", name="uq_coupon_business_code"),)

    id = Column(Integer, primary_key=True)
    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True)
    code = Column(String(40), nullable=False)
    discount_type = Column(String(10), nullable=False)
    value = Column(Float, nullable=False)
    max_redemptions = Column(Integer, nullable=True)
    starts_at = Column(DateTime(timezone=True), nullable=True)
    ends_at = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True, server_default=text("true"))
    created_at = _ts()


class CouponRedemption(Base):
    __tablename__ = "coupon_redemptions"
    __table_args__ = (UniqueConstraint("coupon_id", "user_id", name="uq_coupon_customer"),)

    id = Column(Integer, primary_key=True)
    coupon_id = Column(Integer, ForeignKey("coupons.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="SET NULL"), nullable=True)
    discount_amount = Column(Float, nullable=False)
    created_at = _ts()


class LoyaltyTransaction(Base):
    __tablename__ = "loyalty_transactions"
    __table_args__ = (UniqueConstraint("order_id", "kind", name="uq_loyalty_order_kind"),)

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="SET NULL"), nullable=True)
    points = Column(Integer, nullable=False)
    kind = Column(String(10), nullable=False)
    created_at = _ts()


class PushToken(Base):
    __tablename__ = "push_tokens"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token = Column(String(255), nullable=False, unique=True)
    device_id = Column(String(255), nullable=True)
    created_at = _ts()


class ApplicationNotification(Base):
    """Adminlarga Telegram orqali yuborilgan ariza xabarlari (keyin tahrirlash uchun)."""

    __tablename__ = "application_notifications"

    id = Column(Integer, primary_key=True)
    application_id = Column(Integer, ForeignKey("business_applications.id", ondelete="CASCADE"), nullable=False, index=True)
    chat_id = Column(BigInteger, nullable=False)
    message_id = Column(BigInteger, nullable=False)
