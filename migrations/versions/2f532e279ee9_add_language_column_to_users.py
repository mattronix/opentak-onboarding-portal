"""add language column to users

Revision ID: 2f532e279ee9
Revises: 7f8a9b0c1d2e
Create Date: 2026-04-29 10:31:13.209776

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '2f532e279ee9'
down_revision = '7f8a9b0c1d2e'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('users', sa.Column('language', sa.String(length=5), server_default='en', nullable=True))


def downgrade():
    op.drop_column('users', 'language')
