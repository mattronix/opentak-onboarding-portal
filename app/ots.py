from app.settings import OTS_USERNAME, OTS_PASSWORD, OTS_URL
import requests
from .exceptions import AuthenticationError, AuthorizationError, BadRequestError, CSRFError

class OTSClient:

    _apibase = "/api"
    _login = _apibase + "/login"
    _me =  _apibase + "/me"
    _status = _apibase + "/status"
    _certificates = _apibase + "/certificate"
    _data_packages = _apibase + "/data_packages"
    _data_packages_download = _data_packages + "/download"
    _user = _apibase + "/user"
    _users = _apibase + "/users"
    _user_add = _user + "/add"
    _user_delete = _user + "/delete"
    _eud = _apibase + "/eud"
    _jobs = _apibase + "/scheduler/jobs"
    _points = _apibase + "/point"
    _reset = _apibase + _user + "/password/reset"

    
    def __init__(self, url, username, password):
        self.base_url = url
        self.username = username
        self.password = password
        self.csrf_token = None
        self.session = requests.Session()

    headers = {"Content-Type": "application/json"}
    
    def execute_request(self, method, endpoint, body=None, params=None, response_type="json"):
        try:
            url = self.base_url + endpoint
            self.headers["Referer"] = self.base_url+self._data_packages
            response = self.session.request(method, url, json=body, headers=self.headers, params=params)
            if response_type == "json":    

                try:
                    parsed_body = response.json()
                    return {"response": parsed_body, "status_code": response.status_code }
                except ValueError as e:
                    print(f"Error Parsing Response: {e}")
                    return None
            else:
                return response
            
        except requests.exceptions.RequestException as e:
            print(f"Connection Error: {e}")
            return None
        
    def request_handler(self, method, endpoint, body=None, params=None, response_type="json"):

        if not self.csrf_token:
            self.get_csrf_token()
            self.login()
        response = self.execute_request(method, endpoint, body, params, response_type)

        if response.get('status_code') == 400: 
            raise BadRequestError(response)

        if response.get('status_code') == 401: 
            raise AuthorizationError(response)
        
        if not response.get('status_code') == 200:
            raise Exception(response)

        return response 


    def get_csrf_token(self):
        response = self.execute_request(method="GET", endpoint=self._login)

        if not response.get('status_code') == 200:
            raise CSRFError(response) 

        self.csrf_token = response.get("response").get("response").get("csrf_token")

        if not self.csrf_token:
            raise Exception(f"Error: Could not get CSRF Token from response: {response}")

        self.headers["XSRF-TOKEN"] = self.csrf_token
        self.headers["X-Xsrf-Token"] = self.csrf_token
        return self.csrf_token   

    def login(self):
        body =  {'username': self.username, 'password': self.password, 'csrf_token': self.csrf_token} 

        response = self.execute_request(method="POST", endpoint=self._login, body=body)
        
        if response.get('status_code') == 400: 
            raise AuthenticationError(response)

        if response.get('status_code') == 401: 
            raise AuthorizationError(response)
        
        if not response.get('status_code') == 200:
            raise Exception(response)

        return response
    
    def get_me(self):
        return self.request_handler(method="GET", endpoint=self._me)
    
    def get_status(self):
        return self.request_handler(method="GET", endpoint=self._status)
    
    def get_certificate(self, callsign=None):
        params = {}
        if callsign is not None:
            params["callsign"] = callsign
        return self.request_handler(method="GET", endpoint=self._certificates , params=params)

    def create_certificate(self, username):
        body = {'username': username }
        response = self.request_handler(method="POST", endpoint=self._certificates, body=body)
        return response
    
    def upload_data_packages(self, hash):
        params = {'hash': hash}
        return self.request_handler(method="POST", endpoint=self._data_packages, params=params)
    
    def delete_data_package(self, hash):
        params = {'hash': hash}
        return self.request_handler(method="DELETE", endpoint=self._data_packages, params=params)
    
    def get_data_packages(self, page=None, page_size=None, hash=None, filename=None, creator_uid=None, keywords=None, mime_type=None, size=None, tool=None):
        params = {}
        if page is not None:
            params["page"] = page
        if page_size is not None:
            params["page_size"] = page_size
        if hash is not None:
            params["hash"] = hash
        if filename is not None:
            params["filename"] = filename
        if creator_uid is not None:
            params["creator_uid"] = creator_uid
        if keywords is not None:
            params["keywords"] = keywords
        if mime_type is not None:
            params["mime_type"] = mime_type
        if size is not None:
            params["size"] = size
        if tool is not None:
            params["tool"] = tool

        datapackage = self.request_handler(method="GET", endpoint=self._data_packages, params=params)
        return datapackage 

    def download_data_package(self, hash, download_location="./"):
        params = {'hash': hash}
        response = self.request_handler(method="GET", endpoint=self._data_packages_download, params=params, response_type="file")
        filename = response.headers.get('Content-Disposition').split('=')[1]
        path = download_location + filename
        try:
            with open(path, 'wb') as f:
                f.write(response.content)
            return True
        except Exception as e:
            print(f"Error: {e}")
            return False

    def get_euds(self, page=None, page_size=None):
        params = {}
        if page is not None:
            params["page"] = page
        if page_size is not None:
            params["page_size"] = page_size
        return self.request_handler(method="GET", endpoint=self._eud, params=params)
        
    def get_jobs(self):
        return self.request_handler(method="GET", endpoint=self._jobs)

    def get_points(self, page=None, page_size=None, callsign=None, uid=None):
        params = {}
        if page is not None:
            params["page"] = page
        if page_size is not None:
            params["page_size"] = page_size
        if callsign is not None:
            params["callsign"] = callsign
        if uid is not None:
            params["uid"] = uid
        return self.request_handler(method="GET", endpoint=self._points, params=params)
    
    def get_users(self, page=None, page_size=None, username=None, email=None):
        params = {}
        if page is not None:
            params["page"] = page
        if page_size is not None:
            params["page_size"] = page_size
        if username is not None:
            params["username"] = username
        
        return self.request_handler(method="GET", endpoint=self._users, params=params)

    def create_user(self, username, password, roles = ["user"]):
        body = {'username': username, 'password': password, 'confirm_password': password, 'roles': roles}
        return self.request_handler(method="POST", endpoint=self._user_add, body=body)
    
    def delete_user(self, username):
        body = {'username': username}
        return self.request_handler(method="POST", endpoint=self._user_delete, body=body)
    
    def reset_user_password (self, username, password):
        body = {'username': username, 'new_password': password}
        return self.request_handler(method="POST", endpoint=self._reset, body=body)

otsClient = OTSClient(OTS_URL, OTS_USERNAME, OTS_PASSWORD)