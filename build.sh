#!/usr/bin/env bash
set -euo pipefail

IMAGE_NAME="${1:-rhacs-mcp}"

podman build --squash-all -t "${IMAGE_NAME}" -f Containerfile .

echo "Built image: ${IMAGE_NAME}"
echo "Run with: podman run -i --rm -e ROX_ENDPOINT -e ROX_API_TOKEN ${IMAGE_NAME}"
