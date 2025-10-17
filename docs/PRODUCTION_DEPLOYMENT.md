# Production Deployment Guide

## Deploying Updates to portal.kggdutchies.nl

When you make changes to the frontend or backend, you need to rebuild the Docker container on the production server to get the latest code.

## Prerequisites

- SSH access to production server
- Git repository up to date on production server
- Docker and docker-compose installed on production server

## Deployment Steps

### 1. Commit and Push Your Changes

On your local machine:

```bash
# Make sure all changes are committed
git add .
git commit -m "Your commit message describing the changes"
git push origin main
```

### 2. SSH into Production Server

```bash
ssh user@portal.kggdutchies.nl
```

Replace `user` with your actual username on the production server.

### 3. Navigate to Project Directory

```bash
cd /path/to/opentak-onboarding-portal
```

Replace `/path/to/` with the actual path where the project is deployed.

### 4. Pull Latest Changes

```bash
git pull origin main
```

This will pull all the latest code including the updated frontend.

### 5. Rebuild Docker Container

**Option A: Standard Rebuild (Recommended)**

```bash
# Build and restart with version information
./docker-build.sh --no-cache
docker compose up -d
```

**Option B: Force Complete Rebuild (If Standard Fails)**

Use this if the standard rebuild doesn't update properly:

```bash
# Nuclear option - clears all caches and rebuilds from scratch
./docker-rebuild-force.sh
```

**Option C: Manual Rebuild**

```bash
# Export version info
export GIT_COMMIT=$(git rev-parse --short=12 HEAD)
export GIT_DATE=$(git log -1 --format=%cd --date=short)

# Stop container
docker compose down

# Build with no cache
docker compose build --no-cache

# Start container
docker compose up -d
```

The rebuild process:
- Rebuilds the frontend with `npm run build`
- Installs any new dependencies
- Embeds git version information
- Applies database migrations on startup

### 6. Verify Deployment

**Check container is running:**

```bash
docker compose ps
```

**Verify the version was updated:**

```bash
# Check backend version
docker compose exec web cat app/version.py

# Check frontend version
docker compose exec web cat frontend/dist/version.json

# Or check via the web interface at:
# https://portal.kggdutchies.nl (look for version in footer/admin panel)
```

**Check logs for errors:**

```bash
docker compose logs -f web
```

Press `Ctrl+C` to exit the logs.

### 7. Test the Application

Open your browser and visit:
- https://portal.kggdutchies.nl

Test the following:
- [ ] Login works
- [ ] Admin dashboard shows all 7 cards (including Registrations)
- [ ] Meshtastic page has edit buttons and proper styling
- [ ] Pending Registrations page loads
- [ ] Search functionality works (debounced)

## Quick Deployment Command (All in One)

If you're already on the production server:

**Standard quick deploy:**
```bash
cd /path/to/opentak-onboarding-portal && \
git pull origin main && \
./docker-build.sh --no-cache && \
docker compose up -d && \
docker compose logs --tail=50 web
```

