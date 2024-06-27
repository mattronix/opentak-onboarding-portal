from flask import session, redirect, url_for
import functools

def login_required(route):
    @functools.wraps(route)
    def route_wrapper(*args, **kwargs):
        if session.get("ots_profile") is None:
            return redirect(url_for("routes.login"))

        return route(*args, **kwargs)

    return route_wrapper
