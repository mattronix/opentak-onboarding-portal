from flask import render_template, Blueprint, request, session
from flask import redirect, url_for
from app.settings import UPDATES_UPLOAD_FOLDER, ENABLE_REPO
from app.decorators import login_required, role_required
from app.forms import DeleteForm, MeshtasticForm, AddPackageForm, EditPackageForm
from app.models import UserModel, UserRoleModel, MeshtasticModel, PackageModel, RadioModel
from flask_breadcrumbs import register_breadcrumb, default_breadcrumb_root
import os
import zipfile
import ast
import os
import zipfile

admin_routes_packages = Blueprint('admin_routes_packages', __name__, url_prefix='/admin')
default_breadcrumb_root(admin_routes_packages, '.',)



def admin_packages(*args, **kwargs):
    object_id = request.view_args['id']
    object = PackageModel.get_by_id(object_id)

    if object:
        return [{'text': object.name, 'url': f'/admin/packages/edit/{object_id}'}]
    return {'text': "Profile", 'url':""}


def package_uploader(file, package, key):

    filename = f"{package.id}.{file.filename.split('.')[-1]}"

    try:
        if not os.path.exists(UPDATES_UPLOAD_FOLDER):
            os.makedirs(UPDATES_UPLOAD_FOLDER)

        uploaddir = f"{UPDATES_UPLOAD_FOLDER}"
        file_path = os.path.join(uploaddir, filename)

        if key == "fileLocation" and package.fileLocation and os.path.exists(package.fileLocation):
            os.remove(package.fileLocation)
        
        if key == "imageLocation" and package.imageLocation and os.path.exists(package.imageLocation):
            os.remove(package.imageLocation)

        if key == "fileLocation":
            package.fileLocation = file_path
        if key == "imageLocation":
            package.imageLocation = file_path


        file.save(file_path)

        return package
    
    except OSError:
        print(f"Error creating {UPDATES_UPLOAD_FOLDER}")
        return {"error" : "Error creating upload directory"}


@register_breadcrumb(admin_routes_packages, '.admin.packages', 'Packages')
@admin_routes_packages.route('packages')
@login_required
@role_required(role='administrator')
def admin_packages_list():  
    packages = PackageModel.get_all()
    return render_template('admin_packages_list.html', packages=packages)

@register_breadcrumb(admin_routes_packages, '.admin.packages.add', 'Add Package')
@admin_routes_packages.route('packages/add', methods=['GET', 'POST'])
@login_required
@role_required(role='administrator')
def admin_package_add():
    form = AddPackageForm()

    if form.validate_on_submit():
        object = PackageModel.create(name=form.name.data, description=form.description.data, version=form.version.data, platform=form.platform.data, type_package=form.typePackage.data, revision_code=form.revisionCode.data, apk_hash=form.apkHash.data, os_requirement=form.osRequirement.data, tak_prereq=form.takPreReq.data, apk_size=form.apkSize.data, full_package_name=form.fullPackageName.data)

        if form.package.data:
            object = package_uploader(form.package.data, object, "fileLocation")

        if form.image.data:
            object = package_uploader(form.image.data, object, "imageLocation")
        
        PackageModel.update(object)

        try:
            e = object.get("error")
            return render_template('form.html', form=form, error=e, title="Add Package", formurl=url_for("admin_routes_packages.admin_package_add"))
        except:
            pass

        return redirect(url_for('admin_routes_packages.admin_packages_list'))
    return render_template('form.html', form=form, title="Add Package", formurl=url_for("admin_routes_packages.admin_package_add"))

@register_breadcrumb(admin_routes_packages, '.admin.packages.edit', 'Edit Package', dynamic_list_constructor=admin_packages)
@admin_routes_packages.route('packages/edit/<int:id>', methods=['GET', 'POST'])
@login_required
@role_required(role='administrator')
def admin_package_edit(id):  
    object = PackageModel.get_by_id(id)
    form = EditPackageForm(data=object.__dict__)

    if object is None:
        return redirect(url_for('admin_routes_packages.admin_package_edit'))

    if form.validate_on_submit():
        object.name = form.name.data
        object.description = form.description.data
        object.version = form.version.data
        object.platform = form.platform.data
        object.typePackage = form.typePackage.data
        object.revisionCode = form.revisionCode.data
        object.apkHash = form.apkHash.data
        object.osRequirement = form.osRequirement.data
        object.takPreReq = form.takPreReq.data
        object.apkSize = form.apkSize.data
        object.fullPackageName = form.fullPackageName.data
        
        if form.package.data:
            object = package_uploader(form.package.data, object, "fileLocation")

        if form.image.data:
            object = package_uploader(form.image.data, object, "imageLocation")
            
        PackageModel.update(object)
        return redirect(url_for('admin_routes_packages.admin_package_edit', id=object.id))

    return render_template('form.html', form=form, title="Edit Package", formurl=url_for("admin_routes_packages.admin_package_edit",id=object.id))

