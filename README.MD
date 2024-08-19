Flask Onboarding Portal for OpenTAK
# What is this project?

This project is an Opensource ATAK Portal that works with OpenTak Server to provide a self service onboarding experiance for end users.

# Features 
* Temporary access and cleanup of temporary accounts
* Registration by secure link withn max uses and email notification to link owner 
* Meshtastic QR Code (WIP)
* Data package automatic Config of call sign (beta)

# Setup
git clone
copy env.dist to .env and replace with real info. 
```
cp env.dist .env
docker compose build
docker compose exec web flask db upgrade
docker compose -d 
```

# upgrade
```
git pull
docker compose build
docker compose exec web flask db upgrade
docker compose -d 
```

# DEV 

## Creating Migrations
```
flask db migrate -m "Migration Description."
```
## Executing Migrations
```
flask db upgrade
```

## Development Environment
To run this project inside of docker just type:
```
flask run --debug

# Debug Flag will enable auto refresh
```