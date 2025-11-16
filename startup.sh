#!/bin/bash
set -e

echo "=== Azure Startup Script ==="
echo "Node version: $(node --version)"
echo "NPM version: $(npm --version)"
echo "Working directory: $(pwd)"
echo "Directory contents:"
ls -la

# Install root dependencies (if not already installed)
echo "Checking root node_modules..."
if [ ! -d "node_modules" ]; then
  echo "Installing root dependencies..."
  npm ci --omit=dev || echo "Warning: Root dependencies installation had issues"
else
  echo "Root node_modules already exists (bundled in deployment - skipping install)"
fi

# Install API dependencies
echo "Checking API dependencies..."
cd apps/api
if [ ! -d "node_modules" ]; then
  echo "Installing API dependencies..."
  npm ci --omit=dev
  echo "API dependencies installed successfully"
else
  echo "API node_modules already exists (bundled in deployment - skipping install)"
fi

# Download Chrome for Puppeteer (not bundled in deployment to reduce size)
echo "Checking for Puppeteer Chrome..."
CHROME_PATH=$(node -e "const puppeteer = require('puppeteer'); console.log(puppeteer.executablePath());" 2>/dev/null || echo "")

if [ -z "$CHROME_PATH" ] || [ ! -f "$CHROME_PATH" ]; then
  echo "Puppeteer Chrome not found, downloading..."
  # Use @puppeteer/browsers to download Chrome to a persistent location
  npx @puppeteer/browsers install chrome@stable --path /home/.cache/puppeteer
  echo "Chrome download complete"
  # Set the path for Puppeteer to find it
  export PUPPETEER_CACHE_DIR="/home/.cache/puppeteer"
else
  echo "Puppeteer Chrome already available at: $CHROME_PATH"
fi

echo "API directory contents:"
ls -la

cd ../..

# Let Puppeteer use its downloaded Chrome
echo "Puppeteer configured to use downloaded Chrome"

# Start the API server
echo "Starting API server from $(pwd)..."
cd apps/api
echo "Current directory: $(pwd)"
echo "About to execute: node dist/index.js"
exec node dist/index.js
