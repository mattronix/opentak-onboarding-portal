"""Add kiosk_sessions table

Revision ID: 8f8950a7e030
Revises: c08776f70186
Create Date: 2026-02-04 11:01:02.162983

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '8f8950a7e030'
down_revision = 'c08776f70186'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('kiosk_sessions',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('session_id', sa.String(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=True),
    sa.Column('status', sa.String(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('expires_at', sa.DateTime(), nullable=False),
    sa.Column('authenticated_at', sa.DateTime(), nullable=True),
    sa.Column('access_token', sa.String(), nullable=True),
    sa.Column('refresh_token', sa.String(), nullable=True),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('session_id')
    )


def downgrade():
    op.drop_table('kiosk_sessions')
