# Settings
The Following Environment Vars control the application:


SECRET_KEY: This sets a Secret Key for the application to make secure sessions
JWT_SECRET_KEY: Used for signing the Email Password Reset Links 

OTS_USERNAME: Dedicated username of the Administrative Open Tak Server User.
OTS_PASSWORD: Password for the Open Tak Server Username
OTS_URL: Open Tak Server url must be in format of http(s)://tak.domain.tld

DEBUG: (True/False) Show more detailed errors

MAIL_ENABLED: (True/False) Disable mail in App
MAIL_SERVER: Hostname of the Mailserver
MAIL_PORT: Port to use for E-Mail
MAIL_USERNAME: Username for E-Mail
MAIL_PASSWORD: Password for E-Mail
MAIL_USE_TLS: Use TLS make sure SSL is set to False if this is True
MAIL_USE_SSL: Use SSL make sure TLS is set to False if this is True
MAIL_DEFAULT_SENDER: The from E-Mail address in format of user@email.tld

BRAND_NAME: Sets the name of the portal used on headers and emails.
LOGO_PATH: Sets a logo path, if you want to add your own upload it to /app/static/img/custom/logo.ext and set the path to "/static/img/custom/logo.ext" we advise PNG formated.

ENABLE_API: Enables API Endpoints (BETA)
API_KEY: 32 CHAR SECRET for Authentication