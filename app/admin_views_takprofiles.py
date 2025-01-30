from flask import render_template, Blueprint, request

from flask import redirect, url_for
from app.settings import DATAPACKAGE_UPLOAD_FOLDER
from app.decorators import login_required, role_required
from app.forms import DeleteForm, TakProfileForm, TakProfileEditForm
from app.models import UserRoleModel, TakProfileModel
import uuid
from flask_breadcrumbs import register_breadcrumb, default_breadcrumb_root
from werkzeug.utils import secure_filename
import os
import tempfile
import zipfile
import shutil
import ast
import os
import zipfile

admin_routes_takprofiles = Blueprint('admin_routes_takprofiles', __name__, url_prefix='/admin')
default_breadcrumb_root(admin_routes_takprofiles, '.',)


def admin_takprofiles(*args, **kwargs):
    object_id = request.view_args['id']
    object = TakProfileModel.get_tak_profile_by_id(object_id)

    if object:
        return [{'text': object.name, 'url': f'/admin/takprofiles/edit/{object_id}'}]
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


@register_breadcrumb(admin_routes_takprofiles, '.admin.takprofiles', 'Datapackages')
@admin_routes_takprofiles.route('takprofiles')
@login_required
@role_required(role='administrator')
def takprofiles_list():
    takprofiles = TakProfileModel.get_all_tak_profiles()
    return render_template('admin_takprofiles_list.html', takprofiles=takprofiles)


@register_breadcrumb(admin_routes_takprofiles, '.admin.takprofiles.add', 'Add Datapackage')
@admin_routes_takprofiles.route('takprofiles/add', methods=['GET', 'POST'])
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

            return redirect(url_for('admin_routes_takprofiles.takprofiles_list'))
    
    return render_template('form.html', form=form, title="Add Datapackage", formurl=url_for("admin_routes_takprofiles.takprofiles_add"))


@register_breadcrumb(admin_routes_takprofiles, '.admin.takprofiles.edit', 'Edit Datapackage', dynamic_list_constructor=admin_takprofiles)
@admin_routes_takprofiles.route('takprofiles/edit/<int:id>', methods=['GET', 'POST'])
@login_required
@role_required(role='administrator')
def takprofiles_edit(id):  
    takprofile = TakProfileModel.get_tak_profile_by_id(id)
    form = TakProfileEditForm(data=takprofile.__dict__)
    form.roles.choices = [(role.id, role.name) for role in UserRoleModel.get_all_roles()]
    if takprofile is None:
        return redirect(url_for('admin_routes_takprofiles.takprofiles_list'))

    if form.validate_on_submit():
        takprofile.name = form.name.data
        takprofile.description = form.description.data
        takprofile.takPrefFileLocation = form.takPrefFileLocation.data
        takprofile.roles = [UserRoleModel.get_by_id(role_id) for role_id in form.roles.data]
        takprofile.isPublic = ast.literal_eval(form.isPublic.data)

        if form.datapackage.data:
            takprofile = takprofile_datapackage_uploader(form.datapackage.data, takprofile)
        
        TakProfileModel.update_tak_profile(takprofile)
        return redirect(url_for('admin_routes_takprofiles.takprofiles_edit', id=takprofile.id))

    form.roles.data = [role.id for role in takprofile.roles]
    return render_template('admin_takprofiles_edit.html', takprofile=takprofile, form=form, filetree=make_tree(takprofile.takTemplateFolderLocation), title="Edit Datapackage", formurl=url_for("admin_routes_takprofiles.takprofiles_edit",id=takprofile.id))

@register_breadcrumb(admin_routes_takprofiles, '.admin.takprofiles.delete', 'Delete Datapackage', dynamic_list_constructor=admin_takprofiles)
@admin_routes_takprofiles.route('takprofiles/delete/<int:id>', methods=['GET', 'POST'])
@login_required
@role_required(role='administrator')

def takprofiles_delete(id):
    takprofile = TakProfileModel.get_tak_profile_by_id(id)
    form = DeleteForm()
    
    if takprofile is None:
        return redirect(url_for('admin_routes_takprofiles.takprofiles_list'))
    
    if form.validate_on_submit():
        if form.areyousure.data != "OK":
            return render_template('form.html', takprofile=takprofile, form=form, error="You must type 'OK' to delete this record", title="Delete Datapackage", formurl=url_for("admin_routes_takprofiles.takprofiles_delete",id=takprofile.id))
        
        TakProfileModel.delete_tak_profile_by_id(takprofile.id)
        shutil.rmtree(takprofile.takTemplateFolderLocation)
        return redirect(url_for('admin_routes_takprofiles.takprofiles_list'))
    return render_template('form.html', takprofile=takprofile, form=form, title="Delete Datapackage", formurl=url_for("admin_routes_takprofiles.takprofiles_delete",id=takprofile.id))

