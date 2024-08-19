from flask import render_template, Blueprint, request, make_response, session
from app.ots import otsClient, OTSClient
from flask import redirect, url_for
from app.settings import DATAPACKAGE_UPLOAD_FOLDER
from app.decorators import login_required, role_required
from app.forms import OnboardingCodeForm, DeleteForm, UserEditForm, TakProfileForm, TakProfileEditForm, RoleAddForm, MeshtasticForm
from app.models import UserModel, UserRoleModel, OnboardingCodeModel, TakProfileModel, MeshtasticModel
import uuid
from flask_breadcrumbs import register_breadcrumb, default_breadcrumb_root
from werkzeug.utils import secure_filename
import os
import tempfile
import zipfile
import shutil
import ast

admin_routes = Blueprint('admin_routes', __name__, url_prefix='/admin')
default_breadcrumb_root(admin_routes, '.',)

def admin_onboardingcodes(*args, **kwargs):
    object_id = request.view_args['id']
    object = OnboardingCodeModel.get_onboarding_code_by_id(object_id)

    if object:
        return [{'text': object.name, 'url': f'/admin/onboarding_codes/edit/{object_id}'}]
    return {'text': "Profile", 'url':""}


def admin_users(*args, **kwargs):
    object_id = request.view_args['id']
    object = UserModel.get_user_by_id(object_id)

    if object:
        return [{'text': object.callsign, 'url': f'/admin/users/edit/{object_id}'}]
    return {'text': "Profile", 'url':""}

def admin_takprofiles(*args, **kwargs):
    object_id = request.view_args['id']
    object = TakProfileModel.get_tak_profile_by_id(object_id)

    if object:
        return [{'text': object.name, 'url': f'/admin/takprofiles/edit/{object_id}'}]
    return {'text': "Profile", 'url':""}

def admin_roles(*args, **kwargs):
    object_id = request.view_args['id']
    object = UserRoleModel.get_by_id(object_id)

    if object:
        return [{'text': object.name, 'url': f'/admin/roles/edit/{object_id}'}]
    return {'text': "Profile", 'url':""}



def admin_meshtastic(*args, **kwargs):
    object_id = request.view_args['id']
    object = MeshtasticModel.get_by_id(object_id)

    if object:
        return [{'text': object.name, 'url': f'/admin/meshtastic/edit/{object_id}'}]
    return {'text': "Profile", 'url':""}


def takprofile_datapackage_uploader(file, takprofile):

    filename = secure_filename(file.filename)

    try:
        if not os.path.exists(DATAPACKAGE_UPLOAD_FOLDER):
            os.makedirs(DATAPACKAGE_UPLOAD_FOLDER)

        takuploaddir = f"{DATAPACKAGE_UPLOAD_FOLDER}/{takprofile.id}"

        if os.path.exists(takuploaddir):
            shutil.rmtree(takuploaddir)
        if not os.path.exists(takuploaddir):
            os.makedirs(takuploaddir)

    
    except OSError:
        print(f"Error creating {DATAPACKAGE_UPLOAD_FOLDER}")
        return {"error" : "Error creating upload directory"}
    
    try: 
        temp_dir = tempfile.mkdtemp()
        file_path = os.path.join(temp_dir, filename)
        file.save(file_path)
        
        with zipfile.ZipFile(file_path, 'r') as zip_ref:
            zip_ref.extractall(takuploaddir)
        
        os.remove(file_path)
        takprofile.takTemplateFolderLocation = takuploaddir
        return takprofile
    except Exception as e:
        return {"error" : f"Error uploading file: {e}"}



def make_tree(path):
    tree = dict(name=os.path.basename(path), children=[])
    try: lst = os.listdir(path)
    except OSError:
        pass #ignore errors
    else:
        for name in lst:
            fn = os.path.join(path, name)
            print
            if os.path.isdir(fn):
                tree['children'].append(make_tree(fn))
            else:
                tree['children'].append(dict(name=name))
    return tree

@register_breadcrumb(admin_routes, '.admin', 'Admin Portal')
@admin_routes.route('/')
@login_required
@role_required(role='administrator')
def home():  
    user = UserModel.get_user_by_username(session['username'])
    return render_template('admin_index.html', user=user)


