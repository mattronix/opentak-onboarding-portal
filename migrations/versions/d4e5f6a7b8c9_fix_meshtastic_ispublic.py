"""Fix meshtastic isPublic default - set all to False

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-01-28 13:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'd4e5f6a7b8c9'
down_revision = 'c3d4e5f6a7b8'
branch_labels = None
depends_on = None


def upgrade():
    # Set all existing meshtastic channels to isPublic=False
    # They were incorrectly defaulting to True before
    op.execute("UPDATE meshtastic SET \"isPublic\" = false WHERE \"isPublic\" = true OR \"isPublic\" IS NULL")
    op.execute("UPDATE meshtastic SET \"showOnHomepage\" = false WHERE \"showOnHomepage\" = true OR \"showOnHomepage\" IS NULL")


def downgrade():
    # No downgrade needed - this is a data fix
    pass
