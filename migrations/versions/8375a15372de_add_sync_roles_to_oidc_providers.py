"""Add sync_roles to OIDC providers

Revision ID: 8375a15372de
Revises: 3896982ec7ed
Create Date: 2026-02-03 16:16:16.440412

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '8375a15372de'
down_revision = '3896982ec7ed'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('oidc_providers', sa.Column('sync_roles', sa.Boolean(), nullable=True))


def downgrade():
    with op.batch_alter_table('oidc_providers') as batch_op:
        batch_op.drop_column('sync_roles')
