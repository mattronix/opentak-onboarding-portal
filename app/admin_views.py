from flask import render_template, Blueprint, session
from app.settings import ENABLE_REPO
from app.decorators import login_required, role_required
from app.models import UserModel
from flask_breadcrumbs import register_breadcrumb, default_breadcrumb_root


admin_routes = Blueprint('admin_routes', __name__, url_prefix='/admin')
default_breadcrumb_root(admin_routes, '.',)


@register_breadcrumb(admin_routes, '.admin', 'Admin Portal')
@admin_routes.route('/')
@login_required
@role_required(role='administrator')
def home():  
    user = UserModel.get_user_by_username(session['username'])
    return render_template('admin_index.html', user=user, ENABLE_REPO=ENABLE_REPO)


