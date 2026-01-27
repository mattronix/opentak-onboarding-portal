"""
Version API endpoint
Returns current backend version information
"""

from flask import jsonify
from app.api_v1 import api_v1

@api_v1.route('/version', methods=['GET'])
def get_version():
    """
    Get backend version information

    Returns:
        {
            "commit": "152c5fe3f18f",
            "date": "2025-10-17",
            "build_time": "2025-10-16T23:42:16.445998Z"
        }
    """
    try:
        from app.version import get_version as get_version_info
        return jsonify(get_version_info()), 200
    except ImportError:
        # Fallback if version file doesn't exist
        return jsonify({
            'commit': 'dev',
            'date': 'unknown',
            'build_time': 'unknown'
        }), 200
