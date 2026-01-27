# Installer 

The script will install Docker and clone the OpenTAK Onboarding Portal repository if it does not exist. It will then build the Docker containers and run the database migrations. 

## Debian 

```
apt-get install sudo curl -y
curl -s https://raw.githubusercontent.com/mattronix/opentak-onboarding-portal/refs/heads/main/scripts/installers/debian-installer.sh | sudo bash

```

## Ubuntu 

```
apt-get install sudo curl -y
curl -s https://raw.githubusercontent.com/mattronix/opentak-onboarding-portal/refs/heads/main/scripts/installers/ubuntu-installer.sh | sudo bash

```

## Config 
This section is needed to be done in order to get the portal to load. 

in the env make sure to change OTS_URL in most cases set it to https://host.docker.internal Make sure to set OTS_USERNAME and OTS_PASSWORD to an account with admin access inside of OTS.
```
cd /opt/opentak-onboarding-portal
docker compose exec web flask db upgrade
nano .env
docker compose up -d
```

## Error?

```
docker compose logs -f
```