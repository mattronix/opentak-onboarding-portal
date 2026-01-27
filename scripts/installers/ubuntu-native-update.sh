#!/bin/bash

set -e

INSTALL_DIR="/opt/opentak-onboarding-portal"

echo "============================================"
echo "OpenTAK Onboarding Portal - Update Script"
echo "============================================"

# Check if installation exists
if [ ! -d "$INSTALL_DIR" ]; then
    echo "Error: Installation not found at $INSTALL_DIR"
    exit 1
fi

cd "$INSTALL_DIR"

# Stop service
echo "[1/6] Stopping service..."
sudo systemctl stop opentak-portal || true

# Pull latest code
echo "[2/6] Pulling latest code..."
sudo git pull

# Update Python dependencies
echo "[3/6] Updating Python dependencies..."
sudo venv/bin/pip install --upgrade pip
sudo venv/bin/pip install -r requirements.txt

# Rebuild frontend
echo "[4/6] Rebuilding frontend..."
cd frontend
sudo npm install
sudo npm run build
cd ..

# Run database migrations
echo "[5/6] Running database migrations..."
sudo venv/bin/flask db upgrade

# Fix ownership
sudo chown -R opentak-portal:opentak-portal "$INSTALL_DIR"

# Restart service
echo "[6/6] Starting service..."
sudo systemctl start opentak-portal

echo ""
echo "============================================"
echo "Update Complete!"
echo "============================================"
echo ""
echo "Check status: sudo systemctl status opentak-portal"
echo "View logs:    sudo journalctl -u opentak-portal -f"
echo ""
