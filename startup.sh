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

# Install API dependencies and let Puppeteer download Chrome if needed
echo "Checking API dependencies..."
cd apps/api
if [ ! -d "node_modules" ]; then
  echo "Installing API dependencies (including Puppeteer Chrome)..."
  npm ci --omit=dev
  echo "API dependencies installed successfully"
else
  echo "API node_modules already exists (bundled in deployment - skipping install)"
fi

# Check if Puppeteer's Chrome is available, if not download it
echo "Ensuring Puppeteer Chrome is available..."
if [ ! -d "node_modules/puppeteer/.local-chromium" ] && [ ! -d "node_modules/puppeteer/.local-chrome" ]; then
  echo "Downloading Puppeteer's Chrome browser..."
  npx puppeteer browsers install chrome || echo "Chrome download completed with warnings"
fi

echo "API directory contents:"
ls -la

cd ../..

# Don't set PUPPETEER_EXECUTABLE_PATH - let Puppeteer use its bundled Chrome
echo "Puppeteer will use bundled Chrome (not system Chromium)"

# Start the API server
echo "Starting API server from $(pwd)..."
cd apps/api
echo "Current directory: $(pwd)"
echo "About to execute: node dist/index.js"
exec node dist/index.js
