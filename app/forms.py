from flask_wtf import FlaskForm
from wtforms import StringField, PasswordField, IntegerField, SelectField, FileField, SelectMultipleField, DateTimeField, DateField, TextAreaField
from wtforms.validators import DataRequired, Email, Optional, ValidationError, Length, EqualTo, URL
from wtforms import SubmitField
from app.settings import DATAPACKAGE_UPLOAD_FOLDER, UPDATES_UPLOAD_FOLDER
import re
import os
import yaml


def check_username(form, field):
    if field.data and (re.search(r'[^a-zA-Z0-9\s]', field.data) or ' ' in field.data):
        raise ValidationError('Username cannot contain special characters, spaces, hyphens or underscore.')

def check_filename(form, field):
    if field.data and not field.data.filename.endswith('.zip'):
        raise ValidationError('Filename must end with .zip')

def check_package_filename(form, field):
    if field.data and not field.data.filename.endswith('.apk'):
        raise ValidationError('Filename must end with .apk')
    
def check_image_filename(form, field):
    if field.data and not field.data.filename.endswith('.png'):
        raise ValidationError('Filename must end with .png')
        
def check_file_exists(form, field):
    if field.data and not os.path.exists(DATAPACKAGE_UPLOAD_FOLDER + '/' + field.data):
        raise ValidationError('File does not exist.')

def check_package_exists(form, field):
    if field.data and os.path.exists(UPDATES_UPLOAD_FOLDER + '/' + field.data.filename):
        raise ValidationError('File conflicts with an existing package.')

def validate_yamlConfig(form, field):
    try:
        if field.data:
            yaml.safe_load(field.data)
    except yaml.YAMLError as e:
        raise ValidationError(f'Invalid YAML: {e}')
    
class LoginForm(FlaskForm):
    username = StringField('Username', validators=[DataRequired()])
    password = PasswordField('Password', validators=[DataRequired()])
    submit = SubmitField('Submit')

class RegisterForm(FlaskForm):
    username = StringField('Username', validators=[DataRequired(), check_username,])
    callsign = StringField('Callsign', validators=[DataRequired()])
    password = PasswordField('Password', validators=[DataRequired(), Length(min=6), EqualTo('password_confirm', message='Passwords must match')])
    password_confirm = PasswordField(label='Confirm Password', validators=[DataRequired(), Length(min=6)])
    firstname = StringField('First Name', validators=[DataRequired()])
    lastname = StringField('Last Name', validators=[DataRequired()])
    email = StringField('Email', validators=[DataRequired(), Email()])
    submit = SubmitField('Submit')

class ResetPasswordRequestForm(FlaskForm):
    email = StringField('Email', validators=[DataRequired(), Email()])
    submit = SubmitField('Submit')

class ResetPasswordForm(FlaskForm):
    password = PasswordField('Password', validators=[DataRequired(), Length(min=6), EqualTo('password_confirm', message='Passwords must match')])
    password_confirm = PasswordField(label='Confirm Password', validators=[DataRequired(), Length(min=6)])
    submit = SubmitField('Submit')

class UserEditForm(FlaskForm):
    username = StringField('Username', validators=[DataRequired(), check_username])
    callsign = StringField('Callsign', validators=[DataRequired()])
    firstName = StringField('First Name', validators=[Optional()])
    lastName = StringField('Last Name', validators=[Optional()])
    email = StringField('Email', validators=[Optional(), Email()])
    roles = SelectMultipleField('Roles', validators=[Optional()], coerce=int)
    expiryDate = DateField('User Expiry Date', validators=[Optional()])
    submit = SubmitField('Submit')

class UserProfileEditForm(FlaskForm):
    callsign = StringField('Callsign', validators=[DataRequired()])
    firstName = StringField('First Name', validators=[Optional()])
    lastName = StringField('Last Name', validators=[Optional()])
    email = StringField('Email', validators=[Email()])
    submit = SubmitField('Submit')

class OnboardingCodeForm(FlaskForm):
    name = StringField('Name', validators=[DataRequired()])
    description = StringField('Description', validators=[DataRequired()])
    maxUses = IntegerField('Max Uses', validators=[Optional()])
    onboardContact = SelectField('Onboard Contact',  validators=[Optional()])
    onboardingCode = StringField('Onboarding Code', validators=[DataRequired()])
    roles = SelectMultipleField('Roles', validators=[Optional()], coerce=int)
    userExpiryDate = DateField('User Expiry Date', validators=[Optional()])
    expiryDate = DateField('Onboarding Expiry Date', validators=[Optional()])
    submit = SubmitField('Submit')

class DeleteForm(FlaskForm):
    areyousure = StringField('Are you sure you want to delete this record? Type "OK"', validators=[DataRequired()])
    submit = SubmitField('Delete')

class TakProfileForm(FlaskForm):
    datapackage = FileField('Datapackage', validators=[DataRequired(), check_filename])
    name = StringField('Name', validators=[DataRequired()])
    description = StringField('Description', validators=[DataRequired()])
    isPublic = SelectField('Public', choices=[('True', 'Yes'), ('False', 'No')], validators=[DataRequired()], default='False')
    roles = SelectMultipleField('Roles', validators=[Optional()], coerce=int)
    submit = SubmitField('Submit')

