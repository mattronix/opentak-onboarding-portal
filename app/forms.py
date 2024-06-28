from flask_wtf import FlaskForm
from wtforms import StringField, PasswordField, IntegerField, SelectField
from wtforms.validators import DataRequired, Email, Optional
from wtforms import SubmitField
from uuid import uuid4

class LoginForm(FlaskForm):
    username = StringField('Username', validators=[DataRequired()])
    password = PasswordField('Password', validators=[DataRequired()])
    submit = SubmitField('Submit')

class RegisterForm(FlaskForm):
    username = StringField('Username', validators=[DataRequired()])
    callsign = StringField('Callsign', validators=[DataRequired()])
    password = PasswordField('Password', validators=[DataRequired()])
    firstname = StringField('First Name', validators=[DataRequired()])
    lastname = StringField('Last Name', validators=[DataRequired()])
    email = StringField('Email', validators=[DataRequired(), Email()])
    submit = SubmitField('Submit')

class UserEdit(FlaskForm):
    username = StringField('Username', validators=[DataRequired()])
    callsign = StringField('Callsign', validators=[DataRequired()])
    firstname = StringField('First Name', validators=[Optional()])
    lastname = StringField('Last Name', validators=[Optional()])
    email = StringField('Email', validators=[Optional(), Email()])
    submit = SubmitField('Submit')

class OnboardingCodeForm(FlaskForm):
    name = StringField('Name', validators=[DataRequired()])
    description = StringField('Description', validators=[DataRequired()])
    maxUses = IntegerField('Max Uses', validators=[Optional()])
    onboardContact = SelectField('Onboard Contact',  validators=[Optional()])
    onboardingCode = StringField('Onboarding Code', default=str(uuid4()), validators=[DataRequired()])
    submit = SubmitField('Submit')

class DeleteForm(FlaskForm):
    areyousure = StringField('Are you sure you want to delete this record? Type "OK"', validators=[DataRequired()])
    submit = SubmitField('Delete')