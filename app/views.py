from flask import render_template, Blueprint, request, make_response
from app.ots import otsClient, OTSClient
from flask import redirect, url_for
from app.settings import OTS_URL


routes = Blueprint('routes', __name__)

# Create a dictionary to store the active telnet connections
#otsClient = OTSClient(OTS_URL, OTS_USERNAME, OTS_PASSWORD)


@routes.route('/')
def home():  
    print(otsClient.get_me())
    return render_template('index.html')

@routes.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        # Get the username and password from the form
        username = request.form.get('username')
        password = request.form.get('password')

        # Perform authentication logic here
        # ...
        try:
            otsSession = OTSClient(OTS_URL, username, password)
            print(otsSession.get_me())

        except Exception as e:
            print(f"Error: {e}")
            return render_template('login.html', error="Invalid username or password")


        # Redirect to the home page if authentication is successful
        return redirect(url_for('routes.home'))

    # Render the login page template for GET requests
    return render_template('login.html')

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
