#!/bin/bash
set -e

echo "=== Azure Startup Script ==="
echo "Node version: $(node --version)"
echo "NPM version: $(npm --version)"
echo "Working directory: $(pwd)"

# Install root dependencies (if not already installed)
if [ ! -d "node_modules" ]; then
  echo "Installing root dependencies..."
  npm ci --omit=dev
fi

# Install API dependencies
echo "Installing API dependencies..."
cd apps/api
if [ ! -d "node_modules" ]; then
  npm ci --omit=dev
fi

cd ../..

# Set Puppeteer to use system Chromium if available
export PUPPETEER_EXECUTABLE_PATH="/usr/bin/chromium-browser"

# Start the API server
echo "Starting API server..."
cd apps/api
exec node dist/index.js
