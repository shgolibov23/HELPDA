"""HELPDA v2: yangi jadvallar va ustunlar (mavjud ma'lumotlarni saqlaydi)

Bu migratsiya ham YANGI bo'sh bazada, ham eski (users, businesses, services,
categories, business_applications jadvallari bor) bazada xavfsiz ishlaydi:
  * yo'q jadvallar yaratiladi (orders, favorites, reviews, ...),
  * mavjud jadvallarga yo'q ustunlar qo'shiladi,
  * hech narsa o'chirilmaydi.

Revision ID: 0001
"""
import sqlalchemy as sa
from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None

PARTIAL = "status IN ('pending','approved')"

# jadval -> qo'shiladigan ustunlar
NEW_COLUMNS = {
    "users": [
        lambda: sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        lambda: sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    ],
    "businesses": [
        lambda: sa.Column("business_type", sa.String(30), nullable=True),
        lambda: sa.Column("registration_number", sa.String(30), nullable=True),
        lambda: sa.Column("application_id", sa.Integer(), sa.ForeignKey("business_applications.id"), nullable=True),
        lambda: sa.Column("verification_level", sa.String(30), nullable=False, server_default="manual_review"),
        lambda: sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        lambda: sa.Column("is_featured", sa.Boolean(), nullable=False, server_default=sa.false()),
        lambda: sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    ],
    "services": [
        lambda: sa.Column("image_url", sa.String(255), nullable=True),
        lambda: sa.Column("is_blocked", sa.Boolean(), nullable=False, server_default=sa.false()),
        lambda: sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    ],
}


def _ensure_partial_index(bind, name: str, column: str):
    existing = {i["name"] for i in sa.inspect(bind).get_indexes("business_applications")}
    if name in existing:
        return
    dup = bind.execute(
        sa.text(
            f"SELECT {column} FROM business_applications WHERE {PARTIAL} "
            f"GROUP BY {column} HAVING COUNT(*) > 1"
        )
    ).first()
    if dup:
        print(f"OGOHLANTIRISH: '{column}' bo'yicha takroriy faol arizalar bor, '{name}' indeksi yaratilmadi.")
        return
    op.create_index(name, "business_applications", [column], unique=True, postgresql_where=sa.text(PARTIAL))


def upgrade() -> None:
    from app.models import Base

    bind = op.get_bind()
    existing_tables = set(sa.inspect(bind).get_table_names())

    # 1) yo'q jadvallarni yaratish (mavjudlariga tegmaydi)
    Base.metadata.create_all(bind=bind, checkfirst=True)

    # 2) mavjud jadvallarga yo'q ustunlarni qo'shish
    for table, makers in NEW_COLUMNS.items():
        if table not in existing_tables:
            continue  # yangi yaratilgan, ustunlar tayyor
        have = {c["name"] for c in sa.inspect(bind).get_columns(table)}
        for make in makers:
            col = make()
            if col.name not in have:
                op.add_column(table, col)

    if "services" in existing_tables:
        op.execute("UPDATE services SET is_active = true WHERE is_active IS NULL")

    # 3) eski tasdiqlangan bizneslarga ariza ma'lumotlarini ko'chirish (PostgreSQL)
    if bind.dialect.name == "postgresql" and "businesses" in existing_tables:
        op.execute(
            """
            UPDATE businesses SET
                business_type = a.business_type,
                registration_number = a.registration_number,
                application_id = a.id
            FROM business_applications a
            WHERE a.applicant_id = businesses.owner_id
              AND a.status = 'approved'
              AND businesses.application_id IS NULL
            """
        )

    # 4) bazaning o'zida dublikatdan himoya (faqat mavjud jadval uchun kerak)
    if "business_applications" in existing_tables:
        _ensure_partial_index(bind, "uq_active_application_applicant", "applicant_id")
        _ensure_partial_index(bind, "uq_active_application_regnum", "registration_number")


def downgrade() -> None:
    # Ma'lumot yo'qolmasligi uchun faqat yangi jadvallar o'chiriladi.
    for table in ("reviews", "favorites", "orders"):
        op.drop_table(table)
