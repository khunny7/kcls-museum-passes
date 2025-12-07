#!/bin/bash
set -e

echo "=== Azure Startup Script ==="
echo "Node version: $(node --version)"
echo "NPM version: $(npm --version)"
echo "Working directory: $(pwd)"
echo "Directory contents:"
ls -la

# Set Puppeteer cache directory BEFORE any Puppeteer operations
# This must be set early so all Puppeteer operations use the correct path
export PUPPETEER_CACHE_DIR="/home/.cache/puppeteer"
export PUPPETEER_EXECUTABLE_PATH=""
echo "PUPPETEER_CACHE_DIR set to: $PUPPETEER_CACHE_DIR"

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
# IMPORTANT: We need to download the EXACT version Puppeteer expects
echo "Checking for Puppeteer Chrome..."

# Get the Chrome version that this version of Puppeteer expects
EXPECTED_CHROME_VERSION=$(node -e "
  try {
    const pkg = require('puppeteer/package.json');
    const { PUPPETEER_REVISIONS } = require('puppeteer-core/lib/cjs/puppeteer/revisions.js');
    console.log(PUPPETEER_REVISIONS?.chrome || '');
  } catch(e) {
    // Fallback: try to extract from error message or use a known version
    console.log('');
  }
" 2>/dev/null || echo "")

echo "Expected Chrome version from Puppeteer: $EXPECTED_CHROME_VERSION"

# Check if Chrome is already available
CHROME_PATH=$(node -e "
  process.env.PUPPETEER_CACHE_DIR = '/home/.cache/puppeteer';
  const puppeteer = require('puppeteer');
  try {
    console.log(puppeteer.executablePath());
  } catch(e) {
    console.log('');
  }
" 2>/dev/null || echo "")

echo "Current Chrome path check result: $CHROME_PATH"

if [ -z "$CHROME_PATH" ] || [ ! -f "$CHROME_PATH" ]; then
  echo "Puppeteer Chrome not found, downloading..."
  
  # Create cache directory
  mkdir -p "$PUPPETEER_CACHE_DIR"
  
  # Use npx puppeteer browsers install which downloads the correct version
  # that matches the installed puppeteer package
  echo "Running: npx puppeteer browsers install chrome"
  npx puppeteer browsers install chrome
  
  echo "Chrome download complete"
  
  # Verify the download
  CHROME_PATH=$(node -e "
    process.env.PUPPETEER_CACHE_DIR = '/home/.cache/puppeteer';
    const puppeteer = require('puppeteer');
    try {
      console.log(puppeteer.executablePath());
    } catch(e) {
      console.log('');
    }
  " 2>/dev/null || echo "")
  
  if [ -n "$CHROME_PATH" ] && [ -f "$CHROME_PATH" ]; then
    echo "Chrome successfully installed at: $CHROME_PATH"
  else
    echo "WARNING: Chrome installation may have failed. Checking cache directory..."
    ls -la "$PUPPETEER_CACHE_DIR" || echo "Cache directory empty or not accessible"
    find "$PUPPETEER_CACHE_DIR" -name "chrome" -o -name "chrome-*" 2>/dev/null || echo "No chrome found in cache"
  fi
else
  echo "Puppeteer Chrome already available at: $CHROME_PATH"
fi

# Export the Chrome path for the Node.js process
if [ -n "$CHROME_PATH" ] && [ -f "$CHROME_PATH" ]; then
  export PUPPETEER_EXECUTABLE_PATH="$CHROME_PATH"
  echo "PUPPETEER_EXECUTABLE_PATH set to: $PUPPETEER_EXECUTABLE_PATH"
fi

echo "API directory contents:"
ls -la

cd ../..

# Verify environment variables are set
echo "=== Environment Summary ==="
echo "PUPPETEER_CACHE_DIR: $PUPPETEER_CACHE_DIR"
echo "PUPPETEER_EXECUTABLE_PATH: $PUPPETEER_EXECUTABLE_PATH"

# Start the API server
echo "Starting API server from $(pwd)..."
cd apps/api
echo "Current directory: $(pwd)"
echo "About to execute: node dist/index.js"
exec node dist/index.js
