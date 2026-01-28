"""Add OTS sync fields to meshtastic

Revision ID: b2c3d4e5f6a7
Revises: aafd21c9ae8e
Create Date: 2026-01-28 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'b2c3d4e5f6a7'
down_revision = 'aafd21c9ae8e'
branch_labels = None
depends_on = None


def upgrade():
    # Add ots_id and synced_at columns for OTS synchronization
    with op.batch_alter_table('meshtastic') as batch_op:
        batch_op.add_column(sa.Column('ots_id', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('synced_at', sa.DateTime(), nullable=True))
        batch_op.create_unique_constraint('uq_meshtastic_ots_id', ['ots_id'])

    # Make url nullable (some configs may be local-only initially)
    with op.batch_alter_table('meshtastic') as batch_op:
        batch_op.alter_column('url', existing_type=sa.String(), nullable=True)


def downgrade():
    with op.batch_alter_table('meshtastic') as batch_op:
        batch_op.drop_constraint('uq_meshtastic_ots_id', type_='unique')
        batch_op.drop_column('synced_at')
        batch_op.drop_column('ots_id')
        batch_op.alter_column('url', existing_type=sa.String(), nullable=False)
