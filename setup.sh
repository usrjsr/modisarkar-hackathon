#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

echo "========================================="
echo "  Setting up Operation Sentinel (Docker) "
echo "========================================="

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "Error: Docker is not installed. Please install Docker and try again."
    exit 1
fi

# Check if Docker Compose is installed
if ! docker compose version &> /dev/null && ! command -v docker-compose &> /dev/null; then
    echo "Error: Docker Compose is not installed. Please install it and try again."
    exit 1
fi

# Check if .env.local exists, if not provide a warning
if [ ! -f .env.local ] && [ ! -f .env ]; then
    echo "Warning: No .env.local or .env file found."
    echo "You might need to create one with necessary environment variables (like MONGODB_URI) before running the app."
fi

echo "Building the Docker development image..."

if docker compose version &> /dev/null; then
    docker compose -f docker-compose.dev.yml build
else
    docker-compose -f docker-compose.dev.yml build
fi

echo "========================================="
echo "  Setup complete!                        "
echo "  You can now start the app by running:  "
echo "  ./web.sh                               "
echo "========================================="
