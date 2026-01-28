"""Add channel_group_membership table for many-to-many

Revision ID: ee66d18933ab
Revises: d4e5f6a7b8c9
Create Date: 2026-01-28 02:13:38.808263

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'ee66d18933ab'
down_revision = 'd4e5f6a7b8c9'
branch_labels = None
depends_on = None


def upgrade():
    # Create the channel_group_membership table for many-to-many relationship
    op.create_table('channel_group_membership',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('channel_id', sa.Integer(), nullable=False),
        sa.Column('group_id', sa.Integer(), nullable=False),
        sa.Column('slot_number', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['channel_id'], ['meshtastic.id'], ),
        sa.ForeignKeyConstraint(['group_id'], ['meshtastic_channel_groups.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('channel_id', 'group_id', name='unique_channel_group'),
        sa.UniqueConstraint('group_id', 'slot_number', name='unique_group_slot')
    )

    # Migrate existing channel-group relationships to the new table
    # This preserves data from the old group_id/slot_number columns on meshtastic table
    op.execute("""
        INSERT INTO channel_group_membership (channel_id, group_id, slot_number)
        SELECT id, group_id, COALESCE(slot_number, 0)
        FROM meshtastic
        WHERE group_id IS NOT NULL
    """)


def downgrade():
    op.drop_table('channel_group_membership')
