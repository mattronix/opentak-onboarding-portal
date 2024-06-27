from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.orm import DeclarativeBase
from flask_migrate import Migrate
from sqlalchemy import Table, Column, ForeignKey
from sqlalchemy.orm import relationship
from flask import Flask

class Base(DeclarativeBase):
  pass

db = SQLAlchemy(model_class=Base)
migrate = Migrate()

# Define the association table for the many-to-many relationship
user_role_association = Table(
    'user_role_association',
    Base.metadata,
    Column('user_id', Integer, ForeignKey('users.id')),
    Column('role_id', Integer, ForeignKey('user_roles.id'))
)

class UserRoleModel(db.Model):
    __tablename__ = "user_roles"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(unique=True)
    description: Mapped[str] = mapped_column(unique=True)
    # Define the many-to-many relationship with UserModel
    users = relationship(
        "UserModel",
        secondary=user_role_association,
        back_populates="roles"
    )


class UserModel(db.Model):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(unique=True)
    email: Mapped[str] = mapped_column(unique=True)
    firstName: Mapped[str] = mapped_column()
    lastName: Mapped[str] = mapped_column()

    # Define the many-to-many relationship with UserRoleModel
    roles = relationship(
        "UserRoleModel",
        secondary=user_role_association,
        back_populates="users"
    )



