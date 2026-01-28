from sqlalchemy import Integer, Table, Column, ForeignKey, DateTime, String, CheckConstraint, UniqueConstraint
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

# Association tables for Meshtastic Channel Groups
role_meshtastic_group_association = Table(
    'role_meshtastic_group_association',
    db.metadata,
    Column('role_id', Integer, ForeignKey('user_roles.id')),
    Column('group_id', Integer, ForeignKey('meshtastic_channel_groups.id'))
)

user_meshtastic_group_association = Table(
    'user_meshtastic_group_association',
    db.metadata,
    Column('user_id', Integer, ForeignKey('users.id')),
    Column('group_id', Integer, ForeignKey('meshtastic_channel_groups.id'))
)

# ChannelGroupMembership is defined below as a proper model class for the association object pattern

# Association tables for announcements
announcement_role_association = Table(
    'announcement_role_association',
    db.metadata,
    Column('announcement_id', Integer, ForeignKey('announcements.id')),
    Column('role_id', Integer, ForeignKey('user_roles.id'))
)

announcement_user_association = Table(
    'announcement_user_association',
    db.metadata,
    Column('announcement_id', Integer, ForeignKey('announcements.id')),
    Column('user_id', Integer, ForeignKey('users.id'))
)

class UserRoleModel(db.Model):
    __tablename__ = "user_roles"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(unique=True)
    display_name: Mapped[str] = mapped_column(nullable=True)
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
    def create_role(name, description="", display_name=None):
        try:
            role = UserRoleModel(name=name, description=description, display_name=display_name)
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
    emailVerified: Mapped[bool] = mapped_column(default=False, nullable=True) 
    
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

            # Don't use merge() as it doesn't handle relationship changes properly
            # The user object is already attached to the session
            db.session.add(user)
            db.session.commit()
            return {"message": "User updated successfully"}
        except:
            db.session.rollback()
            return {"error": "user.not.exist"}

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
    onboardContactId = Column(Integer, ForeignKey('users.id'), nullable=True)
    expiryDate = mapped_column(DateTime, nullable=True)
    userExpiryDate = mapped_column(DateTime, nullable=True)
    autoApprove: Mapped[bool] = mapped_column(default=False, nullable=False)

    # Approval workflow settings
    requireApproval: Mapped[bool] = mapped_column(default=False, nullable=False)
    approverRoleId = Column(Integer, ForeignKey('user_roles.id'), nullable=True)

    # Relationship to UserModel for onboard contact
    onboardContact = relationship("UserModel", foreign_keys=[onboardContactId], overlaps="onboarContactFor,user")

    # Relationship to UserRoleModel for approver role
    approverRole = relationship("UserRoleModel", foreign_keys=[approverRoleId])

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
    def create_onboarding_code(onboardingcode, name=None, description=None, users=[], roles=[], onboardcontact=None, maxuses=None, userexpirydate=None, expirydate=None, autoapprove=False, requireapproval=False, approverroleid=None):
        try:
            onboarding_code = OnboardingCodeModel(
                description=description,
                name=name,
                onboardingCode=onboardingcode,
                users=users,
                roles=roles,
                onboardContactId=onboardcontact,
                maxUses=maxuses,
                userExpiryDate=userexpirydate,
                expiryDate=expirydate,
                autoApprove=autoapprove,
                requireApproval=requireapproval,
                approverRoleId=approverroleid
            )
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
    # OTS sync fields
    ots_id: Mapped[int] = mapped_column(nullable=True, unique=True)  # ID from OTS for syncing
    synced_at: Mapped[datetime.datetime] = mapped_column(nullable=True)  # Last sync timestamp
    # Fields synced with OTS
    name: Mapped[str] = mapped_column(unique=True, nullable=True)
    description: Mapped[str] = mapped_column(nullable=True)
    url: Mapped[str] = mapped_column(unique=False, nullable=True)  # channel_url in OTS
    # Local-only fields (not synced with OTS)
    isPublic: Mapped[bool] = mapped_column(nullable=True, default=False)
    yamlConfig: Mapped[str] = mapped_column(nullable=True)  # Optional YAML config
    defaultRadioConfig: Mapped[bool] = mapped_column(nullable=True, default=False)
    showOnHomepage: Mapped[bool] = mapped_column(nullable=True, default=False)
    # DEPRECATED: Old single-group fields - kept for migration compatibility
    # Use group_memberships relationship instead for multiple group support
    group_id: Mapped[int] = mapped_column(ForeignKey('meshtastic_channel_groups.id'), nullable=True)
    slot_number: Mapped[int] = mapped_column(nullable=True)  # 0-7, slot 0 is primary channel

    # Old relationship - kept for backwards compatibility during migration
    group = relationship("MeshtasticChannelGroup", back_populates="channels", foreign_keys=[group_id])

    # New many-to-many relationship through ChannelGroupMembership
    group_memberships = relationship("ChannelGroupMembership", back_populates="channel", cascade="all, delete-orphan")

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
    def create_meshtastic(name=None, description=None, users=[], roles=[], url=None, yamlConfig=None, defaultRadioConfig=None, showOnHomepage=None, isPublic=None, ots_id=None):
        try:
            meshtastic = MeshtasticModel(
                name=name,
                description=description,
                url=url,
                roles=roles,
                users=users,
                yamlConfig=yamlConfig,
                defaultRadioConfig=defaultRadioConfig,
                showOnHomepage=showOnHomepage,
                isPublic=isPublic,
                ots_id=ots_id
            )
            db.session.add(meshtastic)
            db.session.commit()
            return meshtastic
        except IntegrityError as e:
            db.session.rollback()
            print(f"IntegrityError: {e}")
            return {"error": "meshtastic.exists"}
        except Exception as e:
            db.session.rollback()
            print(f"Error: {e}")
            return {"error": "meshtastic.create.failed"}

    @staticmethod
    def get_by_ots_id(ots_id):
        """Get a Meshtastic config by its OTS ID"""
        return MeshtasticModel.query.filter_by(ots_id=ots_id).first()

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


