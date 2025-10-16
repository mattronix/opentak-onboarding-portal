from sqlalchemy import Integer, Table, Column, ForeignKey, DateTime, String, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship, validates
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from sqlalchemy.exc import IntegrityError
import datetime
# import datetime

db = SQLAlchemy()
migrate = Migrate()

# Define the association table for the many-to-many relationship
role_onboardingcode_association = Table(
    'role_onboardingcode_association',
    db.metadata,
    Column('role_id', Integer, ForeignKey('user_roles.id')),
    Column('onboardingcode_id', Integer, ForeignKey('onboardingcodes.id'))
)

user_onboardingcode_association = Table(
    'user_onboardingcode_association',
    db.metadata,
    Column('user_id', Integer, ForeignKey('users.id')),
    Column('onboardingcode_id', Integer, ForeignKey('onboardingcodes.id'))
)


# Define the association table for the many-to-many relationship
user_takprofile_association = Table(
    'user_takprofile_association',
    db.metadata,
    Column('user_id', Integer, ForeignKey('users.id')),
    Column('takprofile_id', Integer, ForeignKey('takprofiles.id'))
)

role_takprofile_association = Table(
    'role_takprofile_association',
    db.metadata,
    Column('role_id', Integer, ForeignKey('user_roles.id')),
    Column('takprofile_id', Integer, ForeignKey('takprofiles.id'))
)


# Define the association table for the many-to-many relationship
user_role_association = Table(
    'user_role_association',
    db.metadata,
    Column('user_id', Integer, ForeignKey('users.id')),
    Column('role_id', Integer, ForeignKey('user_roles.id'))
)


# Define the association table for the many-to-many relationship
user_meshtastic_association = Table(
    'user_meshtastic_association',
    db.metadata,
    Column('user_id', Integer, ForeignKey('users.id')),
    Column('meshtastic_id', Integer, ForeignKey('meshtastic.id'))
)

role_meshtastic_association = Table(
    'role_meshtastic_association',
    db.metadata,
    Column('role_id', Integer, ForeignKey('user_roles.id')),
    Column('meshtastic_id', Integer, ForeignKey('meshtastic.id'))
)


class UserRoleModel(db.Model):
    __tablename__ = "user_roles"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(unique=True)
    description: Mapped[str] = mapped_column(nullable=True)
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

    meshtastic = relationship(
        "MeshtasticModel",
        secondary=role_meshtastic_association,
        back_populates="roles"
    )

    @staticmethod
    def create_role(name, description=""):
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
    def get_by_id(role_id):
        return UserRoleModel.query.get(role_id)

    @staticmethod
    def get_role_by_name(name):
        return UserRoleModel.query.filter_by(name=name).first()

    @staticmethod
    def get_all_roles():
        return UserRoleModel.query.all()

    @staticmethod
    def update(role):
        try:
            db.session.merge(role)
            db.session.commit()
            return {"message": "Role updated successfully"}
        except:
            return {"error": "role.not.exist"}

    @staticmethod
    def delete_by_id(role_id):
        role = UserRoleModel.get_by_id(role_id)
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
    expiryDate = mapped_column(DateTime, nullable=True) 
    
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

    meshtastic = relationship(
        "MeshtasticModel",
        secondary=user_meshtastic_association,
        back_populates="users"
    )

    @staticmethod
    def create_user(username, email=None, firstname=None, lastname=None, callsign=None, roles=[], takprofiles=[], onboardedby=None, expirydate=None):
        try:
            user = UserModel(username=username.lower(), email=email, firstName=firstname, lastName=lastname, callsign=callsign, roles=roles, takprofiles=takprofiles, onboardedBy=onboardedby, expiryDate=expirydate)
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

            if user.username:
                user.username = user.username.lower()

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
    takPrefFileLocation: Mapped[str] = mapped_column(nullable=True)

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
    def create_tak_profile(name, description, is_public=None, template_folder_location=None, pref_file_location=None, roles=[]):
        try:
            tak_profile = TakProfileModel(name=name, description=description, isPublic=is_public, takTemplateFolderLocation=template_folder_location, takPrefFileLocation=pref_file_location, roles=roles)
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
    expiryDate = mapped_column(DateTime, nullable=True) 
    userExpiryDate = mapped_column(DateTime, nullable=True) 

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
    def create_onboarding_code(onboardingcode, name=None, description=None, users=[], roles=[], onboardcontact=None, maxuses=None, userexpirydate=None, expirydate=None):
        try:
            onboarding_code = OnboardingCodeModel(description=description, name=name, onboardingCode=onboardingcode, users=users, roles=roles, onboardContact=onboardcontact, maxUses=maxuses, userExpiryDate=userexpirydate, expiryDate=expirydate)
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
    def get_onboarding_code_by_code(code):
        return OnboardingCodeModel.query.filter_by(onboardingCode=code).first()

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


