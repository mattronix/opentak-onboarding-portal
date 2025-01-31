from flask import render_template, Blueprint, request, session
from flask import redirect, url_for
from app.decorators import login_required, role_required
from app.forms import DeleteForm, MeshtasticForm
from app.models import UserModel, UserRoleModel, MeshtasticModel
from flask_breadcrumbs import register_breadcrumb, default_breadcrumb_root
import ast

admin_routes_meshtastic = Blueprint('admin_routes_meshtastic', __name__, url_prefix='/admin')
default_breadcrumb_root(admin_routes_meshtastic, '.',)



def admin_meshtastic(*args, **kwargs):
    object_id = request.view_args['id']
    object = MeshtasticModel.get_by_id(object_id)

    if object:
        return [{'text': object.name, 'url': f'/admin/meshtastic/edit/{object_id}'}]
    return {'text': "Profile", 'url':""}



@register_breadcrumb(admin_routes_meshtastic, '.admin', 'Admin Portal')
@admin_routes_meshtastic.route('/')
@login_required
@role_required(role='administrator')
def home():  
    user = UserModel.get_user_by_username(session['username'])
    return render_template('admin_index.html', user=user)



@register_breadcrumb(admin_routes_meshtastic, '.admin.meshtastic', 'Mestastic')
@admin_routes_meshtastic.route('meshtastic')
@login_required
@role_required(role='administrator')
def admin_meshtastic_list():  
    meshtasticconfigs = MeshtasticModel.get_all_meshtastic()
    return render_template('admin_meshtastic_list.html', meshtasticconfigs=meshtasticconfigs)

@register_breadcrumb(admin_routes_meshtastic, '.admin.meshtastic.add', 'Add Meshtastic')
@admin_routes_meshtastic.route('meshtastic/add', methods=['GET', 'POST'])
@login_required
@role_required(role='administrator')
def admin_meshtastic_add():
    form = MeshtasticForm()
    form.roles.choices = [(role.id, role.name) for role in UserRoleModel.get_all_roles()]

    if form.validate_on_submit():
        meshtastic = MeshtasticModel.create_meshtastic(name=form.name.data, description=form.description.data, url=form.url.data, roles=[UserRoleModel.get_by_id(role_id) for role_id in form.roles.data])
        try:
            e = object.get("error")
            return render_template('form.html', form=form, error=e, title="Add Meshtastic", formurl=url_for("admin_routes_meshtastic.admin_meshtastic_add"))
        except:
            pass

        return redirect(url_for('admin_routes_meshtastic.admin_meshtastic_list'))

    
    return render_template('form.html', form=form, title="Add Meshtastic", formurl=url_for("admin_routes_meshtastic.admin_meshtastic_add"))


@register_breadcrumb(admin_routes_meshtastic, '.admin.meshtastic.edit', 'Edit Meshtastic', dynamic_list_constructor=admin_meshtastic)
@admin_routes_meshtastic.route('meshtastic/edit/<int:id>', methods=['GET', 'POST'])
@login_required
@role_required(role='administrator')
def admin_meshtastic_edit(id):  
    object = MeshtasticModel.get_by_id(id)
    form = MeshtasticForm(data=object.__dict__)
    form.roles.choices = [(role.id, role.name) for role in UserRoleModel.get_all_roles()]

    if object is None:
        return redirect(url_for('admin_routes_meshtastic.meshtastic_edit'))

    if form.validate_on_submit():
        object.name = form.name.data
        object.description = form.description.data
        object.url = form.url.data
        object.roles = [UserRoleModel.get_by_id(role_id) for role_id in form.roles.data]
        object.isPublic = ast.literal_eval(form.isPublic.data)

        MeshtasticModel.update_meshtastic(object)
        return redirect(url_for('admin_routes_meshtastic.admin_meshtastic_edit', id=object.id))

    form.roles.data = [role.id for role in object.roles]
    return render_template('form.html', form=form, title="Edit Meshtastic Config", formurl=url_for("admin_routes_meshtastic.admin_meshtastic_edit",id=object.id))

@register_breadcrumb(admin_routes_meshtastic, '.admin.meshtastic.delete', 'Delete Meshtastic Config', dynamic_list_constructor=admin_meshtastic)
@admin_routes_meshtastic.route('meshtastic/delete/<int:id>', methods=['GET', 'POST'])
@login_required
@role_required(role='administrator')

def admin_meshtastic_delete(id):
    object = MeshtasticModel.get_by_id(id)
    form = DeleteForm()
    
    if object is None:
        return redirect(url_for('admin_routes_meshtastic.admin_meshtastic_list'))
    
    if form.validate_on_submit():
        if form.areyousure.data != "OK":
            return render_template('form.html', role=object, form=form, error="You must type 'OK' to delete this record", title="Delete Meshtastic Config", formurl=url_for("admin_routes_meshtastic.admin_meshtastic_delete",id=object.id))
        
        MeshtasticModel.delete_meshtastic_by_id(object.id)
        return redirect(url_for('admin_routes_meshtastic.admin_meshtastic_list'))
    return render_template('form.html', form=form, title="Delete Meshtastic Config", formurl=url_for("admin_routes_meshtastic.admin_meshtastic_delete",id=object.id))