@register_breadcrumb(admin_routes, '.admin.onboardingcodes', 'Onboarding Codes')
@admin_routes.route('onboarding_codes')
@login_required
@role_required(role='administrator')
def onboarding_codes_list():  
    onboardingcodes = OnboardingCodeModel.get_all_onboarding_codes()
    return render_template('admin_onboardingcodes_list.html', onboardingcodes=onboardingcodes)


@register_breadcrumb(admin_routes, '.admin.onboardingcodes.add', 'Add Onboarding Code')
@admin_routes.route('onboarding_codes/add', methods=['GET', 'POST'])
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
                return render_template('form.html', form=form, error=e, title="Add Onboarding Code", formurl=url_for("admin_routes.onboarding_codes_add"))
            except:
                pass
            
            return redirect(url_for('admin_routes.onboarding_codes_list'))
    
    return render_template('form.html', form=form, title="Add Onboarding Code", formurl=url_for("admin_routes.onboarding_codes_add"))




@register_breadcrumb(admin_routes, '.admin.onboardingcodes.edit', 'Edit Onboarding Code', dynamic_list_constructor=admin_onboardingcodes)
@admin_routes.route('onboarding_codes/edit/<int:id>', methods=['GET', 'POST'])
@login_required
@role_required(role='administrator')
def onboarding_codes_edit(id):  
    onboardingcode = OnboardingCodeModel.get_onboarding_code_by_id(id)
    form = OnboardingCodeForm(data=onboardingcode.__dict__)
    form.onboardContact.choices = [(user.id, user.username) for user in UserModel.get_all_users()]
    form.roles.choices = [(role.id, role.name) for role in UserRoleModel.get_all_roles()]
    
    if onboardingcode is None:
        return redirect(url_for('admin_routes.onboarding_codes_list'))

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
        return redirect(url_for('admin_routes.onboarding_codes_list'))
    form.roles.data = [role.id for role in onboardingcode.roles]
    return render_template('form.html', onboardingcode=onboardingcode, form=form, title="Edit Onboarding Code", formurl=url_for("admin_routes.onboarding_codes_edit",id=onboardingcode.id))

@register_breadcrumb(admin_routes, '.admin.onboardingcodes.delete', 'Edit Onboarding Code', dynamic_list_constructor=admin_onboardingcodes)
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
            return render_template('form.html', onboardingcode=onboardingcode, form=form, error="You must type 'OK' to delete this record", title="Delete Onboarding Code", formurl=url_for("admin_routes.onboarding_codes_delete",id=onboardingcode.id))
        
        OnboardingCodeModel.delete_onboarding_code_by_id(onboardingcode.id)
        return redirect(url_for('admin_routes.onboarding_codes_list'))
    
    return render_template('form.html', onboardingcode=onboardingcode, form=form, title="Delete Onboarding Code", formurl=url_for("admin_routes.onboarding_codes_delete",id=onboardingcode.id))



@register_breadcrumb(admin_routes, '.admin.users', 'Users')
@admin_routes.route('users')
@login_required
@role_required(role='administrator')
def users_list():  
    users = UserModel.get_all_users()
    return render_template('admin_users_list.html', users=users)

def admin_users(*args, **kwargs):
    object_id = request.view_args['id']
    object = UserModel.get_user_by_id(object_id)

    if object:
        return [{'text': object.callsign, 'url': f'/admin/users/edit/{object_id}'}]
    return {'text': "Profile", 'url':""}


