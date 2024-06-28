from flask import render_template, Blueprint, request, make_response, session
from app.ots import otsClient, OTSClient
from flask import redirect, url_for
from app.settings import OTS_URL, OTS_USERNAME, OTS_PASSWORD
from app.decorators import login_required, role_required
from app.forms import LoginForm, RegisterForm
from app.models import UserModel, UserRoleModel, OnboardingCodeModel, db



admin_routes = Blueprint('admin_routes', __name__, url_prefix='/admin')

@admin_routes.route('/')
@login_required
@role_required(role='administrator')
def home():  
    user = UserModel.get_user_by_username(session['username'])
    return render_template('admin_index.html', user=user)



@admin_routes.route('onboarding_codes')
@login_required
@role_required(role='administrator')
def onboarding_codes_list():  
    onboardingcodes = OnboardingCodeModel.get_all_onboarding_codes()
    return render_template('admin_onboardingcodes_list.html', onboardingcodes=onboardingcodes)

