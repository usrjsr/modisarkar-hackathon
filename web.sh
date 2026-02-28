#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

echo "========================================="
echo "  Starting Operation Sentinel Web App    "
echo "========================================="

echo "Starting Next.js Docker container..."

if docker compose version &> /dev/null; then
    docker compose -f docker-compose.dev.yml up
else
    docker-compose -f docker-compose.dev.yml up
fi
