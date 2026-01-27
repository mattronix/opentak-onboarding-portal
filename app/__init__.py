from flask import Flask
from flask_cors import CORS
from flask import jsonify
from app.models import db, migrate
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
    qrcode.init_app(app)
    # initialize scheduler (skip in testing mode)
    if not app.config.get('TESTING'):
        logging.getLogger("apscheduler").setLevel(logging.INFO)
        # if you don't wanna use a config, you can set options here:
        scheduler.api_enabled = True
        scheduler.init_app(app)
    jwt_manager.init_app(app)

    # JWT error handlers
    @jwt_manager.invalid_token_loader
    def invalid_token_callback(error):
        app.logger.error(f"Invalid token: {error}")
        return jsonify({
            'error': 'Invalid or expired token. Please log in again.',
            'message': 'Session expired',
            'code': 'TOKEN_INVALID'
        }), 401

    @jwt_manager.expired_token_loader
    def expired_token_callback(jwt_header, jwt_payload):
        app.logger.error(f"Expired token")
        return jsonify({
            'error': 'Token has expired. Please log in again.',
            'code': 'TOKEN_EXPIRED'
        }), 401

    @jwt_manager.unauthorized_loader
    def unauthorized_callback(error):
        app.logger.error(f"Unauthorized: {error}")
        return jsonify({
            'error': 'Authorization required. Please log in.',
            'message': str(error),
            'code': 'AUTH_REQUIRED'
        }), 401

    # Register API blueprints (always enabled - API is the only mode)
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

    # Serve React SPA for all non-API routes
    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def serve_spa(path):
        """Serve the React SPA for all non-API routes"""
        # Note: API routes (/api/*) are handled by blueprints registered above
        # This catch-all only handles frontend routes

        # Determine static folder path
        # In Docker: /app/frontend/dist
        # In local dev: <project_root>/frontend/dist
        app_dir = os.path.dirname(os.path.abspath(__file__))  # /app/app
        project_root = os.path.dirname(app_dir)  # /app

        # Try multiple possible paths
        possible_paths = [
            os.path.join(project_root, 'frontend', 'dist'),  # /app/frontend/dist (Docker)
            os.path.join(os.path.dirname(project_root), 'frontend', 'dist'),  # Local dev
        ]

        static_folder = None
        for path_candidate in possible_paths:
            abs_path = os.path.abspath(path_candidate)
            if os.path.exists(abs_path) and os.path.isdir(abs_path):
                static_folder = abs_path
                break

        if not static_folder:
            app.logger.error(f"Frontend dist folder not found. Tried: {possible_paths}")
            return jsonify({'error': 'Frontend not built. Run: cd frontend && npm run build'}), 404

        app.logger.debug(f"SPA route: path={path}, static_folder={static_folder}")

        # If path exists as a file, serve it
        if path and os.path.exists(os.path.join(static_folder, path)):
            return send_from_directory(static_folder, path)

        # Check if index.html exists
        index_path = os.path.join(static_folder, 'index.html')
        if not os.path.exists(index_path):
            app.logger.error(f"index.html not found in: {static_folder}")
            return jsonify({'error': 'Frontend index.html not found'}), 404

        # Otherwise serve index.html (for client-side routing)
        return send_from_directory(static_folder, 'index.html')

    mail.init_app(app)
    if not app.config.get('TESTING'):
        with app.app_context():
            scheduler.start()
            # Seed admin roles
            from app.rbac import seed_admin_roles
            from app.models import UserRoleModel
            seed_admin_roles(db, UserRoleModel)
            # Initialize default system settings
            from app.models import SystemSettingsModel
            try:
                SystemSettingsModel.initialize_defaults()
            except Exception as e:
                print(f"Warning: Could not initialize system settings (likely pending migration): {e}")
    return app

app = create_app()

@app.errorhandler(403)
def not_authorised(e):
    return jsonify(error="Not authorized"), 403

@app.errorhandler(422)
def unprocessable_entity(e):
    app.logger.error(f"422 Error: {str(e)}")
    return jsonify(error=str(e)), 422

@app.errorhandler(500)
def internal_server_error(e):
    app.logger.error(f"500 Error: {str(e)}")
    return jsonify(error="Internal server error"), 500
    