"""Add OIDC providers and user OIDC fields

Revision ID: 3896982ec7ed
Revises: f5a6b7c8d9e0
Create Date: 2026-02-03 15:59:25.858503

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '3896982ec7ed'
down_revision = 'f5a6b7c8d9e0'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('oidc_providers',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(length=100), nullable=False),
    sa.Column('display_name', sa.String(length=200), nullable=False),
    sa.Column('button_color', sa.String(length=20), nullable=True),
    sa.Column('discovery_url', sa.String(length=500), nullable=False),
    sa.Column('client_id', sa.String(length=500), nullable=False),
    sa.Column('client_secret', sa.String(length=500), nullable=False),
    sa.Column('enabled', sa.Boolean(), nullable=True),
    sa.Column('role_claim', sa.String(length=100), nullable=True),
    sa.Column('role_mappings', sa.Text(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.Column('updated_at', sa.DateTime(), nullable=True),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('name')
    )

    with op.batch_alter_table('users') as batch_op:
        batch_op.add_column(sa.Column('has_password', sa.Boolean(), nullable=True))
        batch_op.add_column(sa.Column('oidc_sub', sa.String(length=500), nullable=True))
        batch_op.add_column(sa.Column('oidc_provider_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key('fk_users_oidc_provider', 'oidc_providers', ['oidc_provider_id'], ['id'])


def downgrade():
    with op.batch_alter_table('users') as batch_op:
        batch_op.drop_constraint('fk_users_oidc_provider', type_='foreignkey')
        batch_op.drop_column('oidc_provider_id')
        batch_op.drop_column('oidc_sub')
        batch_op.drop_column('has_password')

    op.drop_table('oidc_providers')
