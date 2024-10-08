"""Onboarding Expiry

Revision ID: acb23fb7c062
Revises: 9cf7ffd114fc
Create Date: 2024-08-14 20:37:57.687142

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'acb23fb7c062'
down_revision = '9cf7ffd114fc'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    with op.batch_alter_table('onboardingcodes', schema=None) as batch_op:
        batch_op.add_column(sa.Column('expiryDate', sa.DateTime(), nullable=True))

    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    with op.batch_alter_table('onboardingcodes', schema=None) as batch_op:
        batch_op.drop_column('expiryDate')

    # ### end Alembic commands ###
