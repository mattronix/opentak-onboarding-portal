from flask import render_template, Blueprint, request, make_response, session
from app.ots import otsClient, OTSClient
from flask import redirect, url_for
from app.settings import OTS_URL
from app.decorators import login_required
from app.forms import LoginForm
from app.models import UserModel, UserRoleModel, db

routes = Blueprint('routes', __name__)

# Create a dictionary to store the active telnet connections
#otsClient = OTSClient(OTS_URL, OTS_USERNAME, OTS_PASSWORD)



@routes.route('/')
@login_required
def home():  
    user = session.get('ots_profile')

    return render_template('index.html', user=user)


@routes.route('/logout')
def logout():
    # Remove the OTS session from the session variable
    session.pop('ots_profile', None)
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
            session['ots_profile'] = otsSession.get_me()

            # Check if the user exists in the database
            user = UserModel.query.filter_by(username=username).first()
            if user is None:
                UserModel.create_user(username)
            
        except Exception as e:
            print(f"Error: {e}")
            return render_template('login.html', error="Invalid username or password", form=form)


        # Redirect to the home page if authentication is successful
        return redirect(url_for('routes.home'))

    # Render the login page template for GET requests
    return render_template('login.html', form=form)

@routes.route('/static/css/branding.css')  
def branding_view(): 
     
    branding={
        'primary_color':'#000000',
        'secondary_color':'#000000',
        'accent_color':'#ffffff',
        'navbar_color':'#ffffff',
        'breadcrumb_color':"#e9ecef",
        'font_family' : "'Source Sans Pro', 'sans-serif'",
        'logo_url' : 'https://techinc.nl/images/techinclogo_0.png',
        'logo_height': '50px',
        'logo_width':'50px'
        }

    resp = make_response(render_template('branding.css', branding=branding))
    resp.headers['Content-Type'] = 'text/css'
    return resp
