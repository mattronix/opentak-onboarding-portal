"""add display_name to user_roles

Revision ID: 5b50aaab8a39
Revises: 95188eae9de1
Create Date: 2026-01-20 17:46:42.365233

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '5b50aaab8a39'
down_revision = '95188eae9de1'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('user_roles', sa.Column('display_name', sa.String(), nullable=True))


def downgrade():
    op.drop_column('user_roles', 'display_name')
