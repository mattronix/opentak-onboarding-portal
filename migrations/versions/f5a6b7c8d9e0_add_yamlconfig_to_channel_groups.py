"""add yamlConfig to channel groups

Revision ID: f5a6b7c8d9e0
Revises: ee66d18933ab
Create Date: 2026-01-28 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'f5a6b7c8d9e0'
down_revision = 'ee66d18933ab'
branch_labels = None
depends_on = None


def upgrade():
    # Use batch mode for SQLite compatibility
    with op.batch_alter_table('meshtastic_channel_groups', schema=None) as batch_op:
        batch_op.add_column(sa.Column('yamlConfig', sa.Text(), nullable=True))


def downgrade():
    with op.batch_alter_table('meshtastic_channel_groups', schema=None) as batch_op:
        batch_op.drop_column('yamlConfig')
