"""add dismissed to announcement_reads

Revision ID: 124a85b6ba05
Revises: 5b50aaab8a39
Create Date: 2026-01-20 21:42:39.073343

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '124a85b6ba05'
down_revision = '5b50aaab8a39'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('announcement_reads', sa.Column('dismissed', sa.Boolean(), nullable=False, server_default='0'))


def downgrade():
    op.drop_column('announcement_reads', 'dismissed')
