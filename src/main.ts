#!/usr/bin/env node

import { createApp } from './app.js';

async function main() {
  console.error('Starting Enhanced RAG MCP Server...');

  try {
    const app = await createApp();
    await app.start();
    console.error('MCP Server started successfully');
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();