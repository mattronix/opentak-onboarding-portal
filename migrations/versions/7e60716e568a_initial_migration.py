"""Initial Migration...

Revision ID: 7e60716e568a
Revises: 
Create Date: 2024-06-27 18:07:04.808531

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '7e60716e568a'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table('onboardingcodes',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('description', sa.String(), nullable=False),
    sa.Column('name', sa.String(), nullable=False),
    sa.Column('onboardingCode', sa.String(), nullable=False),
    sa.Column('ownedByUser', sa.Boolean(), nullable=False),
    sa.Column('ownedByRole', sa.Boolean(), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('takprofiles',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(), nullable=False),
    sa.Column('description', sa.String(), nullable=False),
    sa.Column('isPublic', sa.Boolean(), nullable=False),
    sa.Column('takTemplateFolderLocation', sa.String(), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('user_roles',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(), nullable=False),
    sa.Column('description', sa.String(), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('description'),
    sa.UniqueConstraint('name')
    )
    op.create_table('users',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('username', sa.String(), nullable=False),
    sa.Column('email', sa.String(), nullable=False),
    sa.Column('firstName', sa.String(), nullable=False),
    sa.Column('lastName', sa.String(), nullable=False),
    sa.Column('callsign', sa.String(), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('email'),
    sa.UniqueConstraint('username')
    )
    op.create_table('role_onboardingcode_association',
    sa.Column('role_id', sa.Integer(), nullable=True),
    sa.Column('onboardingcode_id', sa.Integer(), nullable=True),
    sa.ForeignKeyConstraint(['onboardingcode_id'], ['onboardingcodes.id'], ),
    sa.ForeignKeyConstraint(['role_id'], ['user_roles.id'], )
    )
    op.create_table('role_takprofile_association',
    sa.Column('role_id', sa.Integer(), nullable=True),
    sa.Column('takprofile_id', sa.Integer(), nullable=True),
    sa.ForeignKeyConstraint(['role_id'], ['user_roles.id'], ),
    sa.ForeignKeyConstraint(['takprofile_id'], ['takprofiles.id'], )
    )
    op.create_table('taksettings',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(), nullable=False),
    sa.Column('description', sa.String(), nullable=False),
    sa.Column('key', sa.String(), nullable=False),
    sa.Column('value', sa.String(), nullable=False),
    sa.Column('takProfileID', sa.Integer(), nullable=False),
    sa.ForeignKeyConstraint(['takProfileID'], ['takprofiles.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('user_onboardingcode_association',
    sa.Column('user_id', sa.Integer(), nullable=True),
    sa.Column('onboardingcode_id', sa.Integer(), nullable=True),
    sa.ForeignKeyConstraint(['onboardingcode_id'], ['onboardingcodes.id'], ),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], )
    )
    op.create_table('user_role_association',
    sa.Column('user_id', sa.Integer(), nullable=True),
    sa.Column('role_id', sa.Integer(), nullable=True),
    sa.ForeignKeyConstraint(['role_id'], ['user_roles.id'], ),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], )
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
    op.drop_table('user_role_association')
    op.drop_table('user_onboardingcode_association')
    op.drop_table('taksettings')
    op.drop_table('role_takprofile_association')
    op.drop_table('role_onboardingcode_association')
    op.drop_table('users')
    op.drop_table('user_roles')
    op.drop_table('takprofiles')
    op.drop_table('onboardingcodes')
    # ### end Alembic commands ###
