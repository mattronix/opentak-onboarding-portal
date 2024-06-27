Flask Onboarding Portal for OpenTAK

# Creating Migrations
```
flask db migrate -m "Migration Description."
```
# Executing Migrations
```
flask db upgrade
```
# Setup 
copy env.dist to .env and replace with real info. 
```
cp env.dist .env
flask db upgrade
docker-compose -d 
```

# Development Environment
To run this project inside of docker just type:
```
flask run --debug

# Debug Flag will enable auto refresh
```