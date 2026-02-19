""" BEGIN AUTODOC HEADER
#  File: apps\backend\alembic\versions\001_initial.py
#  Description: (edit inside USER NOTES below)
# 
#  BEGIN AUTODOC META
#  Version: 0.0.0.3
#  Last-Updated: 2026-02-19 00:30:35
#  Managed-By: autosave.ps1
#  END AUTODOC META
# 
#  BEGIN USER NOTES
#  Your notes here. We will NEVER change this block.
#  END USER NOTES
"""

"""initial schema

Revision ID: 001
Revises:
Create Date: 2025-01-01
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "templates",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=False, server_default=""),
        sa.Column("icon_key", sa.String(64), nullable=False, server_default="shield"),
        sa.Column("product_tag", sa.String(32), nullable=False),
        sa.Column("resource_type", sa.String(128), nullable=False),
        sa.Column("graph_endpoints", postgresql.JSONB, nullable=False, server_default="[]"),
        sa.Column("default_schedule_hours", sa.Integer, nullable=False, server_default="24"),
        sa.Column("default_ignore_rules", postgresql.JSONB, nullable=False, server_default="[]"),
        sa.Column("default_severity", sa.String(16), nullable=False, server_default="MEDIUM"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "snapshots",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("monitor_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("resource_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "monitors",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("template_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("templates.id"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.String(1024), nullable=False, server_default=""),
        sa.Column("schedule_hours", sa.Integer, nullable=False, server_default="24"),
        sa.Column("enabled", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("scope", postgresql.JSONB, nullable=True),
        sa.Column("ignore_rules", postgresql.JSONB, nullable=False, server_default="[]"),
        sa.Column("baseline_snapshot_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("snapshots.id", use_alter=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Add FK from snapshots to monitors
    op.create_foreign_key("fk_snapshots_monitor_id", "snapshots", "monitors", ["monitor_id"], ["id"])

    op.create_table(
        "monitor_runs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("monitor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("monitors.id"), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="started"),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error", sa.Text, nullable=True),
        sa.Column("snapshot_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("snapshots.id", use_alter=True), nullable=True),
    )

    op.create_table(
        "snapshot_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("snapshot_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("snapshots.id"), nullable=False),
        sa.Column("resource_id", sa.String(255), nullable=False),
        sa.Column("resource_type", sa.String(128), nullable=False),
        sa.Column("display_name", sa.String(512), nullable=False, server_default=""),
        sa.Column("raw_json", postgresql.JSONB, nullable=False),
        sa.Column("normalized", postgresql.JSONB, nullable=False),
        sa.Column("hash", sa.String(64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "drifts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("monitor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("monitors.id"), nullable=False),
        sa.Column("snapshot_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("snapshots.id"), nullable=False),
        sa.Column("resource_id", sa.String(255), nullable=False),
        sa.Column("resource_type", sa.String(128), nullable=False),
        sa.Column("display_name", sa.String(512), nullable=False, server_default=""),
        sa.Column("change_type", sa.String(16), nullable=False),
        sa.Column("severity", sa.String(16), nullable=False, server_default="MEDIUM"),
        sa.Column("status", sa.String(16), nullable=False, server_default="active"),
        sa.Column("property_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("detected_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "drift_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("drift_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("drifts.id"), nullable=False),
        sa.Column("json_path", sa.String(512), nullable=False),
        sa.Column("change_type", sa.String(16), nullable=False),
        sa.Column("old_value", sa.Text, nullable=True),
        sa.Column("new_value", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "ignore_rules",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("template_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("templates.id"), nullable=True),
        sa.Column("monitor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("monitors.id"), nullable=True),
        sa.Column("json_path_pattern", sa.String(512), nullable=False),
        sa.Column("reason", sa.String(512), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Indexes
    op.create_index("ix_monitors_template_id", "monitors", ["template_id"])
    op.create_index("ix_monitors_enabled", "monitors", ["enabled"])
    op.create_index("ix_monitor_runs_monitor_id", "monitor_runs", ["monitor_id"])
    op.create_index("ix_snapshots_monitor_id", "snapshots", ["monitor_id"])
    op.create_index("ix_snapshot_items_snapshot_id", "snapshot_items", ["snapshot_id"])
    op.create_index("ix_drifts_monitor_id", "drifts", ["monitor_id"])
    op.create_index("ix_drifts_status", "drifts", ["status"])
    op.create_index("ix_drift_items_drift_id", "drift_items", ["drift_id"])


def downgrade() -> None:
    op.drop_table("ignore_rules")
    op.drop_table("drift_items")
    op.drop_table("drifts")
    op.drop_table("snapshot_items")
    op.drop_table("monitor_runs")
    op.drop_table("monitors")
    op.drop_table("snapshots")
    op.drop_table("templates")


