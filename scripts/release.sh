#!/bin/bash

set -e

VERSION=${1:-}
REGISTRY="ghcr.io"
IMAGE_NAME="${REGISTRY}/${GITHUB_REPOSITORY:-miotify/miotify}"

if [ -z "$VERSION" ]; then
    VERSION=$(date +%Y%m%d-%H%M%S)
    echo "No version specified, using timestamp: $VERSION"
fi

echo "=== Building Miotify Docker Image ==="
echo "Version: $VERSION"
echo "Image: $IMAGE_NAME:$VERSION"
echo ""

docker buildx build \
    --platform linux/amd64,linux/arm64 \
    --tag "$IMAGE_NAME:$VERSION" \
    --tag "$IMAGE_NAME:latest" \
    --push \
    .

echo ""
echo "=== Build Complete ==="
echo "Image pushed to:"
echo "  - $IMAGE_NAME:$VERSION"
echo "  - $IMAGE_NAME:latest"
