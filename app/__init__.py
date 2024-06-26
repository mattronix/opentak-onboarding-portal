from flask import Flask
from app.views import routes
from flask import jsonify
from flask_socketio import SocketIO, emit
from gevent import monkey

socketio = SocketIO(async_mode="gevent", logger=True, engineio_logger=True, cors_allowed_origins="*")

@socketio.on('connect', namespace='/powerupdates')
def connect_handler():
    print('connected')
    emit('response', {'meta': 'WS connected'})


def create_app():
    # create and configure the app
    app = Flask(__name__)
    app.config.from_pyfile('settings.py')
    app.register_blueprint(routes)
    socketio.init_app(app)
    return app

app = create_app()


@app.errorhandler(403)
def not_authorised(e):
    return jsonify(error="Not authorized"), 403

@app.errorhandler(500)
def internal_server_error(e):
    return jsonify(error="Internal server error"), 500

if not app.config["DEBUG"]:
    monkey.patch_all()
    
