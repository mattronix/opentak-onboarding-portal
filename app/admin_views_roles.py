from flask import render_template, Blueprint, request
from flask import redirect, url_for
from app.decorators import login_required, role_required
from app.forms import DeleteForm, RoleAddForm
from app.models import UserRoleModel
from flask_breadcrumbs import register_breadcrumb, default_breadcrumb_root
from werkzeug.utils import secure_filename

admin_routes_roles = Blueprint('admin_routes_roles', __name__, url_prefix='/admin')
default_breadcrumb_root(admin_routes_roles, '.',)


def admin_roles(*args, **kwargs):
    object_id = request.view_args['id']
    object = UserRoleModel.get_by_id(object_id)

    if object:
        return [{'text': object.name, 'url': f'/admin/roles/edit/{object_id}'}]
    return {'text': "Profile", 'url':""}


@register_breadcrumb(admin_routes_roles, '.admin.roles', 'Roles')
@admin_routes_roles.route('roles')
@login_required
@role_required(role='administrator')
def admin_roles_list():  
    roles = UserRoleModel.get_all_roles()
    return render_template('admin_roles_list.html', roles=roles)


@register_breadcrumb(admin_routes_roles, '.admin.roles.add', 'Add Role')
@admin_routes_roles.route('roles/add', methods=['GET', 'POST'])
@login_required
@role_required(role='administrator')
def admin_roles_add():
    form = RoleAddForm()
    
    if form.validate_on_submit():
            role = UserRoleModel.create_role(name=form.name.data, description=form.description.data)            
            try: 
                e = object.get("error")
                return render_template('form.html', form=form, error=e, title="Add Role", formurl=url_for("admin_routes_roles.admin_roles_add"))
            except:
                pass
            
            return redirect(url_for('admin_routes_roles.admin_roles_list'))
    
    return render_template('form.html', form=form, title="Add Role", formurl=url_for("admin_routes_roles.admin_roles_add"))


@register_breadcrumb(admin_routes_roles, '.admin.roles.delete', 'Delete Role', dynamic_list_constructor=admin_roles)
@admin_routes_roles.route('roles/delete/<int:id>', methods=['GET', 'POST'])
@login_required
@role_required(role='administrator')

def admin_roles_delete(id):
    role = UserRoleModel.get_by_id(id)
    form = DeleteForm()
    
    if role is None:
        return redirect(url_for('admin_routes_roles.admin_roles_list'))
    
    if form.validate_on_submit():
        if form.areyousure.data != "OK":
            return render_template('form.html', role=role, form=form, error="You must type 'OK' to delete this record", title="Delete Role", formurl=url_for("admin_routes_roles.admin_roles_delete",id=role.id))
        
        UserRoleModel.delete_by_id(role.id)
        return redirect(url_for('admin_routes_roles.admin_roles_list'))
    return render_template('form.html', role=role, form=form, title="Delete Role", formurl=url_for("admin_routes_roles.admin_roles_delete",id=role.id))


@register_breadcrumb(admin_routes_roles, '.admin.roles.edit', 'Edit Roles', dynamic_list_constructor=admin_roles)
@admin_routes_roles.route('roles/edit/<int:id>', methods=['GET', 'POST'])
@login_required
@role_required(role='administrator')
def admin_roles_edit(id):  
    role = UserRoleModel.get_by_id(id)
    form = RoleAddForm(data=role.__dict__)
    if role is None:
        return redirect(url_for('admin_routes_roles.admin_roles_edit'))
    
    if form.validate_on_submit():
        role.name = form.name.data
        role.description = form.description.data
        
        UserRoleModel.update(role)
        return redirect(url_for('admin_routes_roles.admin_roles_list'))
    
    return render_template('form.html', role=role, form=form, title="Edit Roles", formurl=url_for("admin_routes_roles.admin_roles_edit",id=role.id))
