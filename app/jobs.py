from app.extensions import scheduler
from app.models import UserModel, db
from datetime import datetime

@scheduler.task(id="remove_expired_accounts", trigger="cron", hour=0, minute=1)
def remove_expired_accounts():
    print('Removing expired accounts...')
    with scheduler.app.app_context():
        today = datetime.now()
        expired_users = UserModel.query.filter(UserModel.expiryDate < today).all()
        for user in expired_users:
            print(f"Removing user {user.username} with expiry date {user.expiryDate}")
            db.session.delete(user)
        db.session.commit()
    return
