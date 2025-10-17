#!/bin/bash
set -e

echo "Starting OpenTAK Onboarding Portal..."

# Run database migrations
echo "Running database migrations..."
if flask db upgrade 2>&1 | grep -q "user_roles_old"; then
    echo "Warning: Migration issue detected with user_roles_old reference"
    echo "Attempting to stamp database and continue..."
    flask db stamp head || echo "Could not stamp database"
else
    echo "Migrations completed successfully"
fi

# Start the application with gunicorn
echo "Starting gunicorn..."
exec gunicorn -w 1 -t 50 app:app -b 0.0.0.0:5000
