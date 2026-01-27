from app.extensions import scheduler
from app.models import UserModel, AnnouncementModel, db
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


@scheduler.task(id="send_scheduled_announcements", trigger="interval", minutes=1, misfire_grace_time=60, max_instances=1)
def send_scheduled_announcements():
    """Check for and send scheduled announcements"""
    print('Checking for scheduled announcements...')
    with scheduler.app.app_context():
        due_announcements = AnnouncementModel.get_scheduled_due()

        for announcement in due_announcements:
            print(f"Sending scheduled announcement: {announcement.title}")
            try:
                announcement.status = 'sent'
                announcement.sent_at = datetime.now()
                db.session.commit()

                # Send emails if enabled
                if announcement.send_email:
                    from app.api_v1.announcements import _send_announcement_emails
                    _send_announcement_emails(announcement)

                print(f"Successfully sent announcement: {announcement.title}")
            except Exception as e:
                print(f"Failed to send announcement {announcement.id}: {e}")
                db.session.rollback()
    return
