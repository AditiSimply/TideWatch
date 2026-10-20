"""
Alembic migration: add provider + model columns to ai_reports.
"""
from alembic import op
import sqlalchemy as sa

revision = "002_ai_report_llm_provenance"
down_revision = "001_initial_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("ai_reports") as batch_op:
        batch_op.add_column(sa.Column("provider", sa.String(64), nullable=True))
        batch_op.add_column(sa.Column("model", sa.String(128), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("ai_reports") as batch_op:
        batch_op.drop_column("provider")
        batch_op.drop_column("model")
