from flask import render_template, Blueprint, request, make_response, session
from app.ots import otsClient, OTSClient
from flask import redirect, url_for
from app.settings import OTS_URL, OTS_USERNAME, OTS_PASSWORD
from app.decorators import login_required
from app.forms import LoginForm, RegisterForm
from app.models import UserModel, UserRoleModel, OnboardingCodeModel, db

routes = Blueprint('routes', __name__)

# Create a dictionary to store the active telnet connections
otsClient = OTSClient(OTS_URL, OTS_USERNAME, OTS_PASSWORD)



@routes.route('/')
@login_required
def home():  
    user = UserModel.get_user_by_username(session['username'])
    return render_template('index.html', user=user)


@routes.route('/logout')
def logout():
    # Remove the OTS session from the session variable
    session.pop('ots_profile', None)
    session.pop('username', None)
    return redirect(url_for('routes.login'))

@routes.route('/login', methods=['GET', 'POST'])
def login():
    form = LoginForm()
    if form.validate_on_submit():
        # Get the username and password from the form
        username = form.username.data
        password = form.password.data
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



@routes.route('/register/<onboardingCode>', methods=['GET', 'POST'])
def register(onboardingCode):

    
   # OnboardingCodeModel.create_onboarding_code(onboardingcode=123456, onboardcontact=1)
    onboardingCodeModel = OnboardingCodeModel.query.filter_by(onboardingCode=onboardingCode).first()

    if onboardingCodeModel is None:
        return render_template('restricted.html', error="Invalid onboarding code")

    if onboardingCodeModel.maxUses is not None:
        if onboardingCodeModel.uses == onboardingCodeModel.maxUses:
            return render_template('restricted.html', error="Onboarding code has been used too many times")

    form = RegisterForm()
    if form.validate_on_submit():
        # Get the username and password from the form
        username = form.username.data
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
        
            
        except Exception as e:
            return render_template('register.html', error=f"Error: {e}", form=form, url=f"/register/{onboardingCode}")


        # Redirect to the home page if authentication is successful
        return redirect(url_for('routes.login'))

    # Render the login page template for GET requests
    return render_template('register.html', form=form, url=f"/register/{onboardingCode}")


@routes.route('/static/css/branding.css')  
def branding_view(): 
     
    branding={
        'primary_color':'#000000',
        'secondary_color':'orange',
        'accent_color':'#ffffff',
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
