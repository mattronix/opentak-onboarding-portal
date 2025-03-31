from flask import Blueprint, request
from flask_breadcrumbs import default_breadcrumb_root
from app.models import RadioModel  
from app.decorators import api_login_required
import json
api_routes = Blueprint('api_routes', __name__, url_prefix='/')


@api_routes.route('/api/radio', methods=['POST'])
@api_login_required

def create_or_update_radio():
    data = request.get_json(force=True)
    data = json.loads(data)

    print(data)
    if not data:
        return {"error": "Invalid input"}, 400

    if not data['user'].get('id'):
        return {"error": "Mac is required"}, 400





    try:
        if data['user'].get('id'):
            # Update existing radio
            radio = RadioModel.query.filter_by(mac=data['user'].get('id')).first()

            # Check if the radio exists
            if not radio:
                # Create a new radio if it doesn't exist

                RadioModel.create(mac=data['user'].get('id'), 
                                       name=data['user'].get('longName'),
                                       shortName=data['user'].get('shortName'),
                                       longName=data['user'].get('longName'),
                                       publicKey=data['user'].get('publicKey'),
                                       role=data['user'].get('role'),
                                       model=data['user'].get('model'),
                                       platform="LORA")
                
                return {"message": "Radio created successfully"}, 201
                
            # Update the radio details
            radio.mac = data['user'].get('id')
            radio.name = data['user'].get('longName')
            radio.short_name = data['user'].get('shortName')
            radio.long_name = data['user'].get('longName')
            radio.public_key = data['user'].get('publicKey')
            radio.role = data['user'].get('role')
            radio.model = data['user'].get('model')
            radio.platform = "LORA"


            RadioModel.update(radio)
            return {"message": "Radio updated successfully"}, 200

    except Exception as e:
        return {"error": str(e)}, 500