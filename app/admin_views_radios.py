from flask import render_template, Blueprint, request
from flask import redirect, url_for
from app.decorators import login_required, role_required
from app.forms import DeleteForm, AddRadioForm, EditRadioForm
from app.models import RadioModel, UserModel
from flask_breadcrumbs import register_breadcrumb, default_breadcrumb_root

admin_routes_radios = Blueprint('admin_routes_radios', __name__, url_prefix='/admin')
default_breadcrumb_root(admin_routes_radios, '.',)


def admin_radios(*args, **kwargs):
    object_id = request.view_args['id']
    object = RadioModel.get_by_id(object_id)

    if object:
        return [{'text': object.name, 'url': f'/admin/radios/edit/{object_id}'}]
    return {'text': "Profile", 'url':""}


@register_breadcrumb(admin_routes_radios, '.admin.radios', 'radios')
@admin_routes_radios.route('radios')
@login_required
@role_required(role='administrator')
def admin_radios_list():  
    radios = RadioModel.get_all()
    return render_template('admin_radios_list.html', radios=radios)


@register_breadcrumb(admin_routes_radios, '.admin.radios.add', 'Add Role')
@admin_routes_radios.route('radios/add', methods=['GET', 'POST'])
@login_required
@role_required(role='administrator')
def admin_radios_add():
    form = AddRadioForm()
    users =  [(user.id, user.username) for user in UserModel.get_all_users()]
    form.assignedTo.choices = users
    form.owner.choices = users
    
    if form.validate_on_submit():
            radio = RadioModel.create(name=form.name.data, platform=form.platform.data, radio_type=form.radioType.data, description=form.description.data, software_version=form.softwareVersion.data, model=form.model.data, vendor=form.vendor.data, shortName=form.shortName.data, longName=form.longName.data, owner=form.owner.data, assignedTo=form.assignedTo.data)
                  
            try: 
                e = object.get("error")
                return render_template('form.html', form=form, error=e, title="Add Radio", formurl=url_for("admin_routes_radios.admin_radios_add"))
            except:
                pass
            
            return redirect(url_for('admin_routes_radios.admin_radios_list'))
    
    return render_template('form.html', form=form, title="Add Radio", formurl=url_for("admin_routes_radios.admin_radios_add"))



@register_breadcrumb(admin_routes_radios, '.admin.radios.edit', 'Edit Radios', dynamic_list_constructor=admin_radios)
@admin_routes_radios.route('radios/edit/<int:id>', methods=['GET', 'POST'])
@login_required
@role_required(role='administrator')
def admin_radios_edit(id):  
    radio = RadioModel.get_by_id(id)
    form = EditRadioForm(data=radio.__dict__)
    users =  [(user.id, user.username) for user in UserModel.get_all_users()]
    form.assignedTo.choices = users
    form.owner.choices = users

    if radio is None:
        return redirect(url_for('admin_routes_radios.admin_radios_edit'))
    
    if form.validate_on_submit():

        radio.name = form.name.data
        radio.description = form.description.data
        radio.platform = form.platform.data
        radio.radioType = form.radioType.data
        radio.software_version = form.softwareVersion.data
        radio.model = form.model.data
        radio.vendor = form.vendor.data
        radio.shortName = form.shortName.data
        radio.longName = form.longName.data
        radio.owner = form.owner.data
        radio.assignedTo = form.assignedTo.data
        
        RadioModel.update(radio)
        return redirect(url_for('admin_routes_radios.admin_radios_list'))
    
    return render_template('form.html', radio=radio, form=form, title="Edit Radios", formurl=url_for("admin_routes_radios.admin_radios_edit",id=radio.id))


@register_breadcrumb(admin_routes_radios, '.admin.radios.delete', 'Delete Role', dynamic_list_constructor=admin_radios)
@admin_routes_radios.route('radios/delete/<int:id>', methods=['GET', 'POST'])
@login_required
@role_required(role='administrator')

def admin_radios_delete(id):
    role = RadioModel.get_by_id(id)
    form = DeleteForm()
    
    if role is None:
        return redirect(url_for('admin_routes_radios.admin_radios_list'))
    
    if form.validate_on_submit():
        if form.areyousure.data != "OK":
            return render_template('form.html', role=role, form=form, error="You must type 'OK' to delete this record", title="Delete Role", formurl=url_for("admin_routes_radios.admin_radios_delete",id=role.id))
        
        RadioModel.delete_by_id(role.id)
        return redirect(url_for('admin_routes_radios.admin_radios_list'))
    return render_template('form.html', role=role, form=form, title="Delete Role", formurl=url_for("admin_routes_radios.admin_radios_delete",id=role.id))

