"""Taksettings

Revision ID: 47617b1a80ce
Revises: 6503afc344a5
Create Date: 2024-06-27 18:01:03.486310

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '47617b1a80ce'
down_revision = '6503afc344a5'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table('tak_settings',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(), nullable=False),
    sa.Column('description', sa.String(), nullable=False),
    sa.Column('key', sa.String(), nullable=False),
    sa.Column('value', sa.String(), nullable=False),
    sa.Column('takProfileID', sa.Integer(), nullable=False),
    sa.ForeignKeyConstraint(['takProfileID'], ['takprofiles.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_table('tak_settings')
    # ### end Alembic commands ###
