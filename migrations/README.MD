Flask Onboarding Portal for OpenTAK

# Creating Migrations
```
flask db migrate -m "Migration Description."
flask db upgrade
```

# Setup 
copy env.dist to .env and replace with real info. 

# Development Environment
To run this project inside of docker just type:
```
flask run --debug

# Debug Flag will enable auto refresh
```

# Production Docker Compose
To run this project inside of docker just type:
```
docker-compose up -d
```