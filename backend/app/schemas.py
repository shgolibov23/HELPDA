from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.utils import normalize_email, normalize_phone


class RegisterSchema(BaseModel):
    full_name: str = Field(min_length=3, max_length=100)
    phone: str = Field(min_length=9, max_length=20)
    email: str | None = None
    password: str = Field(min_length=8, max_length=100)

    @field_validator("full_name")
    @classmethod
    def _name(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 3:
            raise ValueError("Ism kamida 3 ta belgidan iborat bo'lsin")
        return v

    @field_validator("phone")
    @classmethod
    def _phone(cls, v: str) -> str:
        return normalize_phone(v)

    @field_validator("email")
    @classmethod
    def _email(cls, v: str | None) -> str | None:
        return normalize_email(v)


class LoginSchema(BaseModel):
    phone: str = Field(min_length=1, max_length=30)
    password: str = Field(min_length=1, max_length=100)


class UserResponse(BaseModel):
    id: int
    full_name: str
    phone: str
    email: str | None
    role: str
    avatar_url: str | None = None

    model_config = {"from_attributes": True}


class ProfileUpdateSchema(BaseModel):
    full_name: str = Field(min_length=3, max_length=100)
    email: str | None = None

    @field_validator("email")
    @classmethod
    def _email(cls, v: str | None) -> str | None:
        return normalize_email(v)


class BusinessApplicationSchema(BaseModel):
    business_type: Literal["mchj", "ytt", "self_employed"]
    business_name: str = Field(min_length=2, max_length=150)
    registration_number: str = Field(min_length=5, max_length=30)
    business_phone: str = Field(min_length=9, max_length=20)
    city: str = Field(min_length=2, max_length=100)
    address: str = Field(min_length=3, max_length=255)
    applicant_position: str = Field(min_length=2, max_length=100)
    category_ids: list[int] = Field(min_length=1, max_length=8)
    description: str = Field(min_length=20, max_length=5000)

    @field_validator("category_ids")
    @classmethod
    def _categories(cls, value: list[int]) -> list[int]:
        if len(set(value)) != len(value):
            raise ValueError("Yo'nalishlar takrorlanmasin")
        return value

    @field_validator("business_phone")
    @classmethod
    def _phone(cls, v: str) -> str:
        return normalize_phone(v)

    @field_validator("registration_number")
    @classmethod
    def _reg(cls, v: str) -> str:
        v = v.strip()
        if not v.replace(" ", "").isalnum():
            raise ValueError("STIR faqat harf va raqamlardan iborat bo'lsin")
        return v.replace(" ", "")


class BusinessRejectionSchema(BaseModel):
    reason: str = Field(min_length=5, max_length=500)


class BusinessUpdateSchema(BaseModel):
    description: str | None = Field(default=None, max_length=5000)
    phone: str = Field(min_length=9, max_length=20)
    city: str = Field(min_length=2, max_length=100)
    address: str = Field(min_length=3, max_length=255)
    logo: str | None = Field(default=None, max_length=255)
    working_hours: str | None = Field(default=None, max_length=300)
    portfolio_images: list[str] | None = Field(default=None, max_length=8)
    maps_url: str | None = Field(default=None, max_length=1000)
    category_ids: list[int] | None = Field(default=None, min_length=1, max_length=8)

    @field_validator("category_ids")
    @classmethod
    def _categories(cls, value: list[int] | None) -> list[int] | None:
        if value is None:
            return None
        if len(set(value)) != len(value):
            raise ValueError("Yo'nalishlar takrorlanmasin")
        return value

    @field_validator("phone")
    @classmethod
    def _phone(cls, v: str) -> str:
        return normalize_phone(v)

    @field_validator("logo")
    @classmethod
    def _logo(cls, v: str | None) -> str | None:
        return _check_url(v)

    @field_validator("portfolio_images")
    @classmethod
    def _portfolio_images(cls, values: list[str] | None) -> list[str] | None:
        if values is None:
            return None
        values = [value.strip() for value in values]
        if any(len(value) > 1000 or not (value.startswith("https://") or value.startswith("http://")) for value in values):
            raise ValueError("Portfolio rasmlari http:// yoki https:// havola bo‘lishi kerak.")
        if len(set(values)) != len(values):
            raise ValueError("Portfolio havolalari takrorlanmasin.")
        return values

    @field_validator("maps_url")
    @classmethod
    def _maps_url(cls, value: str | None) -> str | None:
        return _check_url(value)


def _check_url(v: str | None) -> str | None:
    if v is None:
        return None
    v = v.strip()
    if not v:
        return None
    if not (v.startswith("http://") or v.startswith("https://")):
        raise ValueError("Rasm havolasi http:// yoki https:// bilan boshlansin")
    return v


class ServiceSchema(BaseModel):
    name: str = Field(min_length=3, max_length=150)
    description: str | None = Field(default=None, max_length=2000)
    price: float = Field(ge=0, le=10_000_000_000)
    category_id: int
    image_url: str | None = Field(default=None, max_length=255)

    @field_validator("image_url")
    @classmethod
    def _img(cls, v: str | None) -> str | None:
        return _check_url(v)


class OrderCreateSchema(BaseModel):
    service_id: int
    message: str | None = Field(default=None, max_length=1000)
    contact_phone: str | None = None
    address: str | None = Field(default=None, max_length=255)
    booking_slot_id: int | None = None
    coupon_code: str | None = Field(default=None, max_length=40)
    redeem_points: bool = False

    @field_validator("contact_phone")
    @classmethod
    def _phone(cls, v: str | None) -> str | None:
        if v is None or not v.strip():
            return None
        return normalize_phone(v)


class OrderActionSchema(BaseModel):
    action: Literal["accept", "reject", "complete"]
    reason: str | None = Field(default=None, max_length=500)
    agreed_scope: str | None = Field(default=None, max_length=3000)
    deadline_at: datetime | None = None
    final_price: float | None = Field(default=None, ge=0, le=10_000_000_000)

    @field_validator("deadline_at")
    @classmethod
    def _deadline_timezone(cls, value: datetime | None) -> datetime | None:
        if value is not None and value.tzinfo is None:
            raise ValueError("Bajarish muddatida vaqt zonasi bo‘lishi kerak.")
        return value


class ReviewSchema(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: str | None = Field(default=None, max_length=1000)


class ReviewReplySchema(BaseModel):
    response: str = Field(min_length=2, max_length=1000)

    @field_validator("response")
    @classmethod
    def _response(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 2:
            raise ValueError("Javob kamida 2 ta belgidan iborat bo‘lsin.")
        return value


class ContentReportSchema(BaseModel):
    service_id: int | None = None
    business_id: int | None = None
    reason: str = Field(min_length=8, max_length=1000)

    @field_validator("reason")
    @classmethod
    def _reason(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 8:
            raise ValueError("Shikoyat sababini kamida 8 ta belgida yozing.")
        return value


class ContentReportResolveSchema(BaseModel):
    status: Literal["resolved", "dismissed"]
    admin_note: str | None = Field(default=None, max_length=500)


class ServiceRequestCreateSchema(BaseModel):
    category_id: int | None = None
    title: str = Field(min_length=4, max_length=150)
    description: str = Field(min_length=15, max_length=3000)
    city: str = Field(min_length=2, max_length=100)
    budget_min: float | None = Field(default=None, ge=0, le=10_000_000_000)
    budget_max: float | None = Field(default=None, ge=0, le=10_000_000_000)
    desired_date: datetime | None = None

    @field_validator("title", "description", "city")
    @classmethod
    def _trim_request_text(cls, value: str, info):
        value = value.strip()
        minimum = {"title": 4, "description": 15, "city": 2}[info.field_name]
        if len(value) < minimum:
            raise ValueError(f"{info.field_name} juda qisqa.")
        return value

    @model_validator(mode="after")
    def _budget(self):
        if self.budget_min is not None and self.budget_max is not None and self.budget_min > self.budget_max:
            raise ValueError("Eng kam budjet eng yuqori budjetdan oshmasin.")
        return self


class ServiceOfferCreateSchema(BaseModel):
    price: float = Field(ge=0, le=10_000_000_000)
    duration_days: int | None = Field(default=None, ge=1, le=365)
    message: str = Field(min_length=10, max_length=1500)

    @field_validator("message")
    @classmethod
    def _offer_message(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 10:
            raise ValueError("Taklif tafsiloti kamida 10 ta belgidan iborat bo‘lsin.")
        return value


class AvailabilitySlotCreateSchema(BaseModel):
    starts_at: datetime
    ends_at: datetime

    @model_validator(mode="after")
    def _time_range(self):
        if self.starts_at.tzinfo is None or self.ends_at.tzinfo is None:
            raise ValueError("Bo‘sh vaqt sanalarida vaqt zonasi bo‘lishi kerak.")
        self.starts_at = self.starts_at.astimezone(timezone.utc)
        self.ends_at = self.ends_at.astimezone(timezone.utc)
        if self.ends_at <= self.starts_at:
            raise ValueError("Tugash vaqti boshlanish vaqtidan keyin bo‘lishi kerak.")
        if self.starts_at <= datetime.now(timezone.utc):
            raise ValueError("Bo‘sh vaqt kelajakda bo‘lishi kerak.")
        return self


class OrderMessageSchema(BaseModel):
    body: str = Field(min_length=1, max_length=2000)

    @field_validator("body")
    @classmethod
    def _body(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Xabar bo‘sh bo‘lmasin.")
        return value


class CouponCreateSchema(BaseModel):
    code: str = Field(min_length=3, max_length=40, pattern=r"^[A-Za-z0-9_-]+$")
    discount_type: Literal["percent", "fixed"]
    value: float = Field(gt=0, le=10_000_000_000)
    max_redemptions: int | None = Field(default=None, ge=1, le=100_000)
    starts_at: datetime | None = None
    ends_at: datetime | None = None

    @model_validator(mode="after")
    def _coupon(self):
        if self.starts_at and self.starts_at.tzinfo is None or self.ends_at and self.ends_at.tzinfo is None:
            raise ValueError("Kupon sanalarida vaqt zonasi bo‘lishi kerak.")
        if self.starts_at:
            self.starts_at = self.starts_at.astimezone(timezone.utc)
        if self.ends_at:
            self.ends_at = self.ends_at.astimezone(timezone.utc)
        if self.discount_type == "percent" and self.value > 100:
            raise ValueError("Foiz chegirmasi 100 dan oshmasin.")
        if self.starts_at and self.ends_at and self.ends_at <= self.starts_at:
            raise ValueError("Kupon tugash vaqti boshlanishidan keyin bo‘lishi kerak.")
        return self


class PushTokenSchema(BaseModel):
    token: str = Field(min_length=20, max_length=255, pattern=r"^ExpoPushToken\[[A-Za-z0-9_-]+\]$")
    device_id: str | None = Field(default=None, max_length=255)


class MatchQuerySchema(BaseModel):
    query: str = Field(min_length=4, max_length=500)
    city: str | None = Field(default=None, max_length=100)
    use_ai: bool = False

    @field_validator("query")
    @classmethod
    def _query(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 4:
            raise ValueError("Talabni kamida 4 ta belgida yozing.")
        return value

class ActiveSchema(BaseModel):
    is_active: bool


class BlockSchema(BaseModel):
    is_blocked: bool


class FeaturedSchema(BaseModel):
    is_featured: bool
