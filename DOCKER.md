# Docker Deployment Guide

## Quick Start

1. **Copy the example files:**
   ```bash
   cp .env.example .env
   cp docker-compose.yml.dist docker-compose.yml
   ```

2. **Edit `.env` file with your configuration:**
   ```bash
   nano .env
   ```

   At minimum, you must set:
   - `SECRET_KEY` - Generate with: `python3 -c "import secrets; print(secrets.token_hex(32))"`
   - `JWT_SECRET_KEY` - Generate with: `python3 -c "import secrets; print(secrets.token_hex(32))"`
   - `OTS_USERNAME` - Your OpenTAK Server admin username
   - `OTS_PASSWORD` - Your OpenTAK Server admin password
   - `OTS_URL` - Your OpenTAK Server URL (e.g., https://tak.example.com)

3. **Build and run:**
   ```bash
   docker compose build
   docker compose up -d
   ```

4. **Check logs:**
   ```bash
   docker compose logs -f
   ```

5. **Access the portal:**
   Open http://localhost:5000 in your browser

## First Time Setup

After starting the container for the first time, you need to initialize the database:

```bash
# Enter the container
docker compose exec web bash

# Run database migrations
flask db upgrade

# Create the administrator role (if it doesn't exist)
python3 -c "
from app import app
from app.models import UserRoleModel, db
with app.app_context():
    if not UserRoleModel.get_role_by_name('administrator'):
        UserRoleModel.create_role('administrator', 'Administrator role')
        print('Administrator role created')
    else:
        print('Administrator role already exists')
"

# Exit container
exit
```

## Configuration Options

See `.env.example` for all available configuration options.

### Important Settings


- **`DEBUG=False`** - Should be False in production
- **`OTS_VERIFY_SSL=True`** - Should be True if your OTS has valid SSL
- **`MAIL_ENABLED=True`** - Enable email for password reset and notifications
- **`FRONTEND_URL`** - Set to your portal's public URL for password reset links

## Data Persistence

The following directories are mounted for persistence:
- `./instance` - SQLite database
- `./datapackages` - TAK data packages

## Troubleshooting

### 404 Error on Login

The portal now runs in API-only mode by default with the React SPA frontend.

### Can't Access OTS

- Check `OTS_URL` is correct
- Check `OTS_USERNAME` and `OTS_PASSWORD` are correct
- If using self-signed SSL, set `OTS_VERIFY_SSL=False`

### Database Errors

Run migrations:
```bash
docker compose exec web flask db upgrade
```

### Check Application Logs

```bash
docker compose logs -f web
```

## Updating

To update to a new version:

```bash
# Pull latest code
git pull

# Rebuild container
docker compose build

# Restart services
docker compose up -d

# Run any new migrations
docker compose exec web flask db upgrade
```

## If the database goes into read only: 

## Fix ownership - the container uses UID 1000 (appuser)
sudo chown -R 1000:1000 instance/


## Production Recommendations

1. **Use a reverse proxy** (nginx, Caddy) with SSL
2. **Set strong SECRET_KEY and JWT_SECRET_KEY**
3. **Set DEBUG=False**
4. **Use PostgreSQL instead of SQLite** for better performance:
   ```
   SQLALCHEMY_DATABASE_URI=postgresql://user:pass@host:5432/dbname
   ```
5. **Enable email** for password reset functionality
6. **Regular backups** of the `./instance` directory
7. **Monitor logs** for errors and security issues
