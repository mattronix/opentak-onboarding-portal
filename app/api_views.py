from flask import Blueprint, request
from flask_breadcrumbs import default_breadcrumb_root
from app.models import MeshtasticModel  

routes = Blueprint('routes', __name__, url_prefix='/')
default_breadcrumb_root(routes, '.',)

@routes.route('/api/radio', methods=['POST'])

def create_or_update_radio():
    data = request.get_json()

    if not data:
        return {"error": "Invalid input"}, 400

    radio_id = data.get('id')
    name = data.get('name')
    frequency = data.get('frequency')
    description = data.get('description')

    if not name or not frequency:
        return {"error": "Name and frequency are required"}, 400

    try:
        if radio_id:
            # Update existing radio
            radio = MeshtasticModel.query.get(radio_id)
            if not radio:
                return {"error": "Radio not found"}, 404

            radio.name = name
            radio.frequency = frequency
            radio.description = description
            MeshtasticModel.update_radio(radio)
            return {"message": "Radio updated successfully"}, 200
        else:
            # Create new radio
            new_radio = MeshtasticModel(name=name, frequency=frequency, description=description)
            MeshtasticModel.add_radio(new_radio)
            return {"message": "Radio created successfully"}, 201
    except Exception as e:
        return {"error": str(e)}, 500