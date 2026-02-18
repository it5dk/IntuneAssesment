"""add assessment_changes table

Revision ID: 002
Revises: 001
Create Date: 2025-06-01
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "assessment_changes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", sa.String(128), nullable=False),
        sa.Column("operator_id", sa.String(256), nullable=False),
        sa.Column("object_id", sa.String(256), nullable=False),
        sa.Column("object_name", sa.String(512), nullable=False, server_default=""),
        sa.Column("collection", sa.String(128), nullable=False),
        sa.Column("action", sa.String(32), nullable=False),
        sa.Column("targets", postgresql.JSONB, nullable=False, server_default="[]"),
        sa.Column("conflicts_detected", postgresql.JSONB, nullable=True),
        sa.Column("stamp_result", sa.Text, nullable=True),
        sa.Column("ticket_id", sa.String(256), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_index("ix_assessment_changes_object_id", "assessment_changes", ["object_id"])
    op.create_index("ix_assessment_changes_operator_id", "assessment_changes", ["operator_id"])
    op.create_index("ix_assessment_changes_created_at", "assessment_changes", ["created_at"])


def downgrade() -> None:
    op.drop_table("assessment_changes")
