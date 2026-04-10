#!/usr/bin/env node
/**
 * HTTP+WebSocket server entry point
 *
 * Usage: node dist/server/main-server.js
 *
 * Features:
 * - Document management API (upload, list, delete)
 * - Chat query API (Small-to-Big retrieval)
 * - WebSocket real-time pipeline events
 * - Frontend static file serving
 */

// Load environment variables from .env file
import 'dotenv/config';

import { startHttpServer } from '../server/http-server.js';

// Parse command line arguments
const args = process.argv.slice(2);
const portArg = args.find(a => a.startsWith('--port='));
const hostArg = args.find(a => a.startsWith('--host='));

const port = portArg ? parseInt(portArg.split('=')[1] ?? '3001', 10) : 3001;
const host = hostArg?.split('=')[1] ?? 'localhost';

console.log('Starting RAG HTTP+WebSocket server...');
console.log(`Port: ${port}`);
console.log(`Host: ${host}`);

startHttpServer({
  port,
  host,
  documentStoragePath: './data/documents',
});