@register_breadcrumb(admin_routes, '.admin.users.edit', 'Edit Users', dynamic_list_constructor=admin_users)
@admin_routes.route('users/edit/<int:id>', methods=['GET', 'POST'])
@login_required
@role_required(role='administrator')
def users_edit(id):  
    user = UserModel.get_user_by_id(id)

    form = UserEditForm(data=user.__dict__)
    form.roles.choices = [(role.id, role.name) for role in UserRoleModel.get_all_roles()]

    if user is None:
        return redirect(url_for('admin_routes.users_list'))
    
    if form.validate_on_submit():
        user.username = form.username.data
        user.callsign = form.callsign.data
        user.firstName = form.firstName.data
        user.lastName = form.lastName.data
        user.email = form.email.data
        user.roles = [UserRoleModel.get_by_id(role_id) for role_id in form.roles.data]
        user.expiryDate = form.expiryDate.data
        UserModel.update_user(user)
        return redirect(url_for('admin_routes.users_list'))
    

    form.roles.data = [role.id for role in user.roles]

    return render_template('form.html', user=user, form=form, title="Edit Users", formurl=url_for("admin_routes.users_edit",id=user.id))
    
@register_breadcrumb(admin_routes, '.admin.users.delete', 'Delete Users', dynamic_list_constructor=admin_users)
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
            return render_template('form.html', user=user, form=form, error="You must type 'OK' to delete this record", title="Delete Users", formurl=url_for("admin_routes.users_delete",id=user.id))
        
        UserModel.delete_user_by_id(user.id)
        otsClient.delete_user(user.username)
        return redirect(url_for('admin_routes.users_list'))
    
    return render_template('form.html', user=user, form=form, title="Delete Users", formurl=url_for("admin_routes.users_delete",id=user.id))


@register_breadcrumb(admin_routes, '.admin.takprofiles', 'Datapackages')
@admin_routes.route('takprofiles')
@login_required
@role_required(role='administrator')
def takprofiles_list():
    takprofiles = TakProfileModel.get_all_tak_profiles()
    return render_template('admin_takprofiles_list.html', takprofiles=takprofiles)


@register_breadcrumb(admin_routes, '.admin.takprofiles.add', 'Add Datapackage')
@admin_routes.route('takprofiles/add', methods=['GET', 'POST'])
@login_required
@role_required(role='administrator')
def takprofiles_add():
    form = TakProfileForm()
    unique_id = str(uuid.uuid4())

    form.roles.choices = [(role.id, role.name) for role in UserRoleModel.get_all_roles()]

    if form.validate_on_submit():
            takprofile = TakProfileModel.create_tak_profile(name=form.name.data, description=form.description.data,
                                                             roles=[UserRoleModel.get_by_id(role_id) for role_id in form.roles.data], is_public = ast.literal_eval(form.isPublic.data), template_folder_location=f"{DATAPACKAGE_UPLOAD_FOLDER}/{unique_id}")

            if form.datapackage.data:
                takprofile = takprofile_datapackage_uploader(form.datapackage.data, takprofile)

                TakProfileModel.update_tak_profile(takprofile)

            return redirect(url_for('admin_routes.takprofiles_list'))
    
    return render_template('form.html', form=form, title="Add Datapackage", formurl=url_for("admin_routes.takprofiles_add"))


@register_breadcrumb(admin_routes, '.admin.takprofiles.edit', 'Edit Datapackage', dynamic_list_constructor=admin_takprofiles)
@admin_routes.route('takprofiles/edit/<int:id>', methods=['GET', 'POST'])
@login_required
@role_required(role='administrator')
def takprofiles_edit(id):  
    takprofile = TakProfileModel.get_tak_profile_by_id(id)
    form = TakProfileEditForm(data=takprofile.__dict__)
    form.roles.choices = [(role.id, role.name) for role in UserRoleModel.get_all_roles()]
    if takprofile is None:
        return redirect(url_for('admin_routes.takprofiles_list'))

    if form.validate_on_submit():
        takprofile.name = form.name.data
        takprofile.description = form.description.data
        takprofile.takPrefFileLocation = form.takPrefFileLocation.data
        takprofile.roles = [UserRoleModel.get_by_id(role_id) for role_id in form.roles.data]
        takprofile.isPublic = ast.literal_eval(form.isPublic.data)

        print(form.datapackage.data)
        if form.datapackage.data:
            takprofile = takprofile_datapackage_uploader(form.datapackage.data, takprofile)
        
        TakProfileModel.update_tak_profile(takprofile)
        return redirect(url_for('admin_routes.takprofiles_edit', id=takprofile.id))

    form.roles.data = [role.id for role in takprofile.roles]
    return render_template('admin_takprofiles_edit.html', takprofile=takprofile, form=form, filetree=make_tree(takprofile.takTemplateFolderLocation), title="Edit Datapackage", formurl=url_for("admin_routes.takprofiles_edit",id=takprofile.id))