class TakProfileEditForm(FlaskForm):
    datapackage = FileField('Datapackage', validators=[check_filename, Optional()])
    name = StringField('Name', validators=[DataRequired()])
    description = StringField('Description', validators=[DataRequired()])
    takPrefFileLocation = StringField('Preference File Location', validators=[Optional(), check_file_exists])
    isPublic = SelectField('Public', choices=[('True', 'Yes'), ('False', 'No')], validators=[DataRequired()])
    roles = SelectMultipleField('Roles', validators=[Optional()], coerce=int)
    submit = SubmitField('Submit')

class RoleAddForm(FlaskForm):
    name = StringField('Name', validators=[DataRequired()])
    description = StringField('Description', validators=[Optional()])
    submit = SubmitField('Submit')


class MeshtasticForm(FlaskForm):
    name = StringField('Name', validators=[DataRequired()])
    roles = SelectMultipleField('Roles', validators=[Optional()], coerce=int)
    description = StringField('Description', validators=[Optional()])
    url = StringField('URL', validators=[DataRequired(), URL()])
    isPublic = SelectField('Public', choices=[('True', 'Yes'), ('False', 'No')], validators=[DataRequired()])
    yamlConfig = TextAreaField('YAML', validators=[Optional(), validate_yamlConfig], render_kw={"style": "height: 300px;"})
    defaultRadioConfig = SelectField('Default', choices=[('True', 'Yes'), ('False', 'No')], validators=[Optional()], default='False')
    showOnHomepage = SelectField('Show on Homepage', choices=[('True', 'Yes'), ('False', 'No')], validators=[Optional()], default='False')
    submit = SubmitField('Submit')

class AddPackageForm(FlaskForm):
    name = StringField('Name', validators=[DataRequired()])
    description = StringField('Description', validators=[Optional()])
    package = FileField('Package', validators=[DataRequired(), check_package_filename])
    image = FileField('Image/Icon', validators=[DataRequired(), check_image_filename])
    version = StringField('Version', validators=[DataRequired()])
    platform = SelectField('Platform', choices=[('Android', 'Android'), ('Windows', 'Windows'), ('iOS', 'iOS')], validators=[DataRequired()], default='Android')
    typePackage = SelectField('Type', choices=[('app', 'App'), ('plugin', 'Plugin')], validators=[DataRequired()])
    revisionCode = IntegerField('Revision Code', validators=[Optional()], default=1)
    apkHash = IntegerField('APK Hash', validators=[Optional()])
    osRequirement = StringField('OS Requirement', validators=[Optional()])
    takPreReq = StringField('TAK Prerequisite', validators=[Optional()],default="com.atakmap.app@4.10.0.CIV")
    apkSize = IntegerField('APK Size', validators=[Optional()], default=-1)
    fullPackageName = StringField('Full Package Name', validators=[Optional()])
    submit = SubmitField('Submit')


class EditPackageForm(FlaskForm):
    name = StringField('Name', validators=[DataRequired()])
    description = StringField('Description', validators=[Optional()])
    package = FileField('Package', validators=[check_package_filename])
    image = FileField('Image/Icon', validators=[check_image_filename])
    version = StringField('Version', validators=[DataRequired()])
    platform = SelectField('Platform', choices=[('Android', 'Android'), ('Windows', 'Windows'), ('iOS', 'iOS')], validators=[DataRequired()], default='Android')
    typePackage = SelectField('Type', choices=[('app', 'App'), ('plugin', 'Plugin')], validators=[DataRequired()])
    revisionCode = IntegerField('Revision Code', validators=[Optional()], default=1)
    apkHash = IntegerField('APK Hash', validators=[Optional()])
    osRequirement = StringField('OS Requirement', validators=[Optional()])
    takPreReq = StringField('TAK Prerequisite', validators=[Optional()],default="com.atakmap.app@4.10.0.CIV")
    apkSize = IntegerField('APK Size', validators=[Optional()], default=-1)
    fullPackageName = StringField('Full Package Name', validators=[Optional()])
    submit = SubmitField('Submit')



class AddRadioForm(FlaskForm):
    name = StringField('Name', validators=[DataRequired()])
    description = StringField('Description', validators=[Optional()])
    platform = StringField('Platform', validators=[Optional()])
    radioType = SelectField('Radio Type', choices=[('meshtastic', 'Meshtastic'), ('other', 'Other')], validators=[DataRequired()])
    softwareVersion = StringField('Software Version', validators=[Optional()])
    model = StringField('Model', validators=[Optional()])
    vendor = StringField('Vendor', validators=[Optional()])
    shortName = StringField('Short Name', validators=[Optional()])
    longName = StringField('Long Name', validators=[Optional()])
    assignedTo = SelectField('Assigned To', validators=[Optional()])
    owner = SelectField('Owner', validators=[Optional()])
    mac = StringField('MAC Address', validators=[Optional()])
    submit = SubmitField('Submit')

class EditRadioForm(FlaskForm):
    name = StringField('Name', validators=[DataRequired()])
    description = StringField('Description', validators=[Optional()])
    platform = StringField('Platform', validators=[Optional()])
    radioType = SelectField('Radio Type', choices=[('meshtastic', 'Meshtastic'), ('other', 'Other')], validators=[DataRequired()])
    softwareVersion = StringField('Software Version', validators=[Optional()])
    model = StringField('Model', validators=[Optional()])
    vendor = StringField('Vendor', validators=[Optional()])
    shortName = StringField('Short Name', validators=[Optional()])
    longName = StringField('Long Name', validators=[Optional()])
    assignedTo = SelectField('Assigned To', validators=[Optional()], default=None)
    owner = SelectField('Owner', validators=[Optional()], default=None)
    mac = StringField('MAC Address', validators=[Optional()])
    submit = SubmitField('Submit')

