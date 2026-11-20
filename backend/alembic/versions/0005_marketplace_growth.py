"""Requests, bookings, messaging, loyalty, coupons, and push tokens."""
import sqlalchemy as sa
from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    order_columns = {column["name"] for column in inspector.get_columns("orders")}
    additions = {
        "original_price": sa.Column("original_price", sa.Float(), nullable=True),
        "discount_amount": sa.Column("discount_amount", sa.Float(), nullable=False, server_default="0"),
        "redeemed_points": sa.Column("redeemed_points", sa.Integer(), nullable=False, server_default="0"),
        "booking_slot_id": sa.Column("booking_slot_id", sa.Integer(), nullable=True),
        "agreed_scope": sa.Column("agreed_scope", sa.Text(), nullable=True),
        "deadline_at": sa.Column("deadline_at", sa.DateTime(timezone=True), nullable=True),
    }
    for name, column in additions.items():
        if name == "booking_slot_id":
            continue
        if name not in order_columns:
            op.add_column("orders", column)

    tables = set(inspector.get_table_names())
    if "service_requests" not in tables:
        op.create_table(
            "service_requests",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("customer_id", sa.Integer(), nullable=False),
            sa.Column("category_id", sa.Integer(), nullable=True),
            sa.Column("title", sa.String(length=150), nullable=False),
            sa.Column("description", sa.Text(), nullable=False),
            sa.Column("city", sa.String(length=100), nullable=False),
            sa.Column("budget_min", sa.Float(), nullable=True),
            sa.Column("budget_max", sa.Float(), nullable=True),
            sa.Column("desired_date", sa.DateTime(timezone=True), nullable=True),
            sa.Column("status", sa.String(length=20), server_default="open", nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
            sa.ForeignKeyConstraint(["category_id"], ["categories.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["customer_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
    if "service_offers" not in tables:
        op.create_table(
            "service_offers",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("request_id", sa.Integer(), nullable=False),
            sa.Column("business_id", sa.Integer(), nullable=False),
            sa.Column("price", sa.Float(), nullable=False),
            sa.Column("duration_days", sa.Integer(), nullable=True),
            sa.Column("message", sa.Text(), nullable=False),
            sa.Column("status", sa.String(length=20), server_default="pending", nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
            sa.ForeignKeyConstraint(["business_id"], ["businesses.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["request_id"], ["service_requests.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("request_id", "business_id", name="uq_service_offer_business"),
        )
    if "availability_slots" not in tables:
        op.create_table(
            "availability_slots",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("business_id", sa.Integer(), nullable=False),
            sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("ends_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("status", sa.String(length=20), server_default="available", nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
            sa.ForeignKeyConstraint(["business_id"], ["businesses.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
    if "booking_slot_id" not in order_columns:
        with op.batch_alter_table("orders") as batch_op:
            batch_op.add_column(sa.Column("booking_slot_id", sa.Integer(), nullable=True))
            batch_op.create_foreign_key(
                "fk_orders_booking_slot_id_availability_slots",
                "availability_slots",
                ["booking_slot_id"],
                ["id"],
                ondelete="SET NULL",
            )
    if "order_messages" not in tables:
        op.create_table(
            "order_messages",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("order_id", sa.Integer(), nullable=False),
            sa.Column("sender_id", sa.Integer(), nullable=False),
            sa.Column("body", sa.String(length=2000), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
            sa.ForeignKeyConstraint(["order_id"], ["orders.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["sender_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
    if "coupons" not in tables:
        op.create_table(
            "coupons",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("business_id", sa.Integer(), nullable=False),
            sa.Column("code", sa.String(length=40), nullable=False),
            sa.Column("discount_type", sa.String(length=10), nullable=False),
            sa.Column("value", sa.Float(), nullable=False),
            sa.Column("max_redemptions", sa.Integer(), nullable=True),
            sa.Column("starts_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("ends_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
            sa.ForeignKeyConstraint(["business_id"], ["businesses.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("business_id", "code", name="uq_coupon_business_code"),
        )
    if "coupon_redemptions" not in tables:
        op.create_table(
            "coupon_redemptions",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("coupon_id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("order_id", sa.Integer(), nullable=True),
            sa.Column("discount_amount", sa.Float(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
            sa.ForeignKeyConstraint(["coupon_id"], ["coupons.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["order_id"], ["orders.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("coupon_id", "user_id", name="uq_coupon_customer"),
        )
    if "loyalty_transactions" not in tables:
        op.create_table(
            "loyalty_transactions",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("order_id", sa.Integer(), nullable=True),
            sa.Column("points", sa.Integer(), nullable=False),
            sa.Column("kind", sa.String(length=10), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
            sa.ForeignKeyConstraint(["order_id"], ["orders.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("order_id", "kind", name="uq_loyalty_order_kind"),
        )
    if "push_tokens" not in tables:
        op.create_table(
            "push_tokens",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("token", sa.String(length=255), nullable=False),
            sa.Column("device_id", sa.String(length=255), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("token"),
        )

    for table, index, columns in (
        ("service_requests", "ix_service_requests_customer_id", ["customer_id"]),
        ("service_requests", "ix_service_requests_status_created", ["status", "created_at"]),
        ("service_offers", "ix_service_offers_request_id", ["request_id"]),
        ("service_offers", "ix_service_offers_business_id", ["business_id"]),
        ("availability_slots", "ix_availability_slots_business_id", ["business_id"]),
        ("availability_slots", "ix_availability_slots_business_status_start", ["business_id", "status", "starts_at"]),
        ("order_messages", "ix_order_messages_order_id", ["order_id"]),
        ("order_messages", "ix_order_messages_sender_id", ["sender_id"]),
        ("coupons", "ix_coupons_business_id", ["business_id"]),
        ("coupon_redemptions", "ix_coupon_redemptions_coupon_id", ["coupon_id"]),
        ("coupon_redemptions", "ix_coupon_redemptions_user_id", ["user_id"]),
        ("loyalty_transactions", "ix_loyalty_transactions_user_id", ["user_id"]),
        ("push_tokens", "ix_push_tokens_user_id", ["user_id"]),
    ):
        existing = {item["name"] for item in sa.inspect(bind).get_indexes(table)}
        if index not in existing:
            op.create_index(index, table, columns)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = {column["name"] for column in inspector.get_columns("orders")}
    columns_to_drop = [
        name
        for name in ("deadline_at", "agreed_scope", "booking_slot_id", "redeemed_points", "discount_amount", "original_price")
        if name in existing
    ]
    if columns_to_drop:
        foreign_keys = inspector.get_foreign_keys("orders")
        slot_foreign_key = next(
            (
                item["name"]
                for item in foreign_keys
                if "booking_slot_id" in item["constrained_columns"] and item["name"]
            ),
            None,
        )
        with op.batch_alter_table("orders") as batch_op:
            if slot_foreign_key:
                batch_op.drop_constraint(slot_foreign_key, type_="foreignkey")
            for name in columns_to_drop:
                batch_op.drop_column(name)
    for table, columns in (
        ("push_tokens", ("ix_push_tokens_user_id",)),
        ("loyalty_transactions", ("ix_loyalty_transactions_user_id",)),
        ("coupon_redemptions", ("ix_coupon_redemptions_user_id", "ix_coupon_redemptions_coupon_id")),
        ("coupons", ("ix_coupons_business_id",)),
        ("order_messages", ("ix_order_messages_sender_id", "ix_order_messages_order_id")),
        ("availability_slots", ("ix_availability_slots_business_status_start", "ix_availability_slots_business_id")),
        ("service_offers", ("ix_service_offers_business_id", "ix_service_offers_request_id")),
        ("service_requests", ("ix_service_requests_status_created", "ix_service_requests_customer_id")),
    ):
        if table in sa.inspect(bind).get_table_names():
            existing = {item["name"] for item in sa.inspect(bind).get_indexes(table)}
            for name in columns:
                if name in existing:
                    op.drop_index(name, table_name=table)
    for table in (
        "push_tokens",
        "loyalty_transactions",
        "coupon_redemptions",
        "coupons",
        "order_messages",
        "availability_slots",
        "service_offers",
        "service_requests",
    ):
        if table in sa.inspect(bind).get_table_names():
            op.drop_table(table)
