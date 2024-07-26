from flask import Flask
from app.views import routes
from app.admin_views import admin_routes
from flask import jsonify
from app.models import db, migrate
from app.jina_filters import jina2_filters_blueprint
from flask_breadcrumbs import Breadcrumbs
from flask_menu import Menu
from app.extensions import mail, jwt_manager

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
    jwt_manager.init_app(app)
    app.register_blueprint(routes)
    app.register_blueprint(admin_routes)
    app.register_blueprint(jina2_filters_blueprint)
    mail.init_app(app)
    return app

app = create_app()

@app.errorhandler(403)
def not_authorised(e):
    return jsonify(error="Not authorized"), 403

@app.errorhandler(500)
def internal_server_error(e):
    return jsonify(error="Internal server error"), 500
    