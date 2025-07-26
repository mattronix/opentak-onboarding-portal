from flask import render_template, Blueprint, make_response, session
from app.ots import otsClient, OTSClient
from flask import redirect, url_for, request
from app.settings import OTS_URL, MAIL_ENABLED, HELP_LINK, PRIMARY_COLOR, SECONDARY_COLOR, ACCENT_COLOR, LOGO_PATH, UPDATES_UPLOAD_FOLDER, FORGOT_PASSWORD_ENABLED, MAIL_ENABLED, ENABLE_REPO, ENABLE_CLAIM_RADIO, ITAK_HOMEPAGE_ICON_ENABLED, TRUSTSTORE_HOMEPAGE_ICON_ENABLED
from app.decorators import login_required
from app.forms import LoginForm, RegisterForm, UserProfileEditForm, RegisterForm, ResetPasswordForm, ResetPasswordRequestForm
from app.models import UserModel, UserRoleModel, OnboardingCodeModel, TakProfileModel, MeshtasticModel, PackageModel, RadioModel, db
from flask_breadcrumbs import register_breadcrumb, default_breadcrumb_root
from app.email import send_html_email
from flask import send_file
import io
import zipfile
import os
import tempfile
import shutil
import xml.etree.ElementTree as ET
from flask_jwt_extended import create_access_token, decode_token
import datetime


routes = Blueprint('routes', __name__, url_prefix='/')
default_breadcrumb_root(routes, '.',)

@register_breadcrumb(routes, '.', 'Home')
@routes.route('/')
@login_required
def home():  
    user = UserModel.get_user_by_username(session['username']) 
    user_roles = [role.id for role in user.roles] if user and user.roles else []
    public_tak_profiles = TakProfileModel.query.filter_by(isPublic=True).all()
    private_tak_profiles = TakProfileModel.query.filter(TakProfileModel.roles.any(UserRoleModel.id.in_(user_roles))).all()
    tak_profiles = list(set(public_tak_profiles + private_tak_profiles))
    public_meshtastic_configs = MeshtasticModel.query.filter_by(isPublic=True, showOnHomepage=True).all()
    private_meshtastic_configs = MeshtasticModel.query.filter(MeshtasticModel.roles.any(UserRoleModel.id.in_(user_roles))).filter_by(showOnHomepage=True).all()
    meshtastic_configs = list(set(public_meshtastic_configs + private_meshtastic_configs))
    help_link = HELP_LINK
    assignedRadios = RadioModel.query.filter_by(assignedTo=user.id).all()

    try:
        qr_code = otsClient.get_atak_qr_string(user.username)
        if qr_code is None:
            qr_code = otsClient.create_atak_qr_string(user.username)
    except Exception as e:
            qr_code = otsClient.create_atak_qr_string(user.username)

    return render_template('index.html', user=user, public_tak_profiles=public_tak_profiles, private_tak_profiles=private_tak_profiles, help_link=help_link, OTS_URL=OTS_URL, tak_profiles=tak_profiles, meshtastic_configs=meshtastic_configs, assignedRadios=assignedRadios, qr_code=qr_code)

    
@routes.route('/logout')
def logout():
    # Remove the OTS session from the session variable
    session.pop('ots_profile', None)
    session.pop('username', None)
    return redirect(url_for('routes.login'))

