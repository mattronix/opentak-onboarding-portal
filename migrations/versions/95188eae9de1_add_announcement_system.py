"""Add announcement system

Revision ID: 95188eae9de1
Revises: 0cb79f780f88
Create Date: 2026-01-20 15:31:34.282773

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '95188eae9de1'
down_revision = '0cb79f780f88'
branch_labels = None
depends_on = None


def upgrade():
    # Create announcements table
    op.create_table('announcements',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('content', sa.String(), nullable=False),
        sa.Column('target_type', sa.String(), nullable=False),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('scheduled_at', sa.DateTime(), nullable=True),
        sa.Column('sent_at', sa.DateTime(), nullable=True),
        sa.Column('send_email', sa.Boolean(), nullable=False),
        sa.Column('created_by', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # Create announcement_reads table
    op.create_table('announcement_reads',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('announcement_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('read_at', sa.DateTime(), nullable=False),
        sa.Column('email_opened', sa.Boolean(), nullable=False),
        sa.Column('email_opened_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['announcement_id'], ['announcements.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('announcement_id', 'user_id', name='unique_announcement_user_read')
    )

    # Create announcement_role_association table
    op.create_table('announcement_role_association',
        sa.Column('announcement_id', sa.Integer(), nullable=True),
        sa.Column('role_id', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['announcement_id'], ['announcements.id'], ),
        sa.ForeignKeyConstraint(['role_id'], ['user_roles.id'], )
    )

    # Create announcement_user_association table
    op.create_table('announcement_user_association',
        sa.Column('announcement_id', sa.Integer(), nullable=True),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['announcement_id'], ['announcements.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], )
    )


def downgrade():
    op.drop_table('announcement_user_association')
    op.drop_table('announcement_role_association')
    op.drop_table('announcement_reads')
    op.drop_table('announcements')
