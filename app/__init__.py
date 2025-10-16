from flask import Flask
from flask_cors import CORS
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

    # Enable CORS for API endpoints
    CORS(app, resources={
        r"/api/*": {
            "origins": app.config.get('CORS_ORIGINS', '*'),
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"],
            "supports_credentials": True
        }
    })

    db.init_app(app)
    migrate.init_app(app, db, render_as_batch=False)
    menu = Menu()
    breadcrumbs = Breadcrumbs(init_menu=False)
    menu.init_app(app)
    breadcrumbs.init_app(app)
    qrcode.init_app(app)
    # initialize scheduler (skip in testing mode)
    if not app.config.get('TESTING'):
        logging.getLogger("apscheduler").setLevel(logging.INFO)
        # if you don't wanna use a config, you can set options here:
        scheduler.api_enabled = True
        scheduler.init_app(app)
    jwt_manager.init_app(app)

    # Register traditional form-based blueprints (unless API-only mode is enabled)
    if not app.config.get('API_ONLY_MODE', False):
        app.register_blueprint(routes)
        app.register_blueprint(admin_routes)
        app.register_blueprint(admin_routes_onboarding)
        app.register_blueprint(admin_routes_users)
        app.register_blueprint(admin_routes_takprofiles)
        app.register_blueprint(admin_routes_roles)
        app.register_blueprint(admin_routes_meshtastic)
        app.register_blueprint(admin_routes_radios)

    # Register API blueprints
    if app.config['ENABLE_API']:
        from app.api_views import api_routes
        app.register_blueprint(api_routes)

        # Register new RESTful API v1
        from app.api_v1 import api_v1
        app.register_blueprint(api_v1)

        # Setup Swagger UI for API documentation
        from flask_swagger_ui import get_swaggerui_blueprint
        from flask import send_from_directory
        import os

        SWAGGER_URL = '/api/docs'
        API_URL = '/api/v1/swagger.json'

        # Serve the swagger spec file
        @app.route('/api/v1/swagger.json')
        def swagger_spec():
            """Serve the OpenAPI specification"""
            import yaml
            import json
            swagger_path = os.path.join(os.path.dirname(__file__), 'swagger.yml')
            with open(swagger_path, 'r') as f:
                spec = yaml.safe_load(f)
            return json.dumps(spec), 200, {'Content-Type': 'application/json'}

        swaggerui_blueprint = get_swaggerui_blueprint(
            SWAGGER_URL,
            API_URL,
            config={
                'app_name': "OpenTAK Onboarding Portal API",
                'defaultModelsExpandDepth': -1,  # Hide schemas section by default
                'docExpansion': 'list',  # Expand endpoints list
                'displayRequestDuration': True,
                'filter': True,  # Enable search
                'persistAuthorization': True,  # Remember auth token
                'tryItOutEnabled': True  # Enable "Try it out" by default
            }
        )

        app.register_blueprint(swaggerui_blueprint)

    if app.config['ENABLE_REPO']:
        app.register_blueprint(admin_routes_packages)

    app.register_blueprint(jina2_filters_blueprint)
    mail.init_app(app)
    if not app.config.get('TESTING'):
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
    