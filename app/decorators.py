from flask import request, jsonify
import functools
from app.settings import API_KEY


def api_login_required(route):
    """Decorator for API endpoints that require API key authentication.

    Used by device-facing endpoints (e.g., Meshtastic radio integration).
    Validates X-API-KEY header against the configured API_KEY.
    """
    @functools.wraps(route)
    def route_wrapper(*args, **kwargs):
        api_key = request.headers.get("X-API-KEY")
        if not api_key or api_key != API_KEY:
            response = jsonify({"error": "Unauthorized"})
            response.headers["Content-Type"] = "application/json"
            return response, 401

        return route(*args, **kwargs)

    return route_wrapper