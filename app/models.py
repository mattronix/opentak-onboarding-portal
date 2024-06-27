from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.orm import DeclarativeBase
from flask_migrate import Migrate
from sqlalchemy import Table, Column, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.exc import IntegrityError

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

    @staticmethod
    def create_user(username, email, first_name, last_name):
        try:
            user = UserModel(username=username, email=email, firstName=first_name, lastName=last_name)
            db.session.add(user)
            db.session.commit()
            return user
        except IntegrityError as e:
            db.session.rollback()
            print(f"IntegrityError: {e}")
            return {"error": "user.exists"}
        except Exception as e:
            db.session.rollback()
            print(f"Error: {e}")
            return {"error": "user.exists"}
            
    @staticmethod
    def get_user_by_id(user_id):
        return UserModel.query.get(user_id)
    
    @staticmethod
    def get_user_by_username(username):
        return UserModel.query.filter_by(username=username).first()
    
    @staticmethod
    def get_all_users():
        return UserModel.query.all()
    
    @staticmethod
    def update_user(user):
        try:
            db.session.merge(user)
            db.session.commit()
            return {"message": "User updated successfully"}
        except:
            return {"error": "user.not.eixst"}

    @staticmethod
    def delete_user_by_id(user_id):
        user = UserModel.get_user_by_id(user_id)
        if user:
            db.session.delete(user)
            db.session.commit()
            return {"message": "user.deleted.successfully"}
        else:
            return {"error": "user.not.eixst"}


