from flask import Blueprint, request
from flask_breadcrumbs import default_breadcrumb_root
from app.models import RadioModel, MeshtasticModel
from app.decorators import api_login_required
import json
from app import db
from flask import Response
api_routes = Blueprint('api_routes', __name__, url_prefix='/')



@api_routes.route('/api/meshtastic/config/<configid>/<radioid>', methods=['GET'])
@api_login_required
def get_radio_config(radioid, configid):
    radioObject = RadioModel.query.filter_by(mac=radioid).first()

    if not radioObject:
        return {"error": "Radio not found"}, 404

    if configid == "default":
        radioConfig = MeshtasticModel.query.filter_by(defaultRadioConfig=True).first()
    else: 
        return {"error": "Configuration ID Invalid"}, 404


    if radioConfig and radioConfig.yamlConfig:

        placeholders = {
            # Radio Vars
            "${longName}": radioObject.longName,
            "${shortName}": radioObject.shortName,
            # Meshtastic Vars
            "${channelURL}": radioConfig.url
        }
        
        for placeholder, value in placeholders.items():
            radioConfig.yamlConfig = radioConfig.yamlConfig.replace(placeholder, value)

        return Response(
            radioConfig.yamlConfig,
            mimetype="application/x-yaml",
            headers={"Content-Disposition": "attachment;filename=default_config.yaml"}
        )
    
    return {"error": "configuration not found"}, 404





@api_routes.route('/api/radio', methods=['POST'])
@api_login_required

def create_or_update_radio():
    data = json.loads(request.get_json())
  
    
    if not data:
        return {"error": "Invalid input"}, 400

    if not data['info']['user'].get('id'):
        return {"error": "Mac is required"}, 400
    try:

        if data['info']['user'].get('id'):
            # Update existing radio
            radio = RadioModel.query.filter_by(mac=data['info']['user'].get('id')).first()

            # Check if the radio exists
            if not radio:
                # Create a new radio if it doesn't exist

                RadioModel.create(mac=data['info']['user'].get('id'), 
                                       name=data['info']['user'].get('longName'),
                                       shortName=data['info']['user'].get('shortName'),
                                       longName=data['info']['user'].get('longName'),
                                       publicKey=data['localConfig']['config']['security'].get('publicKey'),
                                       privateKey=data['localConfig']['config']['security'].get('privateKey'),
                                       role=data['info']['user'].get('role'),
                                       model=data['info']['user'].get('hwModel'),
                                       platform="LORA")
                
                return {"message": "Radio created successfully"}, 201
                
            # Update the radio details
            radio.mac = data['info']['user'].get('id')
           # radio.name = data['info']['user'].get('longName')
           # radio.shortName = data['info']['user'].get('shortName')
           # radio.longName = data['info']['user'].get('longName')
            radio.publicKey = data['localConfig']['config']['security'].get('publicKey')
            radio.privateKey = data['localConfig']['config']['security'].get('privateKey')
            radio.role = data['info']['user'].get('role')
            radio.model = data['info']['user'].get('hwModel')
            radio.platform = "LORA"
            radio.updatedAt = db.func.current_timestamp()

    
            print(radio.__dict__)

            RadioModel.update(radio)
            return {"message": "Radio updated successfully"}, 200

    except Exception as e:
        return {"error": str(e)}, 500