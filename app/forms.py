from flask_wtf import FlaskForm
from wtforms import StringField, PasswordField, IntegerField, SelectField, FileField
from wtforms.validators import DataRequired, Email, Optional, ValidationError, Length, EqualTo
from wtforms import SubmitField
from app.settings import DATAPACKAGE_UPLOAD_FOLDER
import re
import os

def check_username(form, field):
    if field.data and (re.search(r'[^a-zA-Z0-9\s]', field.data) or ' ' in field.data):
        raise ValidationError('Username cannot contain special characters, spaces, hyphens or underscore.')

def check_filename(form, field):
    if field.data and not field.data.filename.endswith('.zip'):
        raise ValidationError('Filename must end with .zip')


def check_file_exists(form, field):
    if field.data and not os.path.exists(DATAPACKAGE_UPLOAD_FOLDER + '/' + field.data):
        raise ValidationError('File does not exist.')

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
    submit = SubmitField('Submit')

class DeleteForm(FlaskForm):
    areyousure = StringField('Are you sure you want to delete this record? Type "OK"', validators=[DataRequired()])
    submit = SubmitField('Delete')

class TakProfileForm(FlaskForm):
    datapackage = FileField('Datapackage', validators=[DataRequired(), check_filename])
    name = StringField('Name', validators=[DataRequired()])
    description = StringField('Description', validators=[DataRequired()])
    submit = SubmitField('Submit')

class TakProfileEditForm(FlaskForm):
    datapackage = FileField('Datapackage', validators=[check_filename, Optional()])
    name = StringField('Name', validators=[DataRequired()])
    description = StringField('Description', validators=[DataRequired()])
    takPrefFileLocation = StringField('Preference File Location', validators=[Optional(), check_file_exists])
    submit = SubmitField('Submit')