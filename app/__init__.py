from flask import Flask
from app.views import routes
from app.admin_views import admin_routes
from app.admin_views_onboardingcodes import admin_routes_onboarding
from app.admin_views_users import admin_routes_users
from app.admin_views_takprofiles import admin_routes_takprofiles
from app.admin_views_roles import admin_routes_roles
from app.admin_views_meshtastic import admin_routes_meshtastic
from app.admin_views_packages import admin_routes_packages
from app.admin_views_radios import admin_routes_radios
from flask import jsonify
from app.models import db, migrate
from app.jina_filters import jina2_filters_blueprint
from flask_breadcrumbs import Breadcrumbs
from flask_menu import Menu
from app.extensions import mail, jwt_manager
from app.extensions import scheduler
import logging 
from app.extensions import qrcode

def create_app():
    # create and configure the app
    app = Flask(__name__)
    app.config.from_pyfile('settings.py')
    db.init_app(app)
    migrate.init_app(app, db)
    menu = Menu()
    breadcrumbs = Breadcrumbs(init_menu=False)
    menu.init_app(app)
    breadcrumbs.init_app(app)
    qrcode.init_app(app)
    # initialize scheduler
    logging.getLogger("apscheduler").setLevel(logging.INFO)
    # if you don't wanna use a config, you can set options here:
    scheduler.api_enabled = True
    scheduler.init_app(app)
    jwt_manager.init_app(app)
    app.register_blueprint(routes)
    app.register_blueprint(admin_routes)
    app.register_blueprint(admin_routes_onboarding)
    app.register_blueprint(admin_routes_users)
    app.register_blueprint(admin_routes_takprofiles)
    app.register_blueprint(admin_routes_roles)
    app.register_blueprint(admin_routes_meshtastic)
    app.register_blueprint(admin_routes_radios)

    if app.config['ENABLE_API']:
        from app.api_views import api_routes
        app.register_blueprint(api_routes)

    if app.config['ENABLE_REPO']:
        app.register_blueprint(admin_routes_packages)
    app.register_blueprint(jina2_filters_blueprint)
    mail.init_app(app)
    with app.app_context():
        scheduler.start()
    return app

app = create_app()

@app.errorhandler(403)
def not_authorised(e):
    return jsonify(error="Not authorized"), 403

@app.errorhandler(500)
def internal_server_error(e):
    return jsonify(error="Internal server error"), 500
    