@register_breadcrumb(admin_routes, '.admin.takprofiles.delete', 'Delete Datapackage', dynamic_list_constructor=admin_takprofiles)
@admin_routes.route('takprofiles/delete/<int:id>', methods=['GET', 'POST'])
@login_required
@role_required(role='administrator')

def takprofiles_delete(id):
    takprofile = TakProfileModel.get_tak_profile_by_id(id)
    form = DeleteForm()
    
    if takprofile is None:
        return redirect(url_for('admin_routes.takprofiles_list'))
    
    if form.validate_on_submit():
        if form.areyousure.data != "OK":
            return render_template('form.html', takprofile=takprofile, form=form, error="You must type 'OK' to delete this record", title="Delete Datapackage", formurl=url_for("admin_routes.takprofiles_delete",id=takprofile.id))
        
        TakProfileModel.delete_tak_profile_by_id(takprofile.id)
        shutil.rmtree(takprofile.takTemplateFolderLocation)
        return redirect(url_for('admin_routes.takprofiles_list'))
    return render_template('form.html', takprofile=takprofile, form=form, title="Delete Datapackage", formurl=url_for("admin_routes.takprofiles_delete",id=takprofile.id))



@register_breadcrumb(admin_routes, '.admin.roles', 'Roles')
@admin_routes.route('roles')
@login_required
@role_required(role='administrator')
def admin_roles_list():  
    roles = UserRoleModel.get_all_roles()
    return render_template('admin_roles_list.html', roles=roles)


@register_breadcrumb(admin_routes, '.admin.roles.add', 'Add Role')
@admin_routes.route('roles/add', methods=['GET', 'POST'])
@login_required
@role_required(role='administrator')
def admin_roles_add():
    form = RoleAddForm()
    
    if form.validate_on_submit():
            role = UserRoleModel.create_role(name=form.name.data, description=form.description.data)            
            try: 
                e = object.get("error")
                return render_template('form.html', form=form, error=e, title="Add Role", formurl=url_for("admin_routes.admin_roles_add"))
            except:
                pass
            
            return redirect(url_for('admin_routes.admin_roles_list'))
    
    return render_template('form.html', form=form, title="Add Role", formurl=url_for("admin_routes.admin_roles_add"))


@register_breadcrumb(admin_routes, '.admin.roles.delete', 'Delete Role', dynamic_list_constructor=admin_roles)
@admin_routes.route('roles/delete/<int:id>', methods=['GET', 'POST'])
@login_required
@role_required(role='administrator')

def admin_roles_delete(id):
    role = UserRoleModel.get_by_id(id)
    form = DeleteForm()
    
    if role is None:
        return redirect(url_for('admin_routes.admin_roles_list'))
    
    if form.validate_on_submit():
        if form.areyousure.data != "OK":
            return render_template('form.html', role=role, form=form, error="You must type 'OK' to delete this record", title="Delete Role", formurl=url_for("admin_routes.admin_roles_delete",id=role.id))
        
        UserRoleModel.delete_role_by_id(role.id)
        return redirect(url_for('admin_routes.admin_roles_list'))
    return render_template('form.html', role=role, form=form, title="Delete Role", formurl=url_for("admin_routes.admin_roles_delete",id=role.id))


@register_breadcrumb(admin_routes, '.admin.roles.edit', 'Edit Roles', dynamic_list_constructor=admin_roles)
@admin_routes.route('roles/edit/<int:id>', methods=['GET', 'POST'])
@login_required
@role_required(role='administrator')
def admin_roles_edit(id):  
    role = UserRoleModel.get_by_id(id)
    form = RoleAddForm(data=role.__dict__)
    if role is None:
        return redirect(url_for('admin_routes.admin_roles_edit'))
    
    if form.validate_on_submit():
        role.name = form.name.data
        role.description = form.description.data
        
        UserRoleModel.update_role(role)
        return redirect(url_for('admin_routes.admin_roles_list'))
    
    return render_template('form.html', role=role, form=form, title="Edit Roles", formurl=url_for("admin_roles.admin_roles_edit",id=role.id))


