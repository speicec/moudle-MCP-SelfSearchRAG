#!/bin/bash

# Development server script
# Runs Vite dev server (port 3000) and Fastify backend (port 3001) concurrently

echo "Starting development servers..."
echo "Frontend: http://localhost:3000"
echo "Backend: http://localhost:3001"
echo "WebSocket: ws://localhost:3001/ws"

# Build backend first
npm run build -- --noEmit false 2>/dev/null || npm run build:fast

# Start backend server in background
node dist/server/main-server.js &
BACKEND_PID=$!

# Start Vite dev server
npm run dev:frontend &
FRONTEND_PID=$!

# Cleanup on exit
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT

wait