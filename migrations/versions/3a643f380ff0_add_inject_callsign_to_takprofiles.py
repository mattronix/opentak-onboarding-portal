"""add injectCallsign to takprofiles

Revision ID: 3a643f380ff0
Revises: 2f532e279ee9
Create Date: 2026-04-29 11:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '3a643f380ff0'
down_revision = '2f532e279ee9'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('takprofiles', sa.Column('injectCallsign', sa.Boolean(), server_default='0', nullable=True))


def downgrade():
    op.drop_column('takprofiles', 'injectCallsign')
