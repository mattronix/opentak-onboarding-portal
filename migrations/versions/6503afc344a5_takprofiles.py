"""TakProfiles

Revision ID: 6503afc344a5
Revises: 95c533b2dffa
Create Date: 2024-06-27 17:58:07.797658

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '6503afc344a5'
down_revision = '95c533b2dffa'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table('takprofiles',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(), nullable=False),
    sa.Column('description', sa.String(), nullable=False),
    sa.Column('isPublic', sa.Boolean(), nullable=False),
    sa.Column('takTemplateFolderLocation', sa.String(), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('role_takprofile_association',
    sa.Column('role_id', sa.Integer(), nullable=True),
    sa.Column('takprofile_id', sa.Integer(), nullable=True),
    sa.ForeignKeyConstraint(['role_id'], ['user_roles.id'], ),
    sa.ForeignKeyConstraint(['takprofile_id'], ['takprofiles.id'], )
    )
    op.create_table('user_takprofile_association',
    sa.Column('user_id', sa.Integer(), nullable=True),
    sa.Column('takprofile_id', sa.Integer(), nullable=True),
    sa.ForeignKeyConstraint(['takprofile_id'], ['takprofiles.id'], ),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], )
    )
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_table('user_takprofile_association')
    op.drop_table('role_takprofile_association')
    op.drop_table('takprofiles')
    # ### end Alembic commands ###
