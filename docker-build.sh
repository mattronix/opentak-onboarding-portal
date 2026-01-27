#!/bin/bash
# Script to build Docker image with version information from git

set -e

# Check for --no-cache flag
NO_CACHE=""
if [ "$1" == "--no-cache" ]; then
  NO_CACHE="--no-cache"
  echo "Building with --no-cache flag (clean build)"
  echo ""
fi

# Get git commit hash (short 12 chars)
GIT_COMMIT=$(git rev-parse --short=12 HEAD 2>/dev/null || echo "dev")

# Get git commit date
GIT_DATE=$(git log -1 --format=%cd --date=short 2>/dev/null || date -u +%Y-%m-%d)

# Read version from VERSION file
APP_VERSION=$(cat VERSION 2>/dev/null || echo "dev")

echo "Building Docker image with version:"
echo "  Version: ${APP_VERSION}"
echo "  Commit:  ${GIT_COMMIT}"
echo "  Date:    ${GIT_DATE}"
echo ""

# Build with docker compose
docker compose build ${NO_CACHE} \
  --build-arg GIT_COMMIT="${GIT_COMMIT}" \
  --build-arg GIT_DATE="${GIT_DATE}" \
  --build-arg APP_VERSION="${APP_VERSION}"

echo ""
echo "✓ Docker image built successfully with version ${APP_VERSION} (${GIT_COMMIT})"
echo ""
echo "To start the container:"
echo "  docker compose up -d"