**Force rebuild (if updates aren't applying):**
```bash
cd /path/to/opentak-onboarding-portal && \
git pull origin main && \
./docker-rebuild-force.sh
```

## Rollback (If Something Goes Wrong)

If the new deployment has issues:

```bash
# Check out the previous commit
git log --oneline -10  # See last 10 commits
git checkout <previous-commit-hash>

# Rebuild with the old code
docker compose down
docker compose up --build -d
```

## Database Migrations

The Docker container automatically runs migrations on startup. If you need to run them manually:

```bash
docker compose exec web flask db upgrade
```

## Environment Variables

Make sure your production `.env` file has all required variables:

```bash
# Check .env file exists
docker compose exec web cat .env | head -10

# Important variables to check:
# - JWT_SECRET_KEY (should be set to a consistent value, not random)
# - OTS_URL
# - OTS_USERNAME
# - OTS_PASSWORD
# - MAIL_SERVER, MAIL_USERNAME, MAIL_PASSWORD (for email verification)
# - FRONTEND_URL (should be https://portal.kggdutchies.nl)
```

## Troubleshooting

### Frontend/Backend Not Updating

**Symptom:** Changes don't appear even after rebuild, or version stays the same.

**Cause:** Docker caching, image not updating, or browser cache.

**Solution:**

1. **Verify what's actually running:**
   ```bash
   # Check the version inside the container
   docker compose exec web cat app/version.py
   docker compose exec web cat frontend/dist/version.json

   # Compare with git
   git rev-parse --short=12 HEAD
   ```

2. **If versions don't match, force complete rebuild:**
   ```bash
   ./docker-rebuild-force.sh
   ```

3. **If versions match but changes still don't appear:**
   - Clear browser cache: `Ctrl+Shift+R` / `Cmd+Shift+R`
   - Check DevTools → Network tab → Disable cache
   - Try incognito/private browsing window

4. **Nuclear option - complete cleanup:**
   ```bash
   docker compose down -v
   docker system prune -af
   git pull origin main
   ./docker-rebuild-force.sh
   ```

### Database Migration Errors

**Symptom:** Container fails to start with migration errors.

**Solution:**
```bash
# Enter the container
docker compose exec web bash

# Check current migration status
flask db current

# Manually run migrations
flask db upgrade

# Exit container
exit
```

### Container Won't Start

**Symptom:** `docker compose up` fails or container crashes immediately.

**Solution:**
```bash
# Check logs for errors
docker compose logs web

# Common issues:
# - Missing .env file
# - Wrong environment variables
# - Port already in use
# - Database file permissions
```

### JWT Token Errors (401 Unauthorized)

**Symptom:** Users get logged out frequently or get 401 errors.

**Cause:** `JWT_SECRET_KEY` is randomly generated on each restart.

**Solution:**
1. Add to production `.env`: `JWT_SECRET_KEY="your-secure-random-key"`
2. Generate a secure key: `python3 -c "import secrets; print(secrets.token_hex(32))"`
3. Rebuild container
4. All users need to log out and log back in

## Version Information System

The application now embeds git version information during build:

- **Backend**: Version stored in `app/version.py`
- **Frontend**: Version stored in `frontend/dist/version.json`
- **How it works**:
  - `docker-build.sh` extracts git commit hash and date
  - Passes them as build args to Docker
  - Both frontend and backend embed this info during build
  - Displayed in the web interface for easy verification

**Checking version:**
```bash
# Via container
docker compose exec web cat app/version.py

# Via web interface
# Look for version info in footer or admin panel
```

## Recent Issues Fixed

1. ✅ **Docker caching issues** - Added force rebuild script
2. ✅ **Version not updating** - Fixed docker-compose.yml build args
3. ✅ **Registrations card missing** - Now visible in admin dashboard
4. ✅ **Meshtastic edit buttons missing** - Fixed with frontend rebuild
5. ✅ **Search box refreshing** - Now debounced (500ms delay)
6. ✅ **SQLAlchemy warnings** - Relationship overlap fixed
7. ✅ **JWT error messages** - Now user-friendly

## Deployment Checklist

Before deploying to production:

- [ ] All changes committed and pushed to Git
- [ ] Local testing completed successfully
- [ ] Database migrations tested locally
- [ ] `.env` file on production has all required variables
- [ ] Backup of production database (if major changes)
- [ ] Users notified if downtime expected
- [ ] Rollback plan prepared

After deploying:

- [ ] Container started successfully
- [ ] No errors in logs
- [ ] Website loads correctly
- [ ] Login works
- [ ] Admin features tested
- [ ] Email verification tested (if email changes made)
- [ ] Monitor logs for first 10-15 minutes

## Monitoring

Watch the logs in real-time:

```bash
# Follow all logs
docker compose logs -f

# Follow only web service logs
docker compose logs -f web

# Last 100 lines
docker compose logs --tail=100 web
```

## Backup Before Deployment

Always backup the database before major changes:

```bash
# Backup database
docker compose exec web sqlite3 instance/db.sqlite ".backup /tmp/db_backup_$(date +%Y%m%d_%H%M%S).sqlite"

# Copy backup to host
docker cp opentak-onboarding-portal-web-1:/tmp/db_backup_*.sqlite ./backups/
```

## Contact

If deployment issues occur, check:
1. Docker logs: `docker compose logs web`
2. This documentation
3. Session summaries in `docs/SESSION_SUMMARY_*.md`
4. Git commit history: `git log --oneline -20`

---

**Last Updated:** October 17, 2025
**Production URL:** https://portal.kggdutchies.nl
**Project Repository:** (your git repository)
