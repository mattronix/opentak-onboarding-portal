#!/bin/bash
# Debug script to check production API URL configuration

echo "=== Production API URL Debug ==="
echo ""

# Check what the frontend bundle has
echo "1. Checking frontend bundle for API URL..."
ssh root@tak.kggdutchies.nl << 'EOF'
cd /root/services/opentak-onboarding-portal

echo "Checking for .env files:"
find . -name ".env" -not -path "./node_modules/*" 2>/dev/null

echo ""
echo "Checking frontend build for localhost references:"
if [ -d "frontend/dist" ]; then
  grep -r "localhost:5000" frontend/dist/ 2>/dev/null | head -3 || echo "No localhost:5000 found in frontend/dist"
else
  echo "frontend/dist does not exist - frontend not built"
fi

echo ""
echo "Current git commit:"
git rev-parse --short HEAD

echo ""
echo "Docker container status:"
docker compose ps

echo ""
echo "Recent container logs (last 20 lines):"
docker compose logs --tail=20 web
EOF
