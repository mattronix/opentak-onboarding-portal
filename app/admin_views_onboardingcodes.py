from flask import render_template, Blueprint, request
from flask import redirect, url_for
from app.decorators import login_required, role_required
from app.forms import OnboardingCodeForm, DeleteForm
from app.models import UserModel, UserRoleModel, OnboardingCodeModel
import uuid
from flask_breadcrumbs import register_breadcrumb, default_breadcrumb_root


admin_routes_onboarding = Blueprint('admin_routes_onboarding_onboarding', __name__, url_prefix='/admin')
default_breadcrumb_root(admin_routes_onboarding, '.',)

def admin_onboardingcodes(*args, **kwargs):
    object_id = request.view_args['id']
    object = OnboardingCodeModel.get_onboarding_code_by_id(object_id)

    if object:
        return [{'text': object.name, 'url': f'/admin/onboarding_codes/edit/{object_id}'}]
    return {'text': "Profile", 'url':""}

@register_breadcrumb(admin_routes_onboarding, '.admin.onboardingcodes', 'Onboarding Codes')
@admin_routes_onboarding.route('onboarding_codes')
@login_required
@role_required(role='administrator')
def onboarding_codes_list():  
    onboardingcodes = OnboardingCodeModel.get_all_onboarding_codes()
    return render_template('admin_onboardingcodes_list.html', onboardingcodes=onboardingcodes)


@register_breadcrumb(admin_routes_onboarding, '.admin.onboardingcodes.add', 'Add Onboarding Code')
@admin_routes_onboarding.route('onboarding_codes/add', methods=['GET', 'POST'])
@login_required
@role_required(role='administrator')
def onboarding_codes_add():
    form = OnboardingCodeForm()
    form.onboardContact.choices = [(user.id, user.username) for user in UserModel.get_all_users()]
    form.onboardingCode.data = str(uuid.uuid4())
    form.roles.choices = [(role.id, role.name) for role in UserRoleModel.get_all_roles()]

    if form.validate_on_submit():
            object = OnboardingCodeModel.create_onboarding_code(onboardingcode=form.onboardingCode.data, name=form.name.data, description=form.description.data, users=[], roles=[UserRoleModel.get_by_id(role_id) for role_id in form.roles.data], onboardcontact=form.onboardContact.data, maxuses=form.maxUses.data, expirydate=form.expiryDate.data, userexpirydate=form.userExpiryDate.data)
            
            try: 
                e = object.get("error")
                return render_template('form.html', form=form, error=e, title="Add Onboarding Code", formurl=url_for("admin_routes_onboarding_onboarding.onboarding_codes_add"))
            except:
                pass
            
            return redirect(url_for('admin_routes_onboarding_onboarding.onboarding_codes_list'))
    
    return render_template('form.html', form=form, title="Add Onboarding Code", formurl=url_for("admin_routes_onboarding_onboarding.onboarding_codes_add"))




@register_breadcrumb(admin_routes_onboarding, '.admin.onboardingcodes.edit', 'Edit Onboarding Code', dynamic_list_constructor=admin_onboardingcodes)
@admin_routes_onboarding.route('onboarding_codes/edit/<int:id>', methods=['GET', 'POST'])
@login_required
@role_required(role='administrator')
def onboarding_codes_edit(id):  
    onboardingcode = OnboardingCodeModel.get_onboarding_code_by_id(id)
    form = OnboardingCodeForm(data=onboardingcode.__dict__)
    form.onboardContact.choices = [(user.id, user.username) for user in UserModel.get_all_users()]
    form.roles.choices = [(role.id, role.name) for role in UserRoleModel.get_all_roles()]
    
    if onboardingcode is None:
        return redirect(url_for('admin_routes_onboarding_onboarding.onboarding_codes_list'))

    if form.validate_on_submit():
        onboardingcode.name = form.name.data
        onboardingcode.description = form.description.data
        onboardingcode.maxUses = form.maxUses.data
        onboardingcode.onboardContact = form.onboardContact.data
        onboardingcode.onboardingCode = form.onboardingCode.data
        onboardingcode.roles = [UserRoleModel.get_by_id(role_id) for role_id in form.roles.data]
        onboardingcode.userExpiryDate = form.userExpiryDate.data
        onboardingcode.expiryDate = form.expiryDate.data
        OnboardingCodeModel.update_onboarding_code(onboardingcode)
        return redirect(url_for('admin_routes_onboarding_onboarding.onboarding_codes_list'))
    form.roles.data = [role.id for role in onboardingcode.roles]
    return render_template('form.html', onboardingcode=onboardingcode, form=form, title="Edit Onboarding Code", formurl=url_for("admin_routes_onboarding_onboarding.onboarding_codes_edit",id=onboardingcode.id))

@register_breadcrumb(admin_routes_onboarding, '.admin.onboardingcodes.delete', 'Edit Onboarding Code', dynamic_list_constructor=admin_onboardingcodes)
@admin_routes_onboarding.route('onboarding_codes/delete/<int:id>', methods=['GET', 'POST'])
@login_required
@role_required(role='administrator')
def onboarding_codes_delete(id):  
    onboardingcode = OnboardingCodeModel.get_onboarding_code_by_id(id)
    form = DeleteForm()
    
    if onboardingcode is None:
        return redirect(url_for('admin_routes_onboarding_onboarding.onboarding_codes_list'))
    
    if form.validate_on_submit():

        if form.areyousure.data != "OK":
            return render_template('form.html', onboardingcode=onboardingcode, form=form, error="You must type 'OK' to delete this record", title="Delete Onboarding Code", formurl=url_for("admin_routes_onboarding_onboarding.onboarding_codes_delete",id=onboardingcode.id))
        
        OnboardingCodeModel.delete_onboarding_code_by_id(onboardingcode.id)
        return redirect(url_for('admin_routes_onboarding_onboarding.onboarding_codes_list'))
    
    return render_template('form.html', onboardingcode=onboardingcode, form=form, title="Delete Onboarding Code", formurl=url_for("admin_routes_onboarding_onboarding.onboarding_codes_delete",id=onboardingcode.id))