@register_breadcrumb(routes, '.login', 'Login')
@routes.route('/login', methods=['GET', 'POST'])
def login():
    form = LoginForm()
    if form.validate_on_submit():
        # Get the username and password from the form
        form_username = form.username.data
        password = form.password.data
        username = form_username.lower()
        try:
            otsSession = OTSClient(OTS_URL, username, password)
            # Store the OTS session in a session variable
            ots_profile = otsSession.get_me()
            session['ots_profile'] = ots_profile
            session['username'] = ots_profile["response"]["username"]

            # Check if the user exists in the database
            user = UserModel.query.filter_by(username=username).first()

            if user is None:
                user = UserModel.create_user(username)

            for role in ots_profile['response']['roles']:
                role_name = role['name']
                role_description = role['description']

                userRoleModel = UserRoleModel.get_role_by_name(role['name'])

                if userRoleModel is None:
                    userRoleModel = UserRoleModel.create_role(role_name)
                    
                if user not in userRoleModel.users:
                    userRoleModel.users.append(user)
                    db.session.commit()
                
        except Exception as e:
            print(f"Error: {e}")
            return render_template('login.html', error="Invalid username or password", form=form)


        # Redirect to the home page if authentication is successful
        return redirect(url_for('routes.home'))

    # Render the login page template for GET requests
    return render_template('login.html', form=form)


@register_breadcrumb(routes, '.Register', 'Register')
@routes.route('/register/<onboardingCode>', methods=['GET', 'POST'])
def register(onboardingCode):
    onboardingCodeModel = OnboardingCodeModel.query.filter_by(onboardingCode=onboardingCode).first()

    if onboardingCodeModel is None:
        return render_template('restricted.html', error="Invalid onboarding code")
    

    if onboardingCodeModel.userExpiryDate is not None:
        if onboardingCodeModel.userExpiryDate < datetime.datetime.now():
            return render_template('restricted.html', error="User expiry date exeeded.")

    if onboardingCodeModel.expiryDate is not None:
        if onboardingCodeModel.expiryDate < datetime.datetime.now():
            return render_template('restricted.html', error="Onboarding code expiry date exeeded.")

    if onboardingCodeModel.maxUses is not None:
        if onboardingCodeModel.uses >= onboardingCodeModel.maxUses and onboardingCodeModel.maxUses != 0:
            return render_template('restricted.html', error="Onboarding code has been used too many times")

    form = RegisterForm()
    if form.validate_on_submit():
        # Get the username and password from the form
        username = form.username.data.lower()
        password = form.password.data
        callsign = form.callsign.data
        firstname = form.firstname.data
        lastname = form.lastname.data
        email = form.email.data
        onboardedby = None
        expiryDate = None

        if (UserModel.query.filter_by(username=username).first() is not None):
            return render_template('register.html', error="Username already exists.", form=form)
        
        if (UserModel.query.filter_by(email=email).first() is not None):
            return render_template('register.html', error="Email already exists.", form=form)

        if (UserModel.query.filter_by(callsign=callsign).first() is not None):
            return render_template('register.html', error="Callsign already exists.", form=form)


        otsClient.create_user(username, password)

        if onboardingCodeModel.onboardContact is not None:
            onboardedby = onboardingCodeModel.onboardContact

        if onboardingCodeModel.userExpiryDate is not None:
            expiryDate = onboardingCodeModel.userExpiryDate


        user = UserModel.create_user(username=username, callsign=callsign, firstname=firstname, lastname=lastname, email=email, onboardedby=onboardedby, roles=onboardingCodeModel.roles, expirydate=expiryDate)

        if onboardingCodeModel.uses is None:
            onboardingCodeModel.uses = 1
        else:
            onboardingCodeModel.uses += 1
            
        onboardingCodeModel.update_onboarding_code(onboardingCodeModel)

        if MAIL_ENABLED:
            if onboardingCodeModel.onboardContact is not None and user.email is not None and user.callsign is not None:    
                onboardContact = UserModel.get_user_by_id(onboardingCodeModel.onboardContact)
                send_html_email(subject="A new Registration",title="New Registration using your link.",message=f"Using your Signup Link a new registration has been made by callsign: {user.callsign} with email {user.email} if this is not who you expect please let us know.",recipients=[onboardContact.email])
                

    
        # Redirect to the home page if authentication is successful
        return redirect(url_for('routes.login'))

    # Render the login page template for GET requests
    return render_template('register.html', form=form, url=f"/register/{onboardingCode}")




