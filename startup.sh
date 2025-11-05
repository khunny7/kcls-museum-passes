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
  echo "Root node_modules already exists"
fi

# Install API dependencies
echo "Checking API dependencies..."
cd apps/api
if [ ! -d "node_modules" ]; then
  echo "Installing API dependencies..."
  npm ci --omit=dev
  echo "API dependencies installed successfully"
else
  echo "API node_modules already exists"
fi

echo "API directory contents:"
ls -la

cd ../..

# Set Puppeteer to use system Chromium if available
export PUPPETEER_EXECUTABLE_PATH="/usr/bin/chromium-browser"

# Start the API server
echo "Starting API server from $(pwd)..."
cd apps/api
echo "Current directory: $(pwd)"
echo "About to execute: node dist/index.js"
exec node dist/index.js
