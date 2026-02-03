"""Add icon_url to OIDC providers

Revision ID: c08776f70186
Revises: 8375a15372de
Create Date: 2026-02-03 16:24:49.007802

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'c08776f70186'
down_revision = '8375a15372de'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('oidc_providers', sa.Column('icon_url', sa.String(length=500), nullable=True))


def downgrade():
    with op.batch_alter_table('oidc_providers') as batch_op:
        batch_op.drop_column('icon_url')
