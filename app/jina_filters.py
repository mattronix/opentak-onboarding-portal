from flask import session, app
from app.models import UserModel
from flask import session, current_app
from app.models import UserModel
from flask import Blueprint

jina2_filters_blueprint = Blueprint('jina2_filters', __name__)

@jina2_filters_blueprint.app_context_processor
def doesCurrentUserHaveRole():
    def _doesCurrentUserHaveRole(role):
        username = session.get("username")
        user = UserModel.get_user_by_username(username)
               
        if user is None:
            return False
        
        if role in [r.name for r in user.roles]:
            return True
        
        return False

    return dict(doesCurrentUserHaveRole=_doesCurrentUserHaveRole)