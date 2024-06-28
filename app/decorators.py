from flask import session, redirect, url_for, render_template
import functools
from app.models import UserModel

def login_required(route):
    @functools.wraps(route)
    def route_wrapper(*args, **kwargs):
        if session.get("ots_profile") is None:
            return redirect(url_for("routes.login"))

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
            
            if role not in [r.name for r in user.roles]:
                return render_template('access_denied.html')

            return route(*args, **kwargs)

        return route_wrapper
    return decorator