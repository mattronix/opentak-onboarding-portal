"""default

Revision ID: 1cb5678a23b2
Revises: 6ccf5d0adcfd
Create Date: 2025-04-01 17:01:03.771255

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '1cb5678a23b2'
down_revision = '6ccf5d0adcfd'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column('meshtastic', sa.Column('defaultRadioConfig', sa.Boolean(), nullable=True))
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_column('meshtastic', 'defaultRadioConfig')
    # ### end Alembic commands ###
