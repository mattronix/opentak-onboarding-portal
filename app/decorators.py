from flask import session, redirect, url_for, render_template
import functools
from app.models import UserModel
from flask import request, jsonify
from app.settings import API_KEY
def login_required(route):
    @functools.wraps(route)
    def route_wrapper(*args, **kwargs):
        if session.get("ots_profile") is None:
            return redirect(url_for("routes.login"))

        return route(*args, **kwargs)

    return route_wrapper


def api_login_required(route):
    @functools.wraps(route)
    def route_wrapper(*args, **kwargs):
        api_key = request.headers.get("X-API-KEY")
        if not api_key or api_key != API_KEY:
            response = jsonify({"error": "Unauthorized"})
            response.headers["Content-Type"] = "application/json"
            return response, 401

        return route(*args, **kwargs)

    return route_wrapper

def role_required(role):
    def decorator(route):
        @functools.wraps(route)
        def route_wrapper(*args, **kwargs):
            if role is None:
                raise ValueError("Role is required")
            
            username = session.get("username")
            user = UserModel.get_user_by_username(username)
            
            if user is None:
                return render_template('access_denied.html')
            
            if role in [r.name for r in user.roles]:
                return route(*args, **kwargs)

            return render_template('access_denied.html')

        return route_wrapper
    return decorator