class MeshtasticModel(db.Model):
    __tablename__ = "meshtastic"
    id: Mapped[int] = mapped_column(primary_key=True)
    description: Mapped[str] = mapped_column(nullable=True)
    name: Mapped[str] = mapped_column(unique=True, nullable=True)
    url: Mapped[str] = mapped_column(unique=False)
    isPublic: Mapped[bool] = mapped_column(nullable=True, default=True)
    yamlConfig: Mapped[str] = mapped_column(nullable=True)
    defaultRadioConfig: Mapped[bool] = mapped_column(nullable=True, default=False)
    showOnHomepage: Mapped[bool] = mapped_column(nullable=True, default=True)

    @validates('defaultRadioConfig')
    def validate_default_radio_config(self, key, value):
        if value:
            # Ensure only one record has defaultRadioConfig set to True
            existing_default = db.session.query(MeshtasticModel).filter_by(defaultRadioConfig=True).first()
            if existing_default and existing_default.id != self.id:
                raise ValueError("Only one radio can have defaultRadioConfig set to True.")
        return value

    roles = relationship(
        "UserRoleModel",
        secondary=role_meshtastic_association,
        back_populates="meshtastic"
    )
    users = relationship(
        "UserModel",
        secondary=user_meshtastic_association,
        back_populates="meshtastic"
    )
    
    @staticmethod
    def create_meshtastic(name=None, description=None, users=[], roles=[], url=None, yamlConfig=None, defaultRadioConfig=None, showOnHomepage=None, isPublic=None):
        try:
            meshtastic = MeshtasticModel(description=description, name=name, roles=roles, url=url, users=users, yamlConfig=yamlConfig, defaultRadioConfig=defaultRadioConfig, showOnHomepage=showOnHomepage, isPublic=isPublic)
            db.session.add(meshtastic)
            db.session.commit()
            return meshtastic
        except IntegrityError as e:
            db.session.rollback()
            print(f"IntegrityError: {e}")
            return {"error": "onboarding_code.exists"}
        except Exception as e:
            db.session.rollback()
            print(f"Error: {e}")
            return {"error": "onboarding_code.exists"}

    @staticmethod
    def get_by_id(meshtastic_id):
        return MeshtasticModel.query.get(meshtastic_id)

    @staticmethod
    def get_all_meshtastic():
        return MeshtasticModel.query.all()

    @staticmethod
    def update_meshtastic(meshtastic):
        try:
            db.session.merge(meshtastic)
            db.session.commit()
            return {"message": "meshtastitc code updated successfully"}
        except:
            return {"error": "meshtastitc.not.exist"}

    @staticmethod
    def delete_meshtastic_by_id(meshtastic_id):
        meshtastic = MeshtasticModel.get_by_id(meshtastic_id)
        if meshtastic:
            db.session.delete(meshtastic)
            db.session.commit()
            return {"message": "meshtastic code deleted successfully"}
        else:
            return {"error": "meshtastic.not.exist"}
        
