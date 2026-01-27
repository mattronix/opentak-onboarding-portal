#!/bin/bash

# Build and push multi-platform Docker image to Docker Hub
# Usage: ./build.sh [tag]

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
IMAGE_NAME="mattronix/atak-onboarding-portal"
PLATFORMS="linux/amd64,linux/arm64"

# Read version from VERSION file
VERSION=$(cat VERSION 2>/dev/null || echo "dev")
TAG="${VERSION}"

# Get version info from git
GIT_COMMIT=$(git rev-parse --short=12 HEAD 2>/dev/null || echo "unknown")
GIT_DATE=$(git log -1 --format=%cd --date=short 2>/dev/null || echo "unknown")

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Building OpenTAK Onboarding Portal${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "Image: ${GREEN}${IMAGE_NAME}${NC}"
echo -e "Version: ${GREEN}${VERSION}${NC}"
echo -e "Tags: ${GREEN}${TAG}, latest${NC}"
echo -e "Platforms: ${GREEN}${PLATFORMS}${NC}"
echo -e "Git Commit: ${GREEN}${GIT_COMMIT}${NC}"
echo -e "Git Date: ${GREEN}${GIT_DATE}${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if buildx is available
if ! docker buildx version &> /dev/null; then
    echo -e "${YELLOW}Warning: docker buildx not found. Falling back to standard build (single platform).${NC}"
    echo -e "${YELLOW}Multi-platform builds require Docker Buildx.${NC}"
    echo ""

    # Standard build (single platform)
    echo -e "${BLUE}Building for current platform...${NC}"
    docker build \
        --build-arg GIT_COMMIT="${GIT_COMMIT}" \
        --build-arg GIT_DATE="${GIT_DATE}" \
        --build-arg APP_VERSION="${VERSION}" \
        -t "${IMAGE_NAME}:${TAG}" \
        -t "${IMAGE_NAME}:latest" \
        .

    echo -e "${BLUE}Pushing to Docker Hub...${NC}"
    docker push "${IMAGE_NAME}:${TAG}"
    docker push "${IMAGE_NAME}:latest"
else
    # Create or use existing buildx builder
    if ! docker buildx inspect multiplatform-builder &> /dev/null; then
        echo -e "${BLUE}Creating buildx builder...${NC}"
        docker buildx create --name multiplatform-builder --use
        docker buildx inspect --bootstrap
    else
        echo -e "${BLUE}Using existing buildx builder...${NC}"
        docker buildx use multiplatform-builder
    fi

    # Multi-platform build and push
    echo -e "${BLUE}Building for ${PLATFORMS}...${NC}"
    docker buildx build \
        --platform "${PLATFORMS}" \
        --build-arg GIT_COMMIT="${GIT_COMMIT}" \
        --build-arg GIT_DATE="${GIT_DATE}" \
        --build-arg APP_VERSION="${VERSION}" \
        -t "${IMAGE_NAME}:${TAG}" \
        -t "${IMAGE_NAME}:latest" \
        --push \
        .
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Build complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "Images pushed: ${GREEN}${IMAGE_NAME}:${TAG}${NC}"
echo -e "              ${GREEN}${IMAGE_NAME}:latest${NC}"
echo ""
echo "To pull and run:"
echo "  docker pull ${IMAGE_NAME}:${TAG}"
echo "  docker compose up -d"