class MeshtasticChannelGroup(db.Model):
    """
    A group of Meshtastic channels (up to 8 slots).
    Slot 0 is the primary channel, slots 1-7 are secondary channels.
    All channels in a group share the same LoRa modem configuration.
    """
    __tablename__ = "meshtastic_channel_groups"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(unique=True, nullable=False)
    description: Mapped[str] = mapped_column(nullable=True)
    # Combined URL that sets up all channels in the group (optional, generated from channels)
    combined_url: Mapped[str] = mapped_column(nullable=True)
    # Visibility and access
    isPublic: Mapped[bool] = mapped_column(nullable=True, default=False)
    showOnHomepage: Mapped[bool] = mapped_column(nullable=True, default=True)
    # YAML config for radio device settings (supports placeholders: ${shortName}, ${longName}, ${mac}, ${callsign})
    yamlConfig: Mapped[str] = mapped_column(db.Text, nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(default=datetime.datetime.utcnow)
    updated_at: Mapped[datetime.datetime] = mapped_column(default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    # DEPRECATED: Old direct relationship - kept for migration
    channels = relationship("MeshtasticModel", back_populates="group", order_by="MeshtasticModel.slot_number", foreign_keys="MeshtasticModel.group_id")

    # New many-to-many relationship through ChannelGroupMembership
    channel_memberships = relationship("ChannelGroupMembership", back_populates="group", cascade="all, delete-orphan", order_by="ChannelGroupMembership.slot_number")

    # Role and user access
    roles = relationship(
        "UserRoleModel",
        secondary=role_meshtastic_group_association,
        backref="meshtastic_groups"
    )
    users = relationship(
        "UserModel",
        secondary=user_meshtastic_group_association,
        backref="meshtastic_groups"
    )

    @staticmethod
    def get_by_id(group_id):
        return MeshtasticChannelGroup.query.get(group_id)

    @staticmethod
    def get_all():
        return MeshtasticChannelGroup.query.all()

    def get_channels_by_slot(self):
        """Returns a dict of slot_number -> channel for easy access (using new membership model)"""
        return {m.slot_number: m.channel for m in self.channel_memberships if m.slot_number is not None}

    def get_channel_memberships_by_slot(self):
        """Returns a dict of slot_number -> membership for easy access"""
        return {m.slot_number: m for m in self.channel_memberships}

    def get_primary_channel(self):
        """Returns the primary channel (slot 0)"""
        for m in self.channel_memberships:
            if m.slot_number == 0:
                return m.channel
        return None

    def validate_slot(self, slot_number, exclude_channel_id=None):
        """Check if a slot number is valid (0-7) and available"""
        if slot_number < 0 or slot_number > 7:
            return False, "Slot number must be between 0 and 7"
        for m in self.channel_memberships:
            if m.slot_number == slot_number and m.channel_id != exclude_channel_id:
                return False, f"Slot {slot_number} is already occupied by channel '{m.channel.name}'"
        return True, None

    @property
    def channel_count(self):
        """Return the number of channels in this group"""
        return len(self.channel_memberships)


class ChannelGroupMembership(db.Model):
    """
    Association object for channel-group many-to-many relationship.
    Stores the slot_number for each channel within each group.
    """
    __tablename__ = "channel_group_membership"
    id: Mapped[int] = mapped_column(primary_key=True)
    channel_id: Mapped[int] = mapped_column(ForeignKey('meshtastic.id'), nullable=False)
    group_id: Mapped[int] = mapped_column(ForeignKey('meshtastic_channel_groups.id'), nullable=False)
    slot_number: Mapped[int] = mapped_column(nullable=False)  # 0-7, slot position within this group

    # Relationships
    channel = relationship("MeshtasticModel", back_populates="group_memberships")
    group = relationship("MeshtasticChannelGroup", back_populates="channel_memberships")

    __table_args__ = (
        UniqueConstraint('group_id', 'slot_number', name='unique_group_slot'),
        UniqueConstraint('channel_id', 'group_id', name='unique_channel_group'),
    )

    @staticmethod
    def get_by_channel_and_group(channel_id, group_id):
        return ChannelGroupMembership.query.filter_by(channel_id=channel_id, group_id=group_id).first()


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


class PendingRegistrationModel(db.Model):
    """
    Model for pending user registrations awaiting email verification or approval
    """
    __tablename__ = "pending_registrations"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(unique=True, nullable=False)
    email: Mapped[str] = mapped_column(unique=True, nullable=False)
    password: Mapped[str] = mapped_column(nullable=False)  # Store temporarily for OTS creation
    firstName: Mapped[str] = mapped_column(nullable=True)
    lastName: Mapped[str] = mapped_column(nullable=True)
    callsign: Mapped[str] = mapped_column(nullable=True)
    onboarding_code_id: Mapped[int] = mapped_column(ForeignKey('onboardingcodes.id'), nullable=False)
    verification_token: Mapped[str] = mapped_column(unique=True, nullable=False)
    expires_at: Mapped[datetime.datetime] = mapped_column(nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(default=db.func.current_timestamp(), nullable=False)

    # Approval workflow fields
    # Status: 'pending_verification' (email), 'pending_approval' (approver), 'approved', 'rejected'
    approval_status: Mapped[str] = mapped_column(default='pending_verification', nullable=False)
    approval_token: Mapped[str] = mapped_column(unique=True, nullable=True)  # Token for approve/reject links
    approved_by: Mapped[int] = mapped_column(ForeignKey('users.id'), nullable=True)
    approved_at: Mapped[datetime.datetime] = mapped_column(nullable=True)

    onboarding_code = relationship("OnboardingCodeModel")
    approver = relationship("UserModel", foreign_keys=[approved_by])

    @staticmethod
    def create_pending_registration(username, email, password, first_name, last_name, callsign, onboarding_code_id, verification_token, expires_at):
        try:
            pending = PendingRegistrationModel(
                username=username.lower(),
                email=email,
                password=password,
                firstName=first_name,
                lastName=last_name,
                callsign=callsign,
                onboarding_code_id=onboarding_code_id,
                verification_token=verification_token,
                expires_at=expires_at
            )
            db.session.add(pending)
            db.session.commit()
            return pending
        except IntegrityError as e:
            db.session.rollback()
            print(f"IntegrityError: {e}")
            return None
        except Exception as e:
            db.session.rollback()
            print(f"Error: {e}")
            return None

    @staticmethod
    def get_by_token(token):
        return PendingRegistrationModel.query.filter_by(verification_token=token).first()

    @staticmethod
    def delete_by_id(pending_id):
        pending = PendingRegistrationModel.query.get(pending_id)
        if pending:
            db.session.delete(pending)
            db.session.commit()
            return True
        return False

    @staticmethod
    def cleanup_expired():
        """Delete expired pending registrations"""
        try:
            expired = PendingRegistrationModel.query.filter(
                PendingRegistrationModel.expires_at < datetime.datetime.now()
            ).all()
            for pending in expired:
                db.session.delete(pending)
            db.session.commit()
            return len(expired)
        except Exception as e:
            db.session.rollback()
            print(f"Error cleaning up expired registrations: {e}")
            return 0


class OneTimeTokenModel(db.Model):
    """
    Model for one-time use tokens for password reset and email verification
    """
    __tablename__ = "one_time_tokens"

    id: Mapped[int] = mapped_column(primary_key=True)
    token: Mapped[str] = mapped_column(unique=True, nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id'), nullable=False)
    token_type: Mapped[str] = mapped_column(nullable=False)  # 'password_reset', 'email_verification', etc.
    is_used: Mapped[bool] = mapped_column(default=False, nullable=False)
    expires_at: Mapped[datetime.datetime] = mapped_column(nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(default=db.func.current_timestamp(), nullable=False)
    used_at: Mapped[datetime.datetime] = mapped_column(nullable=True)

    user = relationship("UserModel", backref="tokens")

    @staticmethod
    def create_token(user_id, token, token_type, expires_at):
        """Create a new one-time use token"""
        try:
            new_token = OneTimeTokenModel(
                user_id=user_id,
                token=token,
                token_type=token_type,
                expires_at=expires_at
            )
            db.session.add(new_token)
            db.session.commit()
            return new_token
        except Exception as e:
            db.session.rollback()
            print(f"Error creating token: {e}")
            return None

    @staticmethod
    def get_token(token, token_type):
        """Get a token by value and type"""
        return OneTimeTokenModel.query.filter_by(
            token=token,
            token_type=token_type
        ).first()

    @staticmethod
    def validate_and_use_token(token, token_type):
        """
        Validate a token and mark it as used
        Returns the user_id if valid, None otherwise
        """
        token_obj = OneTimeTokenModel.get_token(token, token_type)

        if not token_obj:
            return None

        # Check if already used
        if token_obj.is_used:
            return None

        # Check if expired
        if datetime.datetime.now() > token_obj.expires_at:
            return None

        # Mark as used
        token_obj.is_used = True
        token_obj.used_at = datetime.datetime.now()
        db.session.commit()

        return token_obj.user_id

    @staticmethod
    def cleanup_expired_tokens():
        """Delete expired tokens (for maintenance)"""
        try:
            expired = OneTimeTokenModel.query.filter(
                OneTimeTokenModel.expires_at < datetime.datetime.now()
            ).all()
            for token in expired:
                db.session.delete(token)
            db.session.commit()
            return len(expired)
        except Exception as e:
            db.session.rollback()
            print(f"Error cleaning up tokens: {e}")
            return 0


class SystemSettingsModel(db.Model):
    """
    Model for system-wide settings
    """
    __tablename__ = "system_settings"

    id: Mapped[int] = mapped_column(primary_key=True)
    key: Mapped[str] = mapped_column(unique=True, nullable=False)
    value: Mapped[str] = mapped_column(nullable=False)
    category: Mapped[str] = mapped_column(nullable=False)  # e.g., 'notifications', 'email', 'security'
    description: Mapped[str] = mapped_column(nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(default=db.func.current_timestamp(), nullable=False)
    updated_at: Mapped[datetime.datetime] = mapped_column(default=db.func.current_timestamp(), onupdate=db.func.current_timestamp(), nullable=False)

    @staticmethod
    def get_setting(key, default=None):
        """Get a setting value by key"""
        setting = SystemSettingsModel.query.filter_by(key=key).first()
        if setting:
            # Parse boolean values
            if setting.value.lower() in ['true', 'false']:
                return setting.value.lower() == 'true'
            return setting.value
        return default

    @staticmethod
    def set_setting(key, value, category='general', description=None):
        """Set or update a setting"""
        try:
            setting = SystemSettingsModel.query.filter_by(key=key).first()

            # Convert boolean to string
            if isinstance(value, bool):
                value = str(value).lower()

            if setting:
                setting.value = value
                setting.updated_at = datetime.datetime.now()
            else:
                setting = SystemSettingsModel(
                    key=key,
                    value=value,
                    category=category,
                    description=description
                )
                db.session.add(setting)

            db.session.commit()
            return setting
        except Exception as e:
            db.session.rollback()
            print(f"Error setting value: {e}")
            return None

    @staticmethod
    def get_category_settings(category):
        """Get all settings for a category"""
        return SystemSettingsModel.query.filter_by(category=category).all()

    @staticmethod
    def initialize_defaults():
        """Initialize default settings"""
        defaults = [
            # Notifications
            {
                'key': 'notify_admin_pending_registration',
                'value': 'true',
                'category': 'notifications',
                'description': 'Send notification to admin when a new pending registration is created'
            },
            {
                'key': 'notify_admin_new_registration',
                'value': 'true',
                'category': 'notifications',
                'description': 'Send notification to admin when a new user completes registration'
            },
            # Registration Settings
            {
                'key': 'allow_manual_approval',
                'value': 'true',
                'category': 'registration',
                'description': 'Allow administrators to manually approve pending registrations without email verification'
            },
            # General - Branding (enabled flag + value)
            {
                'key': 'brand_name_enabled',
                'value': 'true',
                'category': 'general',
                'description': 'Enable custom portal name'
            },
            {
                'key': 'brand_name_value',
                'value': 'My OTS Portal',
                'category': 'general',
                'description': 'Portal name displayed in the header'
            },
            {
                'key': 'help_link_enabled',
                'value': 'false',
                'category': 'general',
                'description': 'Show Help / How to Install button on dashboard'
            },
            {
                'key': 'help_link_value',
                'value': '',
                'category': 'general',
                'description': 'URL for the Help / How to Install button'
            },
            {
                'key': 'help_email_enabled',
                'value': 'false',
                'category': 'general',
                'description': 'Show support email'
            },
            {
                'key': 'help_email_value',
                'value': '',
                'category': 'general',
                'description': 'Support email address'
            },
            # General - Feature Toggles
            {
                'key': 'atak_homepage_icon_enabled',
                'value': 'true',
                'category': 'general',
                'description': 'Show ATAK download icon on the dashboard'
            },
            {
                'key': 'itak_homepage_icon_enabled',
                'value': 'true',
                'category': 'general',
                'description': 'Show iTAK download icon on the dashboard'
            },
            {
                'key': 'truststore_homepage_icon_enabled',
                'value': 'false',
                'category': 'general',
                'description': 'Show TrustStore download icon on the dashboard'
            },
            {
                'key': 'zerotier_icon',
                'value': 'false',
                'category': 'general',
                'description': 'Show ZeroTier download icon on the dashboard'
            },
            {
                'key': 'meshtastic_homepage_icon_enabled',
                'value': 'true',
                'category': 'general',
                'description': 'Show Meshtastic download icon on the dashboard'
            },
            {
                'key': 'claim_radio_enabled',
                'value': 'false',
                'category': 'radios',
                'description': 'Allow users to claim unowned radios by visiting a claim URL'
            },
            {
                'key': 'user_program_radio_enabled',
                'value': 'false',
                'category': 'radios',
                'description': 'Allow users to program their assigned radios from the dashboard'
            },
            # Installer QR Codes
            {
                'key': 'atak_installer_qr_enabled',
                'value': 'true',
                'category': 'general',
                'description': 'Show QR code for ATAK app download'
            },
            {
                'key': 'atak_installer_qr_url',
                'value': 'https://play.google.com/store/apps/details?id=com.atakmap.app.civ&hl=en',
                'category': 'general',
                'description': 'URL for ATAK installer QR code'
            },
            {
                'key': 'itak_installer_qr_enabled',
                'value': 'true',
                'category': 'general',
                'description': 'Show QR code for iTAK app download'
            },
            {
                'key': 'itak_installer_qr_url',
                'value': 'https://apps.apple.com/app/itak/id1561656396',
                'category': 'general',
                'description': 'URL for iTAK installer QR code'
            },
            {
                'key': 'meshtastic_installer_qr_android_enabled',
                'value': 'true',
                'category': 'general',
                'description': 'Show QR code for Meshtastic Android app download'
            },
            {
                'key': 'meshtastic_installer_qr_android_url',
                'value': 'https://play.google.com/store/apps/details?id=com.geeksville.mesh',
                'category': 'general',
                'description': 'URL for Meshtastic Android installer QR code'
            },
            {
                'key': 'meshtastic_installer_qr_iphone_enabled',
                'value': 'true',
                'category': 'general',
                'description': 'Show QR code for Meshtastic iPhone app download'
            },
            {
                'key': 'meshtastic_installer_qr_iphone_url',
                'value': 'https://apps.apple.com/app/meshtastic/id1586432531',
                'category': 'general',
                'description': 'URL for Meshtastic iPhone installer QR code'
            },
            {
                'key': 'generate_atak_qr_code',
                'value': 'true',
                'category': 'qr_enrollment',
                'description': 'Show QR code for ATAK (Android) enrollment on the dashboard'
            },
            {
                'key': 'generate_itak_qr_code',
                'value': 'true',
                'category': 'qr_enrollment',
                'description': 'Show QR code for iTAK (iOS) enrollment on the dashboard'
            },
            {
                'key': 'qr_token_expiry_minutes',
                'value': '60',
                'category': 'qr_enrollment',
                'description': 'QR code token expiry time in minutes'
            },
            {
                'key': 'qr_token_max_uses',
                'value': '1',
                'category': 'qr_enrollment',
                'description': 'Maximum number of uses per QR code token'
            },
            {
                'key': 'callsign_qr_code_enabled',
                'value': 'true',
                'category': 'qr_enrollment',
                'description': 'Show QR code to set callsign in ATAK app'
            },
            {
                'key': 'forgot_password_enabled',
                'value': 'true',
                'category': 'general',
                'description': 'Enable forgot password functionality'
            },
            # Branding settings
            {
                'key': 'custom_logo_enabled',
                'value': 'false',
                'category': 'branding',
                'description': 'Enable custom logo display'
            },
            {
                'key': 'custom_logo_path',
                'value': '',
                'category': 'branding',
                'description': 'Path to uploaded custom logo file'
            },
            {
                'key': 'logo_display_mode',
                'value': 'logo_and_text',
                'category': 'branding',
                'description': 'How to display logo and brand name (logo_only, text_only, logo_and_text)'
            },
            {
                'key': 'primary_color',
                'value': '#000000',
                'category': 'branding',
                'description': 'Primary color for the portal theme'
            },
            {
                'key': 'accent_color',
                'value': '#ff9800',
                'category': 'branding',
                'description': 'Accent color for buttons and highlights'
            }
        ]

        # Remove old/deprecated settings
        deprecated_keys = ['brand_name', 'help_link', 'help_email', 'auto_approve_registration', 'secondary_color']
        for key in deprecated_keys:
            old_setting = SystemSettingsModel.query.filter_by(key=key).first()
            if old_setting:
                db.session.delete(old_setting)
        db.session.commit()

        # Migrate QR-related settings to new category
        qr_setting_keys = ['generate_atak_qr_code', 'generate_itak_qr_code', 'qr_token_expiry_minutes', 'qr_token_max_uses']
        for key in qr_setting_keys:
            setting = SystemSettingsModel.query.filter_by(key=key).first()
            if setting and setting.category != 'qr_enrollment':
                setting.category = 'qr_enrollment'
        db.session.commit()

        for default in defaults:
            existing = SystemSettingsModel.query.filter_by(key=default['key']).first()
            if not existing:
                SystemSettingsModel.set_setting(
                    key=default['key'],
                    value=default['value'],
                    category=default['category'],
                    description=default['description']
                )


class AnnouncementModel(db.Model):
    """
    Model for announcements that can be sent to users/roles
    """
    __tablename__ = "announcements"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(nullable=False)
    content: Mapped[str] = mapped_column(nullable=False)  # HTML/Markdown content

    # Target type: 'all', 'roles', 'users'
    target_type = Column(
        String,
        CheckConstraint("target_type IN ('all', 'roles', 'users')", name="check_announcement_target_type"),
        nullable=False,
        default='all'
    )

    # Status: 'draft', 'scheduled', 'sent'
    status = Column(
        String,
        CheckConstraint("status IN ('draft', 'scheduled', 'sent')", name="check_announcement_status"),
        nullable=False,
        default='draft'
    )

    # Scheduling
    scheduled_at: Mapped[datetime.datetime] = mapped_column(nullable=True)
    sent_at: Mapped[datetime.datetime] = mapped_column(nullable=True)

    # Email options
    send_email: Mapped[bool] = mapped_column(default=False, nullable=False)

    # Metadata
    created_by: Mapped[int] = mapped_column(ForeignKey('users.id'), nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(default=db.func.current_timestamp(), nullable=False)
    updated_at: Mapped[datetime.datetime] = mapped_column(default=db.func.current_timestamp(), onupdate=db.func.current_timestamp(), nullable=False)

    # Relationships
    creator = relationship("UserModel", foreign_keys=[created_by])

    target_roles = relationship(
        "UserRoleModel",
        secondary=announcement_role_association,
        backref="announcements"
    )

    target_users = relationship(
        "UserModel",
        secondary=announcement_user_association,
        backref="targeted_announcements"
    )

    reads = relationship("AnnouncementReadModel", back_populates="announcement", cascade="all, delete-orphan")

    @staticmethod
    def get_by_id(announcement_id):
        return AnnouncementModel.query.get(announcement_id)

    @staticmethod
    def get_all():
        return AnnouncementModel.query.order_by(AnnouncementModel.created_at.desc()).all()

    @staticmethod
    def get_scheduled_due():
        """Get announcements that are scheduled and due for sending"""
        now = datetime.datetime.now()
        return AnnouncementModel.query.filter(
            AnnouncementModel.status == 'scheduled',
            AnnouncementModel.scheduled_at <= now
        ).all()

    @staticmethod
    def get_user_announcements(user_id):
        """Get all sent announcements visible to a specific user"""
        user = UserModel.get_user_by_id(user_id)
        if not user:
            return []

        user_role_ids = [r.id for r in user.roles]

        # Announcements targeting all users, or specific roles user has, or user directly
        return AnnouncementModel.query.filter(
            AnnouncementModel.status == 'sent',
            db.or_(
                AnnouncementModel.target_type == 'all',
                db.and_(
                    AnnouncementModel.target_type == 'roles',
                    AnnouncementModel.target_roles.any(UserRoleModel.id.in_(user_role_ids))
                ),
                db.and_(
                    AnnouncementModel.target_type == 'users',
                    AnnouncementModel.target_users.any(UserModel.id == user_id)
                )
            )
        ).order_by(AnnouncementModel.sent_at.desc()).all()

    @staticmethod
    def delete_by_id(announcement_id):
        announcement = AnnouncementModel.get_by_id(announcement_id)
        if announcement:
            db.session.delete(announcement)
            db.session.commit()
            return {"message": "Announcement deleted successfully"}
        return {"error": "announcement.not.found"}


class AnnouncementReadModel(db.Model):
    """
    Model for tracking announcement reads
    """
    __tablename__ = "announcement_reads"

    id: Mapped[int] = mapped_column(primary_key=True)
    announcement_id: Mapped[int] = mapped_column(ForeignKey('announcements.id'), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id'), nullable=False)
    read_at: Mapped[datetime.datetime] = mapped_column(default=db.func.current_timestamp(), nullable=False)
    email_opened: Mapped[bool] = mapped_column(default=False, nullable=False)
    email_opened_at: Mapped[datetime.datetime] = mapped_column(nullable=True)
    dismissed: Mapped[bool] = mapped_column(default=False, nullable=False)

    # Unique constraint: one read record per user per announcement
    __table_args__ = (
        db.UniqueConstraint('announcement_id', 'user_id', name='unique_announcement_user_read'),
    )

    # Relationships
    announcement = relationship("AnnouncementModel", back_populates="reads")
    user = relationship("UserModel")

    @staticmethod
    def mark_as_read(announcement_id, user_id):
        existing = AnnouncementReadModel.query.filter_by(
            announcement_id=announcement_id,
            user_id=user_id
        ).first()

        if existing:
            return existing

        try:
            read_record = AnnouncementReadModel(
                announcement_id=announcement_id,
                user_id=user_id
            )
            db.session.add(read_record)
            db.session.commit()
            return read_record
        except:
            db.session.rollback()
            return None

    @staticmethod
    def mark_email_opened(announcement_id, user_id):
        read_record = AnnouncementReadModel.query.filter_by(
            announcement_id=announcement_id,
            user_id=user_id
        ).first()

        if read_record and not read_record.email_opened:
            read_record.email_opened = True
            read_record.email_opened_at = datetime.datetime.now()
            db.session.commit()

        return read_record

    @staticmethod
    def get_read_stats(announcement_id):
        """Get read statistics for an announcement"""
        total_reads = AnnouncementReadModel.query.filter_by(announcement_id=announcement_id).count()
        email_opens = AnnouncementReadModel.query.filter_by(
            announcement_id=announcement_id,
            email_opened=True
        ).count()

        return {
            'total_reads': total_reads,
            'email_opens': email_opens
        }

    @staticmethod
    def is_read(announcement_id, user_id):
        return AnnouncementReadModel.query.filter_by(
            announcement_id=announcement_id,
            user_id=user_id
        ).first() is not None

    @staticmethod
    def is_dismissed(announcement_id, user_id):
        record = AnnouncementReadModel.query.filter_by(
            announcement_id=announcement_id,
            user_id=user_id
        ).first()
        return record.dismissed if record else False

    @staticmethod
    def dismiss(announcement_id, user_id):
        """Dismiss an announcement for a user (hides it from their list)"""
        existing = AnnouncementReadModel.query.filter_by(
            announcement_id=announcement_id,
            user_id=user_id
        ).first()

        if existing:
            existing.dismissed = True
            db.session.commit()
            return existing

        try:
            read_record = AnnouncementReadModel(
                announcement_id=announcement_id,
                user_id=user_id,
                dismissed=True
            )
            db.session.add(read_record)
            db.session.commit()
            return read_record
        except:
            db.session.rollback()
            return None


class ApiKeyModel(db.Model):
    """
    Model for API keys that allow external systems to access the API
    """
    __tablename__ = "api_keys"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(nullable=False)
    description: Mapped[str] = mapped_column(nullable=True)
    key_prefix: Mapped[str] = mapped_column(nullable=False)
    key_hash: Mapped[str] = mapped_column(unique=True, nullable=False)
    permissions: Mapped[str] = mapped_column(nullable=False, default='[]')
    rate_limit: Mapped[int] = mapped_column(nullable=True, default=1000)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)
    expires_at: Mapped[datetime.datetime] = mapped_column(nullable=True)
    created_by: Mapped[int] = mapped_column(ForeignKey('users.id'), nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(default=db.func.current_timestamp(), nullable=False)
    last_used_at: Mapped[datetime.datetime] = mapped_column(nullable=True)
    last_used_ip: Mapped[str] = mapped_column(nullable=True)
    usage_count: Mapped[int] = mapped_column(default=0, nullable=False)

    creator = relationship("UserModel", foreign_keys=[created_by])

    @staticmethod
    def generate_key():
        import secrets
        return f"otak_{secrets.token_urlsafe(32)}"

    @staticmethod
    def hash_key(raw_key):
        import hashlib
        return hashlib.sha256(raw_key.encode()).hexdigest()

    @staticmethod
    def get_key_prefix(raw_key):
        return raw_key[:12] if raw_key else None

    @staticmethod
    def create_api_key(name, created_by, description=None, permissions=None, rate_limit=1000, expires_at=None):
        import json
        try:
            raw_key = ApiKeyModel.generate_key()
            api_key = ApiKeyModel(
                name=name,
                description=description,
                key_prefix=ApiKeyModel.get_key_prefix(raw_key),
                key_hash=ApiKeyModel.hash_key(raw_key),
                permissions=json.dumps(permissions or []),
                rate_limit=rate_limit,
                expires_at=expires_at,
                created_by=created_by
            )
            db.session.add(api_key)
            db.session.commit()
            return api_key, raw_key
        except IntegrityError:
            db.session.rollback()
            return None, None
        except Exception:
            db.session.rollback()
            return None, None

    @staticmethod
    def get_by_id(api_key_id):
        return ApiKeyModel.query.get(api_key_id)

    @staticmethod
    def get_by_key(raw_key):
        key_hash = ApiKeyModel.hash_key(raw_key)
        return ApiKeyModel.query.filter_by(key_hash=key_hash).first()

    @staticmethod
    def get_all():
        return ApiKeyModel.query.order_by(ApiKeyModel.created_at.desc()).all()

    @staticmethod
    def validate_key(raw_key):
        api_key = ApiKeyModel.get_by_key(raw_key)
        if not api_key or not api_key.is_active:
            return None
        if api_key.expires_at and datetime.datetime.now() > api_key.expires_at:
            return None
        return api_key

    def record_usage(self, ip_address=None):
        self.last_used_at = datetime.datetime.now()
        self.last_used_ip = ip_address
        self.usage_count += 1
        db.session.commit()

    def get_permissions_list(self):
        import json
        try:
            return json.loads(self.permissions)
        except:
            return []

    def has_permission(self, permission):
        permissions = self.get_permissions_list()
        if permission in permissions:
            return True
        category = permission.split(':')[0] if ':' in permission else permission
        if f"{category}:*" in permissions:
            return True
        if "*" in permissions:
            return True
        return False

    def regenerate(self):
        try:
            raw_key = ApiKeyModel.generate_key()
            self.key_prefix = ApiKeyModel.get_key_prefix(raw_key)
            self.key_hash = ApiKeyModel.hash_key(raw_key)
            self.usage_count = 0
            self.last_used_at = None
            self.last_used_ip = None
            db.session.commit()
            return raw_key
        except Exception:
            db.session.rollback()
            return None

    @staticmethod
    def delete_by_id(api_key_id):
        api_key = ApiKeyModel.get_by_id(api_key_id)
        if api_key:
            db.session.delete(api_key)
            db.session.commit()
            return {"message": "API key deleted successfully"}
        return {"error": "api_key.not.found"}
