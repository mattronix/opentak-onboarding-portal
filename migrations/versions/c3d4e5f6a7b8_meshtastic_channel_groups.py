"""Meshtastic channel groups

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-01-28 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'c3d4e5f6a7b8'
down_revision = 'b2c3d4e5f6a7'
branch_labels = None
depends_on = None


def upgrade():
    # Create meshtastic_channel_groups table
    op.create_table('meshtastic_channel_groups',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('combined_url', sa.String(), nullable=True),
        sa.Column('isPublic', sa.Boolean(), nullable=True, default=False),
        sa.Column('showOnHomepage', sa.Boolean(), nullable=True, default=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name')
    )

    # Create role association table for groups
    op.create_table('role_meshtastic_group_association',
        sa.Column('role_id', sa.Integer(), nullable=True),
        sa.Column('group_id', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['role_id'], ['user_roles.id'], ),
        sa.ForeignKeyConstraint(['group_id'], ['meshtastic_channel_groups.id'], )
    )

    # Create user association table for groups
    op.create_table('user_meshtastic_group_association',
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('group_id', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['group_id'], ['meshtastic_channel_groups.id'], )
    )

    # Add group_id and slot_number to meshtastic table using batch mode for SQLite compatibility
    with op.batch_alter_table('meshtastic', schema=None) as batch_op:
        batch_op.add_column(sa.Column('group_id', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('slot_number', sa.Integer(), nullable=True))
        batch_op.create_foreign_key('fk_meshtastic_group', 'meshtastic_channel_groups', ['group_id'], ['id'])


def downgrade():
    # Remove foreign key and columns from meshtastic using batch mode for SQLite compatibility
    with op.batch_alter_table('meshtastic', schema=None) as batch_op:
        batch_op.drop_constraint('fk_meshtastic_group', type_='foreignkey')
        batch_op.drop_column('slot_number')
        batch_op.drop_column('group_id')

    # Drop association tables
    op.drop_table('user_meshtastic_group_association')
    op.drop_table('role_meshtastic_group_association')

    # Drop channel groups table
    op.drop_table('meshtastic_channel_groups')
