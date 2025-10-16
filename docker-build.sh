#!/bin/bash
# Script to build Docker image with version information from git

set -e

# Get git commit hash (short 12 chars)
GIT_COMMIT=$(git rev-parse --short=12 HEAD 2>/dev/null || echo "dev")

# Get git commit date
GIT_DATE=$(git log -1 --format=%cd --date=short 2>/dev/null || date -u +%Y-%m-%d)

echo "Building Docker image with version:"
echo "  Commit: ${GIT_COMMIT}"
echo "  Date:   ${GIT_DATE}"
echo ""

# Build with docker compose
docker compose build \
  --build-arg GIT_COMMIT="${GIT_COMMIT}" \
  --build-arg GIT_DATE="${GIT_DATE}"

echo ""
echo "✓ Docker image built successfully with version ${GIT_COMMIT}"
echo ""
echo "To start the container:"
echo "  docker compose up -d"