@routes.route('/downloadtakpackage/<id>', methods=['GET', 'POST'])
def downloadTakPackage(id):

    takProfile = TakProfileModel.get_tak_profile_by_id(id)
    userProfile = UserModel.get_user_by_username(session['username'])

    if takProfile is None:
        return render_template('restricted.html', error="Invalid TAK Profile")
    
    folder = takProfile.takTemplateFolderLocation
    temp_folder = tempfile.mkdtemp()

    try: 
        shutil.copytree(folder, temp_folder, dirs_exist_ok=True)
    except Exception as e:
        return render_template('restricted.html', error=f"TEMP File Error: {e}")

    if takProfile.takPrefFileLocation:
        config_file_location = takProfile.takPrefFileLocation[takProfile.takPrefFileLocation.index('/') + 1:]
    else:
        config_file_location = None
    

    if takProfile.takTemplateFolderLocation is not None and os.path.exists(f"{temp_folder}/{config_file_location}") and userProfile.callsign is not None:

        # Open the XML file
        tree = ET.parse(f"{temp_folder}/{config_file_location}")
        root = tree.getroot()

        # Find the 'locationCallsign' entry and update its value
        for entry in root.findall("./preference/entry"):
            if entry.get("key") == "locationCallsign":
                entry.text = userProfile.callsign

        location_callsign_entry = root.find("./preference/entry[@key='locationCallsign']")
        if location_callsign_entry is None:
            new_entry = ET.SubElement(root.find("./preference"), "entry")
            new_entry.set("key", "locationCallsign")
            new_entry.text = userProfile.callsign


        # Save the modified XML file
        tree.write(f"{temp_folder}/{config_file_location}")


    if os.path.exists(temp_folder):
        memory_file = io.BytesIO()
        with zipfile.ZipFile(memory_file, 'w') as zf:
            for root, dirs, files in os.walk(temp_folder):
                for file in files:
                    zf.write(os.path.join(root, file), os.path.relpath(os.path.join(root, file), os.path.join(temp_folder, '..')))

        memory_file.seek(0)
        return send_file(memory_file, as_attachment=True, download_name=f"{takProfile.name}.zip")
    else:
        return render_template('restricted.html', error="TAK Profile folder does not exist")

@register_breadcrumb(routes, '.Profile', 'Edit Profile')
@routes.route('/editprofile', methods=['GET', 'POST'])
@login_required
def user_profile_edit():  
    user = UserModel.get_user_by_username(session['username'])
    form = UserProfileEditForm(data=user.__dict__)

    if user is None:
        return redirect(url_for('routes.home'))

    if form.validate_on_submit():
        user.callsign = form.callsign.data
        user.firstName = form.firstName.data
        user.lastName = form.lastName.data
        user.email = form.email.data
        UserModel.update_user(user)

        return redirect(url_for('routes.home'))
    
    return render_template('form.html', user=user, form=form, title="Edit Profile", formurl=url_for('routes.user_profile_edit'))

@routes.route('/static/css/branding.css')  
def branding_view(): 
     
    branding={
        'primary_color': PRIMARY_COLOR,
        'secondary_color': SECONDARY_COLOR,
        'accent_color': ACCENT_COLOR,
        'navbar_color':'#ffffff',
        'breadcrumb_color':"#e9ecef",
        'font_family' : "'Source Sans Pro', 'sans-serif'",
        'logo_url' : LOGO_PATH,
        'logo_height': '50px',
        'logo_width':'50px'
        }

    resp = make_response(render_template('branding.css', branding=branding))
    resp.headers['Content-Type'] = 'text/css'
    return resp




@register_breadcrumb(routes, '.ChangePassword', 'Change Password')
@routes.route('/changepassword', methods=['GET', 'POST'])
@login_required
def change_password():  
    
    user = UserModel.get_user_by_username(session['username'])
    form = ResetPasswordForm()
    
    if user is None:
        return redirect(url_for('routes.home'))

    if form.validate_on_submit():
        otsClient.reset_user_password(user.username, form.password.data)

        return redirect(url_for('routes.home'))
    
    return render_template('password_change.html', user=user, form=form)


