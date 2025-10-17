#!/bin/bash
set -e

echo "Starting OpenTAK Onboarding Portal..."

# Run database migrations
echo "Running database migrations..."
flask db upgrade || echo "Warning: Migration failed or already up to date"

# Start the application with gunicorn
echo "Starting gunicorn..."
exec gunicorn -w 1 -t 50 app:app -b 0.0.0.0:5000
