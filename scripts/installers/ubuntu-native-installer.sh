#!/bin/bash

set -e

INSTALL_DIR="/opt/opentak-onboarding-portal"
SERVICE_USER="opentak-portal"

echo "============================================"
echo "OpenTAK Onboarding Portal - Native Installer"
echo "============================================"

# Update package database
echo "[1/10] Updating package database..."
sudo apt-get update

# Install prerequisites
echo "[2/10] Installing prerequisites..."
sudo apt-get install -y \
    apt-transport-https \
    ca-certificates \
    curl \
    software-properties-common \
    git \
    build-essential \
    libffi-dev \
    libssl-dev

# Install Python 3.11+
echo "[3/10] Installing Python..."
if ! command -v python3.11 &> /dev/null; then
    sudo add-apt-repository -y ppa:deadsnakes/ppa
    sudo apt-get update
    sudo apt-get install -y python3.11 python3.11-venv python3.11-dev python3-pip
else
    echo "Python 3.11 is already installed."
fi

# Install Node.js 20
echo "[4/10] Installing Node.js 20..."
if ! command -v node &> /dev/null || [[ $(node -v | cut -d'.' -f1 | tr -d 'v') -lt 20 ]]; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
    sudo apt-get install -y nodejs
else
    echo "Node.js 20+ is already installed."
fi

# Create service user
echo "[5/10] Creating service user..."
if ! id "$SERVICE_USER" &>/dev/null; then
    sudo useradd -r -s /bin/false -d "$INSTALL_DIR" "$SERVICE_USER"
fi

# Clone repository
echo "[6/10] Cloning repository..."
if [ ! -d "$INSTALL_DIR" ]; then
    sudo git clone https://github.com/mattronix/opentak-onboarding-portal.git "$INSTALL_DIR"
else
    echo "Repository already exists, pulling latest..."
    cd "$INSTALL_DIR"
    sudo git pull
fi

cd "$INSTALL_DIR"

# Setup environment file
echo "[7/10] Setting up environment..."
if [ ! -f ".env" ]; then
    sudo cp env.dist .env
    # Generate random secrets
    SECRET_KEY=$(python3.11 -c "import secrets; print(secrets.token_hex(32))")
    JWT_SECRET=$(python3.11 -c "import secrets; print(secrets.token_hex(32))")
    sudo sed -i "s/SECRET_KEY=.*/SECRET_KEY=$SECRET_KEY/" .env
    sudo sed -i "s/JWT_SECRET_KEY=.*/JWT_SECRET_KEY=$JWT_SECRET/" .env
    echo "Generated new secret keys in .env"
fi

# Create Python virtual environment and install dependencies
echo "[8/10] Installing Python dependencies..."
sudo python3.11 -m venv venv
sudo venv/bin/pip install --upgrade pip
sudo venv/bin/pip install -r requirements.txt
sudo venv/bin/pip install gunicorn

# Build frontend
echo "[9/10] Building frontend..."
cd frontend
sudo npm install
sudo npm run build
cd ..

# Initialize database
echo "[10/10] Initializing database..."
sudo venv/bin/flask db upgrade

# Create required directories
sudo mkdir -p instance datapackages updates
sudo chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR"

# Create systemd service
echo "Creating systemd service..."
sudo tee /etc/systemd/system/opentak-portal.service > /dev/null << 'EOF'
[Unit]
Description=OpenTAK Onboarding Portal
After=network.target

[Service]
Type=simple
User=opentak-portal
Group=opentak-portal
WorkingDirectory=/opt/opentak-onboarding-portal
Environment="PATH=/opt/opentak-onboarding-portal/venv/bin"
ExecStart=/opt/opentak-onboarding-portal/venv/bin/gunicorn -w 2 -t 60 app:app -b 0.0.0.0:5000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd and enable service
sudo systemctl daemon-reload
sudo systemctl enable opentak-portal

echo ""
echo "============================================"
echo "Installation Complete!"
echo "============================================"
echo ""
echo "Next steps:"
echo "1. Edit the configuration file:"
echo "   sudo nano $INSTALL_DIR/.env"
echo ""
echo "2. Configure at minimum:"
echo "   - OTS_URL (your OpenTAK Server URL)"
echo "   - OTS_USERNAME (admin username)"
echo "   - OTS_PASSWORD (admin password)"
echo ""
echo "3. Start the service:"
echo "   sudo systemctl start opentak-portal"
echo ""
echo "4. Check status:"
echo "   sudo systemctl status opentak-portal"
echo ""
echo "5. View logs:"
echo "   sudo journalctl -u opentak-portal -f"
echo ""
echo "The portal will be available at: http://YOUR_IP:5000"
echo ""
