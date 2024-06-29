from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.orm import DeclarativeBase
from flask_migrate import Migrate
from sqlalchemy import Table, Column, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.exc import IntegrityError
from sqlalchemy import Integer, String, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.orm import relationship
from sqlalchemy.exc import IntegrityError

class Base(DeclarativeBase):
  pass

db = SQLAlchemy(model_class=Base)
migrate = Migrate()

# Define the association table for the many-to-many relationship
role_onboardingcode_association = Table(
    'role_onboardingcode_association',
    Base.metadata,
    Column('role_id', Integer, ForeignKey('user_roles.id')),
    Column('onboardingcode_id', Integer, ForeignKey('onboardingcodes.id'))
)

user_onboardingcode_association = Table(
    'user_onboardingcode_association',
    Base.metadata,
    Column('user_id', Integer, ForeignKey('users.id')),
    Column('onboardingcode_id', Integer, ForeignKey('onboardingcodes.id'))
)


# Define the association table for the many-to-many relationship
user_takprofile_association = Table(
    'user_takprofile_association',
    Base.metadata,
    Column('user_id', Integer, ForeignKey('users.id')),
    Column('takprofile_id', Integer, ForeignKey('takprofiles.id'))
)

role_takprofile_association = Table(
    'role_takprofile_association',
    Base.metadata,
    Column('role_id', Integer, ForeignKey('user_roles.id')),
    Column('takprofile_id', Integer, ForeignKey('takprofiles.id'))
)


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
    description: Mapped[str] = mapped_column(unique=True, nullable=True)
    # Define the many-to-many relationship with UserModel
    users = relationship(
        "UserModel",
        secondary=user_role_association,
        back_populates="roles"
    )
    takprofiles = relationship(
        "TakProfileModel",
        secondary=role_takprofile_association,
        back_populates="roles"
    )
    
    onboarding_codes = relationship(
        "OnboardingCodeModel",
        secondary=role_onboardingcode_association,
        back_populates="roles"
    )

    @staticmethod
    def create_role(name, description=None):
        try:
            role = UserRoleModel(name=name, description=description)
            db.session.add(role)
            db.session.commit()
            return role
        except IntegrityError as e:
            db.session.rollback()
            print(f"IntegrityError: {e}")
            return {"error": "role.exists"}
        except Exception as e:
            db.session.rollback()
            print(f"Error: {e}")
            return {"error": "role.exists"}

    @staticmethod
    def get_role_by_id(role_id):
        return UserRoleModel.query.get(role_id)

    @staticmethod
    def get_role_by_name(name):
        return UserRoleModel.query.filter_by(name=name).first()

    @staticmethod
    def get_all_roles():
        return UserRoleModel.query.all()

    @staticmethod
    def update_role(role):
        try:
            db.session.merge(role)
            db.session.commit()
            return {"message": "Role updated successfully"}
        except:
            return {"error": "role.not.exist"}

    @staticmethod
    def delete_role_by_id(role_id):
        role = UserRoleModel.get_role_by_id(role_id)
        if role:
            db.session.delete(role)
            db.session.commit()
            return {"message": "Role deleted successfully"}
        else:
            return {"error": "role.not.exist"}



class UserModel(db.Model):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True,nullable=True)
    username: Mapped[str] = mapped_column(unique=True,nullable=True)
    email: Mapped[str] = mapped_column(unique=True,nullable=True)
    firstName: Mapped[str] = mapped_column(nullable=True)
    lastName: Mapped[str] = mapped_column(nullable=True)
    callsign: Mapped[str] = mapped_column(nullable=True)
    onboardedBy = Column(ForeignKey("users.id"))
    onboarContactFor = relationship("OnboardingCodeModel", backref="user")

    # Define the many-to-many relationship with UserRoleModel
    roles = relationship(
        "UserRoleModel",
        secondary=user_role_association,
        back_populates="users"
    )

    takprofiles = relationship(
        "TakProfileModel",
        secondary=user_takprofile_association,
        back_populates="users"
    )  

    onboarding_codes = relationship(
        "OnboardingCodeModel",
        secondary=user_onboardingcode_association,
        back_populates="users"
    )

    @staticmethod
    def create_user(username, email=None, firstname=None, lastname=None, callsign=None, roles=[], takprofiles=[], onboardedby=None):
        try:
            user = UserModel(username=username, email=email, firstName=firstname, lastName=lastname, callsign=callsign, roles=roles, takprofiles=takprofiles, onboardedBy=onboardedby)
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


