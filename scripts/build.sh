#!/bin/bash

# Production build script
# Builds backend (TypeScript) and frontend (Vite)

echo "Building for production..."

# Clean previous build
rm -rf dist

# Build backend with TypeScript
echo "Building backend..."
npm run build:fast

# Build frontend with Vite
echo "Building frontend..."
npm run build:frontend

echo "Build complete!"
echo "Run 'node dist/server/main-server.js' to start the server"