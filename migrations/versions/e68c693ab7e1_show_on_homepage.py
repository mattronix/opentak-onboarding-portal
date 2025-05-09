"""show on homepage

Revision ID: e68c693ab7e1
Revises: 1cb5678a23b2
Create Date: 2025-04-01 17:44:51.419810

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'e68c693ab7e1'
down_revision = '1cb5678a23b2'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column('meshtastic', sa.Column('showOnHomepage', sa.Boolean(), nullable=True))
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_column('meshtastic', 'showOnHomepage')
    # ### end Alembic commands ###
