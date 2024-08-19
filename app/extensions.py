from flask_mail import Mail

mail = Mail()

from flask_jwt_extended import JWTManager

jwt_manager = JWTManager()


from flask_apscheduler import APScheduler

scheduler = APScheduler()


from flask_qrcode import QRcode

qrcode = QRcode()