@register_breadcrumb(admin_routes, '.admin.meshtastic', 'Mestastic')
@admin_routes.route('meshtastic')
@login_required
@role_required(role='administrator')
def admin_meshtastic_list():  
    meshtasticconfigs = MeshtasticModel.get_all_meshtastic()
    return render_template('admin_meshtastic_list.html', meshtasticconfigs=meshtasticconfigs)

@register_breadcrumb(admin_routes, '.admin.meshtastic.add', 'Add Meshtastic')
@admin_routes.route('meshtastic/add', methods=['GET', 'POST'])
@login_required
@role_required(role='administrator')
def admin_meshtastic_add():
    form = MeshtasticForm()
    form.roles.choices = [(role.id, role.name) for role in UserRoleModel.get_all_roles()]

    if form.validate_on_submit():
        meshtastic = MeshtasticModel.create_meshtastic(name=form.name.data, description=form.description.data, url=form.url.data, roles=[UserRoleModel.get_by_id(role_id) for role_id in form.roles.data])
        try:
            e = object.get("error")
            return render_template('form.html', form=form, error=e, title="Add Meshtastic", formurl=url_for("admin_routes.admin_meshtastic_add"))
        except:
            pass

        return redirect(url_for('admin_routes.admin_meshtastic_list'))

    
    return render_template('form.html', form=form, title="Add Meshtastic", formurl=url_for("admin_routes.admin_meshtastic_add"))


@register_breadcrumb(admin_routes, '.admin.meshtastic.edit', 'Edit Meshtastic', dynamic_list_constructor=admin_meshtastic)
@admin_routes.route('meshtastic/edit/<int:id>', methods=['GET', 'POST'])
@login_required
@role_required(role='administrator')
def meshtastic_edit(id):  
    object = MeshtasticModel.get_by_id(id)
    form = MeshtasticForm(data=object.__dict__)
    form.roles.choices = [(role.id, role.name) for role in UserRoleModel.get_all_roles()]

    if object is None:
        return redirect(url_for('admin_routes.meshtastic_edit'))

    if form.validate_on_submit():
        object.name = form.name.data
        object.description = form.description.data
        object.url = form.url.data
        object.roles = [UserRoleModel.get_by_id(role_id) for role_id in form.roles.data]
        object.isPublic = ast.literal_eval(form.isPublic.data)

        MeshtasticModel.update_meshtastic(object)
        return redirect(url_for('admin_routes.meshtastic_edit', id=object.id))

    form.roles.data = [role.id for role in object.roles]
    return render_template('form.html', form=form, title="Edit Meshtastic Config", formurl=url_for("admin_routes.meshtastic_edit",id=object.id))

@register_breadcrumb(admin_routes, '.admin.meshtastic.delete', 'Delete Meshtastic Config', dynamic_list_constructor=admin_meshtastic)
@admin_routes.route('meshtastic/delete/<int:id>', methods=['GET', 'POST'])
@login_required
@role_required(role='administrator')

def admin_meshtastic_delete(id):
    object = MeshtasticModel.get_by_id(id)
    form = DeleteForm()
    
    if object is None:
        return redirect(url_for('admin_routes.admin_meshtastic_list'))
    
    if form.validate_on_submit():
        if form.areyousure.data != "OK":
            return render_template('form.html', role=object, form=form, error="You must type 'OK' to delete this record", title="Delete Meshtastic Config", formurl=url_for("admin_routes.admin_meshtastic_delete",id=object.id))
        
        MeshtasticModel.delete_meshtastic_by_id(object.id)
        return redirect(url_for('admin_routes.admin_meshtastic_list'))
    return render_template('form.html', form=form, title="Delete Meshtastic Config", formurl=url_for("admin_routes.admin_meshtastic_delete",id=object.id))
