# Installer 

The script will install Docker and clone the OpenTAK Onboarding Portal repository if it does not exist. It will then build the Docker containers and run the database migrations. 


```
apt-get install sudo -y
curl -s https://raw.githubusercontent.com/mattronix/opentak-onboarding-portal/refs/heads/main/installer.sh | sudo bash

```