# Installer 

The script will install Docker and clone the OpenTAK Onboarding Portal repository if it does not exist. It will then build the Docker containers and run the database migrations. 

## Debian 

```
apt-get install sudo curl -y
curl -s https://raw.githubusercontent.com/mattronix/opentak-onboarding-portal/refs/heads/main/debian-installer.sh | sudo bash

```

## Ubuntu 

```
apt-get install sudo curl -y
curl -s https://raw.githubusercontent.com/mattronix/opentak-onboarding-portal/refs/heads/main/ubuntu-installer.sh | sudo bash

```

## Config 
This section is needed to be done in order to get the portal to load. 

```
cd /opt/opentak-onboarding-portal
docker compose exec web flask db upgrade
cp env.dist env
nano env
docker compose restart
```

## Error?

```
docker compose logs -f
```