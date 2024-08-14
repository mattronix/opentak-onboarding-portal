from app.extensions import scheduler
from app.models import UserModel, db
from datetime import datetime
from app.ots import otsClient


@scheduler.task(id="remove_expired_accounts", trigger="cron", hour=1, misfire_grace_time=3600, max_instances=1)
#@scheduler.task(id="remove_expired_accounts", trigger="interval", seconds=1) #DEBUG
def remove_expired_accounts():
    print('Removing expired accounts...')
    with scheduler.app.app_context():
        today = datetime.now()
        expired_users = UserModel.query.filter(UserModel.expiryDate < today).all()
        for user in expired_users:
            print(f"Removing user {user.username} with expiry date {user.expiryDate}")
            otsClient.delete_user(user.username)
            db.session.delete(user)
        db.session.commit()
    return
