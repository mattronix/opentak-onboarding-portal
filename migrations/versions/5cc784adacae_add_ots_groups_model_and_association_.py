"""Add OTS groups model and association tables

Revision ID: 5cc784adacae
Revises: 8f8950a7e030
Create Date: 2026-04-17 13:20:57.744135

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '5cc784adacae'
down_revision = '8f8950a7e030'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('ots_groups',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(), nullable=False),
    sa.Column('display_name', sa.String(), nullable=True),
    sa.Column('description', sa.String(), nullable=True),
    sa.Column('direction', sa.String(), nullable=True),
    sa.Column('active', sa.Boolean(), nullable=False),
    sa.Column('synced_at', sa.DateTime(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('name')
    )
    op.create_table('group_user_association',
    sa.Column('group_id', sa.Integer(), nullable=True),
    sa.Column('user_id', sa.Integer(), nullable=True),
    sa.ForeignKeyConstraint(['group_id'], ['ots_groups.id'], ),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], )
    )
    op.create_table('group_onboardingcode_association',
    sa.Column('group_id', sa.Integer(), nullable=True),
    sa.Column('onboardingcode_id', sa.Integer(), nullable=True),
    sa.ForeignKeyConstraint(['group_id'], ['ots_groups.id'], ),
    sa.ForeignKeyConstraint(['onboardingcode_id'], ['onboardingcodes.id'], )
    )


def downgrade():
    op.drop_table('group_onboardingcode_association')
    op.drop_table('group_user_association')
    op.drop_table('ots_groups')