@register_breadcrumb(routes, '.Forgot Password', 'Forgot Password')
@routes.route('/forgotpassword', methods=['GET', 'POST'])
def forgot_password():  


    if not MAIL_ENABLED:
        return render_template('restricted.html', error="Mail is disabled.")
    
    if not FORGOT_PASSWORD_ENABLED:
        return render_template('restricted.html', error="Forgot Password is disabled.")
    
    form = ResetPasswordRequestForm()
    if session.get('username'):
        return redirect(url_for('routes.home'))

    if form.validate_on_submit():
        user = UserModel.query.filter_by(email=form.email.data).first()
        current_host = request.host_url
        if user:
            expires = datetime.timedelta(minutes=15)
            reset_token = create_access_token(str(user.id), expires_delta=expires, additional_claims={"reset_password": True, "email": user.email, "username": user.username})

            send_html_email(subject="Password Reset", link_title="Reset Password", link_url=f"{current_host}/resetpassword/{reset_token}", title="Password Reset", message="Click the link to reset your password, This link is only valid for 15 minutes and does allow multiple resets in that time window.", recipients=[user.email])

            return render_template('forgot_password.html', message="If your email is found in the system we will send you a password reset.", form=form)
        
        return render_template('forgot_password.html', message="If your email is found in the system we will send you a password reset.", form=form)
    
    return render_template('forgot_password.html', form=form)

@register_breadcrumb(routes, '.Reset Password', 'Reset Password')
@routes.route('/resetpassword/<token>', methods=['GET', 'POST'])
def reset_password(token):  

    decoded_token = decode_token(token)
    form = ResetPasswordForm()
    reset_password = decoded_token.get("reset_password")
    email = decoded_token.get("email")

    if FORGOT_PASSWORD_ENABLED is False or MAIL_ENABLED is False:
        return render_template('restricted.html', error="Forgot Password or Mail is disabled.")
    
    if not reset_password:
        return render_template('restricted.html', error="Invalid Token")
    
    user = UserModel.query.filter_by(email=email).first()

    if user is None:
        return render_template('restricted.html', error="User not found")
    
    if form.validate_on_submit():
        print(form.password.data)

        otsClient.reset_user_password(user.username, form.password.data)

        return redirect(url_for('routes.home'))

    return render_template('password_reset.html', form=form, token=token)


@routes.route('/updates/<filename>', methods=['GET', 'POST'])
def downloadUpdatePackage(filename):

    if not ENABLE_REPO:
        return render_template('restricted.html', error="Update Package is disabled.")

    filepath = f"{UPDATES_UPLOAD_FOLDER}/{filename}"
    
    if os.path.exists(filepath):
        print(f"Sending file: {filepath}")
        return send_file(f"../{filepath}", as_attachment=True, download_name=filename)

    
    return render_template('restricted.html', error="Update Package does not exist")



@routes.route('/radios/<radiomac>', methods=['GET', 'POST'])
@login_required
def claimRadio(radiomac):

    if not ENABLE_CLAIM_RADIO:
        return render_template('restricted.html', error="Claim Radio is disabled in the settings.")
    
    user = UserModel.get_user_by_username(session['username'])
    if user is None:
        return render_template('restricted.html', error="User not found.")
    
    if request.args.get('adopt') == 'true':
        radio = RadioModel.query.filter_by(mac=radiomac).first()
        if radio is None:
            return render_template('restricted.html', error="Radio not found.")


        if radio.assignedTo is not None:
            return render_template('restricted.html', error="Radio is already claimed.")

        radio.assignedTo = user.id
        db.session.commit()

        return redirect(url_for('routes.home'))



    return render_template('restricted.html', error="Please provide a valid radio Mac and adopt status.")
