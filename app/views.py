from flask import render_template, Blueprint, request
from flask import jsonify
import time
import app

routes = Blueprint('routes', __name__)

# Create a dictionary to store the active telnet connections

@routes.route('/')
def home():  
    return render_template('index.html')
