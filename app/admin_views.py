from flask import render_template, Blueprint, request, make_response, session
from app.ots import otsClient, OTSClient
from flask import redirect, url_for
from app.settings import OTS_URL, OTS_USERNAME, OTS_PASSWORD
from app.decorators import login_required, role_required
from app.forms import OnboardingCodeForm, DeleteForm, UserEdit
from app.models import UserModel, UserRoleModel, OnboardingCodeModel, db
import uuid



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


@admin_routes.route('onboarding_codes/add', methods=['GET', 'POST'])
@login_required
@role_required(role='administrator')
def onboarding_codes_add():
    form = OnboardingCodeForm()
    form.onboardContact.choices = [(user.id, user.username) for user in UserModel.get_all_users()]
    form.onboardingCode.data = str(uuid.uuid4())

    if form.validate_on_submit():
            object = OnboardingCodeModel.create_onboarding_code(onboardingcode=form.onboardingCode.data, name=form.name.data, description=form.description.data, users=[], roles=[], onboardcontact=form.onboardContact.data, maxuses=form.maxUses.data)
            
            try: 
                e = object.get("error")
                return render_template('admin_onboardingcodes_add.html', form=form, error=e)
            except:
                pass
            
            return redirect(url_for('admin_routes.onboarding_codes_list'))
    
    return render_template('admin_onboardingcodes_add.html', form=form)


@admin_routes.route('onboarding_codes/edit/<int:id>', methods=['GET', 'POST'])
@login_required
@role_required(role='administrator')
def onboarding_codes_edit(id):  
    onboardingcode = OnboardingCodeModel.get_onboarding_code_by_id(id)
    form = OnboardingCodeForm(data=onboardingcode.__dict__)
    form.onboardContact.choices = [(user.id, user.username) for user in UserModel.get_all_users()]
    if onboardingcode is None:
        return redirect(url_for('admin_routes.onboarding_codes_list'))

    if form.validate_on_submit():
        onboardingcode.name = form.name.data
        onboardingcode.description = form.description.data
        onboardingcode.maxUses = form.maxUses.data
        onboardingcode.onboardContact = form.onboardContact.data
        onboardingcode.onboardingCode = form.onboardingCode.data
        OnboardingCodeModel.update_onboarding_code(onboardingcode)
        return redirect(url_for('admin_routes.onboarding_codes_list'))

    return render_template('admin_onboardingcodes_edit.html', onboardingcode=onboardingcode, form=form)

@admin_routes.route('onboarding_codes/delete/<int:id>', methods=['GET', 'POST'])
@login_required
@role_required(role='administrator')
def onboarding_codes_delete(id):  
    onboardingcode = OnboardingCodeModel.get_onboarding_code_by_id(id)
    form = DeleteForm()
    
    if onboardingcode is None:
        return redirect(url_for('admin_routes.onboarding_codes_list'))
    
    if form.validate_on_submit():

        if form.areyousure.data != "OK":
            return render_template('admin_onboardingcodes_delete.html', onboardingcode=onboardingcode, form=form, error="You must type 'OK' to delete this record")
        
        OnboardingCodeModel.delete_onboarding_code_by_id(onboardingcode.id)
        return redirect(url_for('admin_routes.onboarding_codes_list'))
    
    return render_template('admin_onboardingcodes_delete.html', onboardingcode=onboardingcode, form=form)


@admin_routes.route('users')
@login_required
@role_required(role='administrator')
def users_list():  
    users = UserModel.get_all_users()
    return render_template('admin_users_list.html', users=users)


@admin_routes.route('users/edit/<int:id>', methods=['GET', 'POST'])
@login_required
@role_required(role='administrator')
def users_edit(id):  
    user = UserModel.get_user_by_id(id)
    form = UserEdit(data=user.__dict__)
    if user is None:
        return redirect(url_for('admin_routes.users_list'))
    
    if form.validate_on_submit():
        user.username = form.username.data
        user.callsign = form.callsign.data
        user.firstname = form.firstname.data
        user.lastname = form.lastname.data
        user.email = form.email.data
        UserModel.update_user(user)
        return redirect(url_for('admin_routes.users_list'))
    
    return render_template('admin_users_edit.html', user=user, form=form)
    
@admin_routes.route('users/delete/<int:id>', methods=['GET', 'POST'])
@login_required
@role_required(role='administrator')
def users_delete(id):  
    user = UserModel.get_user_by_id(id)
    form = DeleteForm()
    
    if user is None:
        return redirect(url_for('admin_routes.users_list'))
    
    if form.validate_on_submit():
        if form.areyousure.data != "OK":
            return render_template('admin_users_delete.html', user=user, form=form, error="You must type 'OK' to delete this record")
        
        UserModel.delete_user_by_id(user.id)
        return redirect(url_for('admin_routes.users_list'))
    
    return render_template('admin_users_delete.html', user=user, form=form)