class PackageModel(db.Model):
    __tablename__ = "packages"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column()
    platform: Mapped[str] = mapped_column()
    typePackage: Mapped[str] = mapped_column()
    description: Mapped[str] = mapped_column()
    fileLocation: Mapped[str] = mapped_column(nullable=True)
    imageLocation: Mapped[str] = mapped_column(nullable=True)
    version: Mapped[str] = mapped_column()
    revisionCode: Mapped[int] = mapped_column(nullable=True)
    apkHash: Mapped[int] = mapped_column(nullable=True)
    osRequirement: Mapped[str] = mapped_column(nullable=True)
    takPreReq: Mapped[str] = mapped_column(nullable=True)
    apkSize: Mapped[int] = mapped_column(nullable=True)
    fullPackageName: Mapped[str] = mapped_column(nullable=True)

    @staticmethod
    def create(name, description, file_location=None, version=None, image_location=None, platform=None, type_package=None, revision_code=None, apk_hash=None, os_requirement=None, tak_prereq=None, apk_size=None, full_package_name=None):
        try:
            object = PackageModel(name=name, description=description, fileLocation=file_location, version=version, imageLocation=image_location, platform=platform, typePackage=type_package, revisionCode=revision_code, apkHash=apk_hash, osRequirement=os_requirement, takPreReq=tak_prereq, apkSize=apk_size, fullPackageName=full_package_name)
            db.session.add(object)
            db.session.commit()
            return object
        except IntegrityError as e:
            db.session.rollback()
            print(f"IntegrityError: {e}")
            return {"error": "tak_profile.exists"}
        except Exception as e:
            db.session.rollback()
            print(f"Error: {e}")
            return {"error": "tak_profile.exists"}

    @staticmethod
    def get_by_id(id):
        return PackageModel.query.get(id)
    
    @staticmethod
    def get_by_name(name):
        return PackageModel.query.filter_by(name=name).first()
    
    @staticmethod
    def get_all():
        return PackageModel.query.all()
    
    @staticmethod
    def update(object):
        try:
            db.session.merge(object)
            db.session.commit()
            return {"message": "Updated successfully"}
        except:
            return {"error": "object.not.found"}
    
    @staticmethod
    def delete_by_id(id):
        object = PackageModel.get_by_id(id)
        if object:
            db.session.delete(object)
            db.session.commit()
            return {"message": "Tak profile deleted successfully"}
        else:
            return {"error": "object.not.found"}

class RadioModel(db.Model):
    __tablename__ = "radios"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column()
    platform: Mapped[str] = mapped_column()
    radioType = Column(String, CheckConstraint("radioType IN ('meshtastic', 'other')", name="check_radio_type"), nullable=False, default="meshtastic")
    description: Mapped[str] = mapped_column(nullable=True)
    softwareVersion: Mapped[str] = mapped_column(nullable=True)
    model: Mapped[str] = mapped_column(nullable=True)
    vendor: Mapped[str] = mapped_column(nullable=True)
    shortName: Mapped[str] = mapped_column(nullable=True)
    longName: Mapped[str] = mapped_column(nullable=True)
    assignedTo = Column(Integer, ForeignKey('users.id'), nullable=True)
    owner = Column(Integer, ForeignKey('users.id'), nullable=True)
    mac: Mapped[str] = mapped_column(unique=True, nullable=True)
    role: Mapped[str] = mapped_column(nullable=True)
    publicKey: Mapped[str] = mapped_column(nullable=True)
    privateKey: Mapped[str] = mapped_column(nullable=True)
    createdAt: Mapped[datetime.datetime] = mapped_column(default=db.func.current_timestamp(), nullable=True)
    updatedAt: Mapped[datetime.datetime] = mapped_column(default=db.func.current_timestamp(), onupdate=db.func.current_timestamp(), nullable=True)

    @staticmethod
    def create(mac, name, platform, radioType=None, description=None, software_version=None, model=None, vendor=None, shortName=None, longName=None, owner=None, assignedTo=None, role=None, publicKey=None, privateKey=None):
        try:
            object = RadioModel(mac=mac, name=name, platform=platform, radioType=radioType, description=description, softwareVersion=software_version, model=model, vendor=vendor, shortName=shortName, longName=longName, owner=owner, assignedTo=assignedTo, role=role, publicKey=publicKey, privateKey=privateKey)
            db.session.add(object)
            db.session.commit()
            return object
        except IntegrityError as e:
            db.session.rollback()
            print(f"IntegrityError: {e}")
            return {"error": "tak_profile.exists"}
        except Exception as e:
            db.session.rollback()
            print(f"Error: {e}")
            return {"error": "tak_profile.exists"}

    @staticmethod
    def get_by_id(id):
        return RadioModel.query.get(id)
    
    @staticmethod
    def get_by_name(name):
        return RadioModel.query.filter_by(name=name).first()
    
    @staticmethod
    def get_all():
        return RadioModel.query.all()
    
    @staticmethod
    def update(object):
        try:
            db.session.merge(object)
            db.session.commit()
            return {"message": "Updated successfully"}
        except:
            return {"error": "object.not.found"}
    
    @staticmethod
    def delete_by_id(id):
        object = RadioModel.get_by_id(id)
        if object:
            db.session.delete(object)
            db.session.commit()
            return {"message": "Radio deleted successfully"}
        else:
            return {"error": "object.not.found"}

