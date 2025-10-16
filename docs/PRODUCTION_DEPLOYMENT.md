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

```bash
# Stop the current container
docker compose down

# Rebuild with version information from git
./docker-build.sh

# Start the container
docker compose up -d
```

Alternatively, build manually with version args:
```bash
GIT_COMMIT=$(git rev-parse --short=12 HEAD)
GIT_DATE=$(git log -1 --format=%cd --date=short)

docker compose build --build-arg GIT_COMMIT="${GIT_COMMIT}" --build-arg GIT_DATE="${GIT_DATE}"
docker compose up -d
```

The `--build` flag ensures Docker rebuilds the image, which includes:
- Rebuilding the frontend with `npm run build`
- Installing any new dependencies
- Applying database migrations

### 6. Verify Deployment

Check that the container is running:

```bash
docker compose ps
```

Check the logs for any errors:

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

```bash
cd /path/to/opentak-onboarding-portal && \
git pull origin main && \
docker compose down && \
docker compose up --build -d && \
docker compose logs -f web
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

### Frontend Not Updating

**Symptom:** Changes to frontend components (like Meshtastic edit buttons) don't appear.

**Cause:** Docker container not rebuilt, or browser cache.

**Solution:**
1. Rebuild Docker container: `docker compose up --build -d`
2. Clear browser cache or hard refresh: `Ctrl+Shift+R` / `Cmd+Shift+R`
3. Check browser DevTools → Network tab → Disable cache checkbox

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

## Current Production Issues Fixed

These issues were fixed in the latest deployment:

1. ✅ **Registrations card missing** - Now visible in admin dashboard
2. ✅ **Meshtastic edit buttons missing** - Fixed with frontend rebuild
3. ✅ **Search box refreshing** - Now debounced (500ms delay)
4. ✅ **SQLAlchemy warnings** - Relationship overlap fixed
5. ✅ **JWT error messages** - Now user-friendly
6. ✅ **Legacy views removed** - Cleaned up unused code

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
