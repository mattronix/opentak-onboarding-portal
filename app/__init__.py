from flask import Flask
from app.views import routes
from flask import jsonify
from app.models import db, migrate


def create_app():
    # create and configure the app
    app = Flask(__name__)
    app.config.from_pyfile('settings.py')
    db.init_app(app)
    migrate.init_app(app, db)
    app.register_blueprint(routes)
    return app

app = create_app()

@app.errorhandler(403)
def not_authorised(e):
    return jsonify(error="Not authorized"), 403

@app.errorhandler(500)
def internal_server_error(e):
    return jsonify(error="Internal server error"), 500
    