class TakProfileModel(db.Model):
    __tablename__ = "takprofiles"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column()
    description: Mapped[str] = mapped_column()
    isPublic: Mapped[bool] = mapped_column(nullable=True, default=True)
    takTemplateFolderLocation: Mapped[str] = mapped_column(nullable=True)
    
    users = relationship(
        "UserModel",
        secondary=user_takprofile_association,
        back_populates="takprofiles"
    )
    roles = relationship(
        "UserRoleModel",
        secondary=role_takprofile_association,
        back_populates="takprofiles"
    )

    tak_settings = relationship(
        "TakSettingsModel", 
        back_populates="tak_profile"
    )

    @staticmethod
    def create_tak_profile(name, description, is_public=None, template_folder_location=None):
        try:
            tak_profile = TakProfileModel(name=name, description=description, isPublic=is_public, takTemplateFolderLocation=template_folder_location)
            db.session.add(tak_profile)
            db.session.commit()
            return tak_profile
        except IntegrityError as e:
            db.session.rollback()
            print(f"IntegrityError: {e}")
            return {"error": "tak_profile.exists"}
        except Exception as e:
            db.session.rollback()
            print(f"Error: {e}")
            return {"error": "tak_profile.exists"}
    
    @staticmethod
    def get_tak_profile_by_id(tak_profile_id):
        return TakProfileModel.query.get(tak_profile_id)
    
    @staticmethod
    def get_tak_profile_by_name(name):
        return TakProfileModel.query.filter_by(name=name).first()
    
    @staticmethod
    def get_all_tak_profiles():
        return TakProfileModel.query.all()
    
    @staticmethod
    def update_tak_profile(tak_profile):
        try:
            db.session.merge(tak_profile)
            db.session.commit()
            return {"message": "Tak profile updated successfully"}
        except:
            return {"error": "tak_profile.not.exist"}
    
    @staticmethod
    def delete_tak_profile_by_id(tak_profile_id):
        tak_profile = TakProfileModel.get_tak_profile_by_id(tak_profile_id)
        if tak_profile:
            db.session.delete(tak_profile)
            db.session.commit()
            return {"message": "Tak profile deleted successfully"}
        else:
            return {"error": "tak_profile.not.exist"}
        

class TakSettingsModel(db.Model):
    __tablename__ = "taksettings"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column()
    description: Mapped[str] = mapped_column()
    key: Mapped[str] = mapped_column()
    value: Mapped[str] = mapped_column()
    takProfileID: Mapped[int] = mapped_column(ForeignKey('takprofiles.id'))
    tak_profile = relationship("TakProfileModel", back_populates="tak_settings")

    @staticmethod
    def create_tak_setting(name, description, key, value, tak_profile_id):
        try:
            tak_setting = TakSettingsModel(name=name, description=description, key=key, value=value, takProfileID=tak_profile_id)
            db.session.add(tak_setting)
            db.session.commit()
            return tak_setting
        except IntegrityError as e:
            db.session.rollback()
            print(f"IntegrityError: {e}")
            return {"error": "tak_setting.exists"}
        except Exception as e:
            db.session.rollback()
            print(f"Error: {e}")
            return {"error": "tak_setting.exists"}

    @staticmethod
    def get_tak_setting_by_id(tak_setting_id):
        return TakSettingsModel.query.get(tak_setting_id)

    @staticmethod
    def get_tak_settings_by_tak_profile_id(tak_profile_id):
        return TakSettingsModel.query.filter_by(takProfileID=tak_profile_id).all()

    @staticmethod
    def update_tak_setting(tak_setting):
        try:
            db.session.merge(tak_setting)
            db.session.commit()
            return {"message": "Tak setting updated successfully"}
        except:
            return {"error": "tak_setting.not.exist"}

    @staticmethod
    def delete_tak_setting_by_id(tak_setting_id):
        tak_setting = TakSettingsModel.get_tak_setting_by_id(tak_setting_id)
        if tak_setting:
            db.session.delete(tak_setting)
            db.session.commit()
            return {"message": "Tak setting deleted successfully"}
        else:
            return {"error": "tak_setting.not.exist"}


class OnboardingCodeModel(db.Model):
    __tablename__ = "onboardingcodes"
    id: Mapped[int] = mapped_column(primary_key=True)
    description: Mapped[str] = mapped_column(nullable=True)
    name: Mapped[str] = mapped_column(unique=True, nullable=True)
    onboardingCode: Mapped[str] = mapped_column(unique=True)
    uses: Mapped[int] = mapped_column(nullable=True, default=0)
    maxUses: Mapped[int] = mapped_column(nullable=True)
    onboardContact = Column(Integer, ForeignKey('users.id'), nullable=True)

    roles = relationship(
        "UserRoleModel",
        secondary=role_onboardingcode_association,
        back_populates="onboarding_codes"
    )
    users = relationship(
        "UserModel",
        secondary=user_onboardingcode_association,
        back_populates="onboarding_codes"
    )
    
    @staticmethod
    def create_onboarding_code(onboardingcode, name=None, description=None, users=[], roles=[], onboardcontact=None, maxuses=None):
        try:
            onboarding_code = OnboardingCodeModel(description=description, name=name, onboardingCode=onboardingcode, users=users, roles=roles, onboardContact=onboardcontact, maxUses=maxuses)
            db.session.add(onboarding_code)
            db.session.commit()
            return onboarding_code
        except IntegrityError as e:
            db.session.rollback()
            print(f"IntegrityError: {e}")
            return {"error": "onboarding_code.exists"}
        except Exception as e:
            db.session.rollback()
            print(f"Error: {e}")
            return {"error": "onboarding_code.exists"}

    @staticmethod
    def get_onboarding_code_by_id(onboarding_code_id):
        return OnboardingCodeModel.query.get(onboarding_code_id)

    @staticmethod
    def get_all_onboarding_codes():
        return OnboardingCodeModel.query.all()

    @staticmethod
    def update_onboarding_code(onboarding_code):
        try:
            db.session.merge(onboarding_code)
            db.session.commit()
            return {"message": "Onboarding code updated successfully"}
        except:
            return {"error": "onboarding_code.not.exist"}

    @staticmethod
    def delete_onboarding_code_by_id(onboarding_code_id):
        onboarding_code = OnboardingCodeModel.get_onboarding_code_by_id(onboarding_code_id)
        if onboarding_code:
            db.session.delete(onboarding_code)
            db.session.commit()
            return {"message": "Onboarding code deleted successfully"}
        else:
            return {"error": "onboarding_code.not.exist"}
