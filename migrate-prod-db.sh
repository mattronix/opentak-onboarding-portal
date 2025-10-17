#!/bin/bash
echo "=== Migrating Production Database ==="
ssh root@tak.kggdutchies.nl << 'EOF'
cd /root/services/opentak-onboarding-portal

echo "1. Backing up database..."
cp instance/db.sqlite instance/db.sqlite.backup.$(date +%Y%m%d_%H%M%S)

echo "2. Running database migration..."
docker compose exec -T web flask db upgrade

echo "3. Checking migration status..."
docker compose exec -T web flask db current

echo "4. Restarting container..."
docker compose restart web

echo "5. Checking logs for any errors..."
sleep 3
docker compose logs --tail=30 web

echo ""
echo "Migration complete! Try logging in now."
EOF
