#!/bin/bash
# Force complete rebuild - removes all caches and old images

set -e

echo "=========================================="
echo "FORCE REBUILD - Production Deployment"
echo "=========================================="
echo ""

# Get git commit hash (short 12 chars)
GIT_COMMIT=$(git rev-parse --short=12 HEAD 2>/dev/null || echo "dev")
GIT_DATE=$(git log -1 --format=%cd --date=short 2>/dev/null || date -u +%Y-%m-%d)

echo "Target version:"
echo "  Commit: ${GIT_COMMIT}"
echo "  Date:   ${GIT_DATE}"
echo ""

# Step 1: Stop and remove containers
echo "[1/6] Stopping and removing containers..."
docker compose down --remove-orphans

# Step 2: Remove the specific image
echo "[2/6] Removing old images..."
docker rmi opentak-onboarding-portal-web 2>/dev/null || echo "  (no old image to remove)"
docker images | grep opentak-onboarding-portal | awk '{print $3}' | xargs -r docker rmi -f 2>/dev/null || echo "  (no related images found)"

# Step 3: Prune build cache
echo "[3/6] Pruning Docker build cache..."
docker builder prune -af

# Step 4: Clean up dangling images
echo "[4/6] Removing dangling images..."
docker image prune -f

# Step 5: Build fresh
echo "[5/6] Building fresh image (no cache)..."
docker compose build --no-cache \
  --build-arg GIT_COMMIT="${GIT_COMMIT}" \
  --build-arg GIT_DATE="${GIT_DATE}" \
  --progress=plain

# Step 6: Start container
echo "[6/6] Starting container..."
docker compose up -d

echo ""
echo "=========================================="
echo "✓ FORCE REBUILD COMPLETE"
echo "=========================================="
echo ""
echo "Verify version:"
echo "  docker compose exec web cat app/version.py"
echo "  docker compose exec web cat frontend/dist/version.json"
echo ""
echo "Check logs:"
echo "  docker compose logs -f web"
echo ""
