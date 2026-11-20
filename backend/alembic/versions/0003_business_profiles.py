"""Biznes yo'nalishlari, profil rasmi va maxfiy biznes hujjatlari."""
import sqlalchemy as sa
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {
        "users": {"avatar_url": sa.Column("avatar_url", sa.String(500), nullable=True)},
        "business_applications": {
            "description": sa.Column("description", sa.Text(), nullable=False, server_default=""),
            "document_path": sa.Column("document_path", sa.String(500), nullable=True),
            "ai_status": sa.Column("ai_status", sa.String(24), nullable=False, server_default="not_configured"),
            "ai_recommendation": sa.Column("ai_recommendation", sa.String(24), nullable=True),
            "ai_confidence": sa.Column("ai_confidence", sa.Float(), nullable=True),
            "ai_summary": sa.Column("ai_summary", sa.Text(), nullable=True),
        },
    }
    for table, additions in columns.items():
        existing = {column["name"] for column in inspector.get_columns(table)}
        for name, column in additions.items():
            if name not in existing:
                op.add_column(table, column)

    existing_tables = set(sa.inspect(bind).get_table_names())
    if "business_application_categories" not in existing_tables:
        op.create_table(
            "business_application_categories",
            sa.Column("application_id", sa.Integer(), sa.ForeignKey("business_applications.id", ondelete="CASCADE"), primary_key=True),
            sa.Column("category_id", sa.Integer(), sa.ForeignKey("categories.id", ondelete="CASCADE"), primary_key=True),
        )
    if "business_categories" not in existing_tables:
        op.create_table(
            "business_categories",
            sa.Column("business_id", sa.Integer(), sa.ForeignKey("businesses.id", ondelete="CASCADE"), primary_key=True),
            sa.Column("category_id", sa.Integer(), sa.ForeignKey("categories.id", ondelete="CASCADE"), primary_key=True),
        )
    op.execute(
        "INSERT INTO business_categories (business_id, category_id) "
        "SELECT DISTINCT business_id, category_id FROM services "
        "WHERE business_id IS NOT NULL AND category_id IS NOT NULL"
    )


def downgrade() -> None:
    op.drop_table("business_categories")
    op.drop_table("business_application_categories")
    for table, columns in (
        ("business_applications", ("ai_summary", "ai_confidence", "ai_recommendation", "ai_status", "document_path", "description")),
        ("users", ("avatar_url",)),
    ):
        for column in columns:
            op.drop_column(table, column)
