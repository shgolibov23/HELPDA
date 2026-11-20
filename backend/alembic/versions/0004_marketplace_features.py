"""In-app notifications, business profile details, and review replies."""
import sqlalchemy as sa
from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    for table, additions in {
        "businesses": {
            "working_hours": sa.Column("working_hours", sa.String(length=300), nullable=True),
            "portfolio_images": sa.Column("portfolio_images", sa.Text(), nullable=True),
            "maps_url": sa.Column("maps_url", sa.String(length=1000), nullable=True),
        },
        "reviews": {
            "business_response": sa.Column("business_response", sa.Text(), nullable=True),
            "business_response_at": sa.Column("business_response_at", sa.DateTime(timezone=True), nullable=True),
        },
    }.items():
        existing = {column["name"] for column in inspector.get_columns(table)}
        for name, column in additions.items():
            if name not in existing:
                op.add_column(table, column)

    tables = set(inspector.get_table_names())
    if "notifications" not in tables:
        op.create_table(
            "notifications",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("kind", sa.String(length=30), nullable=False),
            sa.Column("title", sa.String(length=160), nullable=False),
            sa.Column("message", sa.String(length=500), nullable=False),
            sa.Column("order_id", sa.Integer(), nullable=True),
            sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
            sa.ForeignKeyConstraint(["order_id"], ["orders.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
    if "content_reports" not in tables:
        op.create_table(
            "content_reports",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("reporter_id", sa.Integer(), nullable=False),
            sa.Column("service_id", sa.Integer(), nullable=True),
            sa.Column("business_id", sa.Integer(), nullable=True),
            sa.Column("reason", sa.String(length=1000), nullable=False),
            sa.Column("status", sa.String(length=20), server_default="pending", nullable=False),
            sa.Column("admin_note", sa.String(length=500), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
            sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(["business_id"], ["businesses.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["reporter_id"], ["users.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["service_id"], ["services.id"], ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id"),
        )

    for table, name, columns in (
        ("notifications", "ix_notifications_user_id", ["user_id"]),
        ("notifications", "ix_notifications_user_unread", ["user_id", "read_at"]),
        ("content_reports", "ix_content_reports_reporter_id", ["reporter_id"]),
    ):
        existing_indexes = {index["name"] for index in sa.inspect(bind).get_indexes(table)}
        if name not in existing_indexes:
            op.create_index(name, table, columns)


def downgrade() -> None:
    bind = op.get_bind()
    tables = set(sa.inspect(bind).get_table_names())
    if "content_reports" in tables:
        for name in ("ix_content_reports_reporter_id",):
            if name in {index["name"] for index in sa.inspect(bind).get_indexes("content_reports")}:
                op.drop_index(name, table_name="content_reports")
        op.drop_table("content_reports")
    if "notifications" in tables:
        for name in ("ix_notifications_user_unread", "ix_notifications_user_id"):
            if name in {index["name"] for index in sa.inspect(bind).get_indexes("notifications")}:
                op.drop_index(name, table_name="notifications")
        op.drop_table("notifications")
    for table, columns in (
        ("reviews", ("business_response_at", "business_response")),
        ("businesses", ("maps_url", "portfolio_images", "working_hours")),
    ):
        existing = {column["name"] for column in sa.inspect(bind).get_columns(table)}
        for column in columns:
            if column in existing:
                op.drop_column(table, column)
