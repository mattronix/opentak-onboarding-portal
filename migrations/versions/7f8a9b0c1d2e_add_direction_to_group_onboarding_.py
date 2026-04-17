"""Add direction to group associations

Revision ID: 7f8a9b0c1d2e
Revises: 5cc784adacae
Create Date: 2026-04-17 18:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '7f8a9b0c1d2e'
down_revision = '5cc784adacae'
branch_labels = None
depends_on = None


def column_exists(table_name, column_name):
    """Check if a column already exists in a table (SQLite)."""
    bind = op.get_bind()
    result = bind.execute(sa.text(f"PRAGMA table_info('{table_name}')"))
    columns = [row[1] for row in result]
    return column_name in columns


def upgrade():
    if not column_exists('group_onboardingcode_association', 'direction'):
        with op.batch_alter_table('group_onboardingcode_association') as batch_op:
            batch_op.add_column(sa.Column('direction', sa.String(4), nullable=False, server_default='BOTH'))

    if not column_exists('group_user_association', 'direction'):
        with op.batch_alter_table('group_user_association') as batch_op:
            batch_op.add_column(sa.Column('direction', sa.String(4), nullable=False, server_default='BOTH'))


def downgrade():
    with op.batch_alter_table('group_user_association') as batch_op:
        batch_op.drop_column('direction')

    with op.batch_alter_table('group_onboardingcode_association') as batch_op:
        batch_op.drop_column('direction')
