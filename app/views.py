from flask import render_template, Blueprint, make_response, session
from app.ots import otsClient, OTSClient
from flask import redirect, url_for
from app.settings import OTS_URL, OTS_USERNAME, OTS_PASSWORD, MAIL_ENABLED
from app.decorators import login_required
from app.forms import LoginForm, RegisterForm
from app.models import UserModel, UserRoleModel, OnboardingCodeModel, TakProfileModel, db
from flask_breadcrumbs import register_breadcrumb, default_breadcrumb_root
from app.email import send_html_email
from flask import send_file
import io
import zipfile
import os
import tempfile
import shutil
import xml.etree.ElementTree as ET

routes = Blueprint('routes', __name__, url_prefix='/')
default_breadcrumb_root(routes, '.',)

# Create a dictionary to store the active telnet connections
otsClient = OTSClient(OTS_URL, OTS_USERNAME, OTS_PASSWORD)


@register_breadcrumb(routes, '.', 'Home')
@routes.route('/')
@login_required
def home():  
    user = UserModel.get_user_by_username(session['username'])

    tak_profiles = TakProfileModel.query.filter_by(isPublic=True)

    return render_template('index.html', user=user, tak_profiles=tak_profiles)

    
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


        if (UserModel.query.filter_by(username=username).first() is not None):
            return render_template('register.html', error="Username already exists.", form=form)
        
        if (UserModel.query.filter_by(email=email).first() is not None):
            return render_template('register.html', error="Email already exists.", form=form)

        if (UserModel.query.filter_by(callsign=callsign).first() is not None):
            return render_template('register.html', error="Callsign already exists.", form=form)

        try:
            otsClient.create_user(username, password)

            if onboardingCodeModel.onboardContact is not None:
                onboardedby = onboardingCodeModel.onboardContact
            else:
                onboardedby = None

            user = UserModel.create_user(username=username, callsign=callsign, firstname=firstname, lastname=lastname, email=email, onboardedby=onboardedby)

            if onboardingCodeModel.uses is None:
                onboardingCodeModel.uses = 1
            else:
                onboardingCodeModel.uses += 1
                
            onboardingCodeModel.update_onboarding_code(onboardingCodeModel)

            if MAIL_ENABLED:
                if onboardingCodeModel.onboardContact is not None and user.email is not None and user.callsign is not None:    
                    onboardContact = UserModel.get_user_by_id(onboardingCodeModel.onboardContact)
                    send_html_email(subject="A new Registration KGG",title="New Registration using your link.",message=f"Using your Signup Link a new registration has been made by callsign: {user.callsign} with email {user.email} if this is not who you expect please let us know.",recipients=[onboardContact.email])
                    
        except Exception as e:
            return render_template('register.html', error=f"Error: {e}", form=form, url=f"/register/{onboardingCode}")

    
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
    print(temp_folder)

    try: 
        shutil.copytree(folder, temp_folder, dirs_exist_ok=True)
    except Exception as e:
        return render_template('restricted.html', error=f"TEMP File Error: {e}")

    if takProfile.takPrefFileLocation is not None:
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
            else:
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


@routes.route('/static/css/branding.css')  
def branding_view(): 
     
    branding={
        'primary_color':'#000000',
        'secondary_color':'orange',
        'accent_color':'orange',
        'navbar_color':'#ffffff',
        'breadcrumb_color':"#e9ecef",
        'font_family' : "'Source Sans Pro', 'sans-serif'",
        'logo_url' : '/static/img/logo.png',
        'logo_height': '50px',
        'logo_width':'50px'
        }

    resp = make_response(render_template('branding.css', branding=branding))
    resp.headers['Content-Type'] = 'text/css'
    return resp



