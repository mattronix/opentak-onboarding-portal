from flask import render_template, Blueprint, request
from app.ots import otsClient
from flask import redirect, url_for
from app.decorators import login_required, role_required
from app.forms import DeleteForm, UserEditForm
from app.models import UserModel, UserRoleModel
from flask_breadcrumbs import register_breadcrumb, default_breadcrumb_root

admin_routes_users = Blueprint('admin_routes_users_users', __name__, url_prefix='/admin')
default_breadcrumb_root(admin_routes_users, '.',)


def admin_users(*args, **kwargs):
    object_id = request.view_args['id']
    object = UserModel.get_user_by_id(object_id)

    if object:
        return [{'text': object.callsign, 'url': f'/admin/users/edit/{object_id}'}]
    return {'text': "Profile", 'url':""}


@register_breadcrumb(admin_routes_users, '.admin.users', 'Users')
@admin_routes_users.route('users')
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


@register_breadcrumb(admin_routes_users, '.admin.users.edit', 'Edit Users', dynamic_list_constructor=admin_users)
@admin_routes_users.route('users/edit/<int:id>', methods=['GET', 'POST'])
@login_required
@role_required(role='administrator')
def users_edit(id):  
    user = UserModel.get_user_by_id(id)

    form = UserEditForm(data=user.__dict__)
    form.roles.choices = [(role.id, role.name) for role in UserRoleModel.get_all_roles()]

    if user is None:
        return redirect(url_for('admin_routes_users_users.users_list'))
    
    if form.validate_on_submit():
        user.username = form.username.data
        user.callsign = form.callsign.data
        user.firstName = form.firstName.data
        user.lastName = form.lastName.data
        user.email = form.email.data
        user.roles = [UserRoleModel.get_by_id(role_id) for role_id in form.roles.data]
        user.expiryDate = form.expiryDate.data
        UserModel.update_user(user)
        return redirect(url_for('admin_routes_users_users.users_list'))
    

    form.roles.data = [role.id for role in user.roles]

    return render_template('form.html', user=user, form=form, title="Edit Users", formurl=url_for("admin_routes_users_users.users_edit",id=user.id))
    
@register_breadcrumb(admin_routes_users, '.admin.users.delete', 'Delete Users', dynamic_list_constructor=admin_users)
@admin_routes_users.route('users/delete/<int:id>', methods=['GET', 'POST'])
@login_required
@role_required(role='administrator')
def users_delete(id):  
    user = UserModel.get_user_by_id(id)
    form = DeleteForm()
    
    if user is None:
        return redirect(url_for('admin_routes_users_users.users_list'))
    
    if form.validate_on_submit():
        if form.areyousure.data != "OK":
            return render_template('form.html', user=user, form=form, error="You must type 'OK' to delete this record", title="Delete Users", formurl=url_for("admin_routes_users_users.users_delete",id=user.id))
        
        UserModel.delete_user_by_id(user.id)
        otsClient.delete_user(user.username)
        return redirect(url_for('admin_routes_users_users.users_list'))
    
    return render_template('form.html', user=user, form=form, title="Delete Users", formurl=url_for("admin_routes_users_users.users_delete",id=user.id))