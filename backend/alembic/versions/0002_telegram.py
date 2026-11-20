"""Telegram bot: foydalanuvchi chat ID'si va adminlarga yuborilgan xabarlar jadvali

Idempotent: yangi bazada (0001 allaqachon hammasini yaratgan bo'lsa) hech narsa qilmaydi.

Revision ID: 0002
"""
import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    from app.models import Base

    bind = op.get_bind()
    insp = sa.inspect(bind)
    have = {c["name"] for c in insp.get_columns("users")}
    if "telegram_chat_id" not in have:
        op.add_column("users", sa.Column("telegram_chat_id", sa.BigInteger(), nullable=True))
        op.create_unique_constraint("uq_users_telegram_chat_id", "users", ["telegram_chat_id"])
    if "telegram_link_token" not in have:
        op.add_column("users", sa.Column("telegram_link_token", sa.String(64), nullable=True))
        op.create_unique_constraint("uq_users_telegram_link_token", "users", ["telegram_link_token"])
    Base.metadata.create_all(bind=bind, checkfirst=True)  # application_notifications


def downgrade() -> None:
    op.drop_table("application_notifications")