@register_breadcrumb(admin_routes_packages, '.admin.packages.delete', 'Delete Meshtastic Config', dynamic_list_constructor=admin_packages)
@admin_routes_packages.route('packages/delete/<int:id>', methods=['GET', 'POST'])
@login_required
@role_required(role='administrator')

def admin_package_delete(id):
    object = PackageModel.get_by_id(id)
    form = DeleteForm()

    if object is None:
        return redirect(url_for('admin_routes_packages.admin_packages_list'))
    
    if form.validate_on_submit():
        if form.areyousure.data != "OK":                
            return render_template('form.html', role=object, form=form, error="You must type 'OK' to delete this record", title="Delete Meshtastic Config", formurl=url_for("admin_routes_packages.admin_package_delete",id=object.id))
        
        if object.fileLocation and os.path.exists(object.fileLocation):
            os.remove(object.fileLocation)

        if object.imageLocation and os.path.exists(object.imageLocation):
            os.remove(object.imageLocation)
            
        PackageModel.delete_by_id(object.id)
        return redirect(url_for('admin_routes_packages.admin_packages_list'))
    return render_template('form.html', form=form, title="Delete Package", formurl=url_for("admin_routes_packages.admin_package_delete",id=object.id))

@register_breadcrumb(admin_routes_packages, '.admin.packages.generateinfz', 'Generate Package Infz')
@admin_routes_packages.route('packages/generate', methods=['GET'])
@login_required
@role_required(role='administrator')
def admin_package_generate_infz():  


    packages = PackageModel.get_all()
    inf_data = "#platform (Android Windows or iOS), type (app or plugin), full package name, display/label, version, revision code (integer), relative path to APK file, relative path to icon file, description, apk hash, os requirement, tak prereq (e.g. plugin-api), apk size\n"

    for package in packages:

        if not package.platform:
            package.platform = ""
        if not package.typePackage:
            package.typePackage = ""
        if not package.fullPackageName:
            package.fullPackageName = ""
        if not package.name:
            package.name = ""
        if not package.version:
            package.version = ""
        if not package.revisionCode:
            package.revisionCode = ""
        if package.fileLocation:
            package.fileLocation = package.fileLocation.replace('updates/', '', 1)
        else: 
            package.fileLocation = ""
        if package.imageLocation:
            package.imageLocation = package.imageLocation.replace('updates/', '', 1)
        else:
            package.imageLocation = ""
        if not package.description:
            package.description = ""
        if not package.apkHash:
            package.apkHash = ""
        if not package.osRequirement:
            package.osRequirement = ""
        if not package.takPreReq:
            package.takPreReq = ""
        if not package.apkSize:
            package.apkSize = ""

        inf_data += f"{package.platform},{package.typePackage},{package.fullPackageName},{package.name},{package.version},{package.revisionCode},{package.fileLocation},{package.imageLocation},{package.description},{package.apkHash},{package.osRequirement},{package.takPreReq},{package.apkSize}\n"

    if os.path.exists(UPDATES_UPLOAD_FOLDER):
        inf_filename = "product.inf"
        inf_file_path = os.path.join(UPDATES_UPLOAD_FOLDER, inf_filename)

        with open(inf_file_path, "w") as inf_file:
            inf_file.write(inf_data)

    

    if os.path.exists(UPDATES_UPLOAD_FOLDER):
        zip_filename = "product.infz"
        zip_file_path = os.path.join(UPDATES_UPLOAD_FOLDER, zip_filename)

        with zipfile.ZipFile(zip_file_path, "w") as zip_file:
            for root, dirs, files in os.walk(UPDATES_UPLOAD_FOLDER):
                for file in files:
                    if not file.endswith(".infz") and file.endswith(".inf"):
                        file_path = os.path.join(root, file)
                        zip_file.write(file_path, os.path.relpath(file_path, UPDATES_UPLOAD_FOLDER))

    return '', 200