"""clear stale direct profile assignments

Revision ID: 4b754g491aa1
Revises: 3a643f380ff0
Create Date: 2026-04-29 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '4b754g491aa1'
down_revision = '3a643f380ff0'
branch_labels = None
depends_on = None


def upgrade():
    # Clear direct user-profile assignments that were created by the old
    # login sync code. Access is now determined dynamically via roles.
    op.execute('DELETE FROM user_takprofile_association')
    op.execute('DELETE FROM user_meshtastic_association')


def downgrade():
    # Cannot restore deleted data
    pass
