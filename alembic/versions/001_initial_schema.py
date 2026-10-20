"""Initial database schema for Tidewatch NIDS

Revision ID: 001_initial_schema
Revises: 
Create Date: 2026-10-19 20:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '001_initial_schema'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. flows table
    op.create_table(
        'flows',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('ts', sa.DateTime(timezone=True), nullable=False),
        sa.Column('src_ip', sa.String(length=45), nullable=False),
        sa.Column('dst_ip', sa.String(length=45), nullable=False),
        sa.Column('src_port', sa.Integer(), nullable=False),
        sa.Column('dst_port', sa.Integer(), nullable=False),
        sa.Column('protocol', sa.String(length=10), nullable=False),
        sa.Column('features', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=False),
        sa.Column('prediction', sa.String(length=50), nullable=False),
        sa.Column('confidence', sa.Float(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_flows_dst_ip'), 'flows', ['dst_ip'], unique=False)
    op.create_index(op.f('ix_flows_dst_port'), 'flows', ['dst_port'], unique=False)
    op.create_index(op.f('ix_flows_prediction'), 'flows', ['prediction'], unique=False)
    op.create_index(op.f('ix_flows_src_ip'), 'flows', ['src_ip'], unique=False)
    op.create_index(op.f('ix_flows_ts'), 'flows', ['ts'], unique=False)

    # 2. alerts table
    op.create_table(
        'alerts',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('flow_id', sa.Uuid(), nullable=False),
        sa.Column('attack_type', sa.String(length=50), nullable=False),
        sa.Column('severity', sa.String(length=20), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['flow_id'], ['flows.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_alerts_attack_type'), 'alerts', ['attack_type'], unique=False)
    op.create_index(op.f('ix_alerts_created_at'), 'alerts', ['created_at'], unique=False)
    op.create_index(op.f('ix_alerts_flow_id'), 'alerts', ['flow_id'], unique=False)
    op.create_index(op.f('ix_alerts_severity'), 'alerts', ['severity'], unique=False)
    op.create_index(op.f('ix_alerts_status'), 'alerts', ['status'], unique=False)

    # 3. model_runs table
    op.create_table(
        'model_runs',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('version', sa.String(length=50), nullable=False),
        sa.Column('metrics', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_model_runs_created_at'), 'model_runs', ['created_at'], unique=False)
    op.create_index(op.f('ix_model_runs_version'), 'model_runs', ['version'], unique=False)

    # 4. ai_reports table
    op.create_table(
        'ai_reports',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('alert_id', sa.Uuid(), nullable=False),
        sa.Column('explanation', sa.Text(), nullable=False),
        sa.Column('mitigation', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=False),
        sa.Column('severity_score', sa.Float(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['alert_id'], ['alerts.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_ai_reports_alert_id'), 'ai_reports', ['alert_id'], unique=False)
    op.create_index(op.f('ix_ai_reports_created_at'), 'ai_reports', ['created_at'], unique=False)

    # 5. chat_messages table
    op.create_table(
        'chat_messages',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('session_id', sa.String(length=100), nullable=False),
        sa.Column('role', sa.String(length=20), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_chat_messages_created_at'), 'chat_messages', ['created_at'], unique=False)
    op.create_index(op.f('ix_chat_messages_session_id'), 'chat_messages', ['session_id'], unique=False)


def downgrade() -> None:
    op.drop_table('chat_messages')
    op.drop_table('ai_reports')
    op.drop_table('model_runs')
    op.drop_table('alerts')
    op.drop_table('flows')
