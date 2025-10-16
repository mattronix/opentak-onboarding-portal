"""
QR Code API endpoints
Generates QR code connection strings for ATAK/iTAK
Mimics the OTS server /Marti/api/tls/config/qr endpoint
"""

from flask import request, Response, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.api_v1 import api_v1
from app.ots import otsClient
import qrcode
import io


@api_v1.route('/Marti/api/tls/config/qr', methods=['GET'])
@jwt_required(optional=True)
def get_marti_qr():
    """
    Get QR code image for ATAK/iTAK configuration

    Mimics the OTS server endpoint: /Marti/api/tls/config/qr?clientUid=username

    Query Parameters:
    - clientUid: Username for the client (optional if using JWT auth)

    Returns:
    - PNG image of QR code
    """
    try:
        # Get username from query param or JWT token
        client_uid = request.args.get('clientUid')

        if not client_uid:
            # Try to get from JWT if authenticated
            try:
                client_uid = get_jwt_identity()
            except:
                pass

        if not client_uid:
            return Response(
                'Missing clientUid parameter',
                status=400,
                mimetype='text/plain'
            )

        # Try to get existing QR string from OTS
        qr_code_response = otsClient.get_atak_qr_string(client_uid)

        # If not found, create new one
        if qr_code_response is None or not qr_code_response.get('response', {}).get('qr_string'):
            qr_code_response = otsClient.create_atak_qr_string(client_uid)

        # Check if we got a valid response
        if not qr_code_response or not qr_code_response.get('response'):
            return Response(
                'Failed to communicate with OTS server',
                status=500,
                mimetype='text/plain'
            )

        qr_string = qr_code_response['response'].get('qr_string')

        if not qr_string:
            return Response(
                'Failed to generate QR string',
                status=500,
                mimetype='text/plain'
            )

        # Generate QR code image
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_H,
            box_size=10,
            border=4,
        )
        qr.add_data(qr_string)
        qr.make(fit=True)

        # Create PNG image
        img = qr.make_image(fill_color="black", back_color="white")

        # Save to bytes buffer
        img_io = io.BytesIO()
        img.save(img_io, 'PNG')
        img_io.seek(0)

        return Response(
            img_io.getvalue(),
            mimetype='image/png',
            headers={
                'Content-Disposition': f'inline; filename=qr_{client_uid}.png',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        )

    except Exception as e:
        current_app.logger.error(f"QR code generation error: {str(e)}")
        return Response(
            f'Failed to generate QR code: {str(e)}',
            status=500,
            mimetype='text/plain'
        )


@api_v1.route('/qr/atak', methods=['GET'])
@jwt_required()
def get_atak_qr_string():
    """
    Get ATAK QR code connection string (JSON format)

    Returns the QR string that can be scanned by ATAK/iTAK to configure
    connection to the TAK server.

    Response:
    {
        "qr_string": "string",
        "username": "string"
    }
    """
    try:
        # Get current user's username
        username = get_jwt_identity()

        # Try to get existing QR string
        qr_code = otsClient.get_atak_qr_string(username)

        # If not found, create new one
        if qr_code is None or not qr_code.get('response', {}).get('qr_string'):
            qr_code = otsClient.create_atak_qr_string(username)

        # Check if we got a valid response
        if qr_code and qr_code.get('response'):
            qr_string = qr_code['response'].get('qr_string')

            if qr_string:
                return {
                    'qr_string': qr_string,
                    'username': username
                }, 200
            else:
                return {
                    'error': 'Failed to generate QR string',
                    'details': 'QR string is empty'
                }, 500
        else:
            return {
                'error': 'Failed to communicate with OTS server',
                'details': 'No response from server'
            }, 500

    except Exception as e:
        return {
            'error': 'Failed to generate QR code',
            'details': str(e)
        }, 500
