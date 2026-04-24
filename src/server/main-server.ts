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

// DOM polyfill for pdfjs-dist (Node.js environment)
// pdfjs-dist requires DOMMatrix, ImageData, Path2D which are browser APIs
import { createCanvas } from '@napi-rs/canvas';

// Polyfill DOMMatrix using canvas
if (typeof globalThis.DOMMatrix === 'undefined') {
  const canvas = createCanvas(1, 1);
  const ctx = canvas.getContext('2d');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).DOMMatrix = ctx.getTransform().constructor;
}

// Polyfill ImageData (simple implementation)
if (typeof globalThis.ImageData === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).ImageData = class ImageData {
    data: Uint8ClampedArray;
    width: number;
    height: number;
    constructor(widthOrData: number | Uint8ClampedArray, heightOrWidth?: number) {
      if (typeof widthOrData === 'number') {
        this.width = widthOrData;
        this.height = heightOrWidth ?? widthOrData;
        this.data = new Uint8ClampedArray(this.width * this.height * 4);
      } else {
        this.data = widthOrData;
        this.width = heightOrWidth ?? Math.sqrt(widthOrData.length / 4);
        this.height = Math.ceil(widthOrData.length / (this.width * 4));
      }
    }
  };
}

// Polyfill Path2D
if (typeof globalThis.Path2D === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).Path2D = class Path2D {
    private _ops: string[] = [];
    addPath() {}
    moveTo() {}
    lineTo() {}
    closePath() {}
    arc() {}
    arcTo() {}
    ellipse() {}
    bezierCurveTo() {}
    quadraticCurveTo() {}
    rect() {}
    roundRect() {}
  };
}

// Load environment variables from .env file
import 'dotenv/config';

// Global error handlers to prevent process crash
process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
  console.error('[Server] Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit - log and continue
});

process.on('uncaughtException', (error: Error) => {
  console.error('[Server] Uncaught Exception:', error);
  // Don't exit immediately - log and allow graceful handling
});

import { startHttpServer } from '../server/http-server.js';

// Parse command line arguments and environment variables
const args = process.argv.slice(2);
const portArg = args.find(a => a.startsWith('--port='));
const hostArg = args.find(a => a.startsWith('--host='));

const port = portArg ? parseInt(portArg.split('=')[1] ?? '3001', 10) : parseInt(process.env.PORT ?? '3001', 10);
const host = hostArg?.split('=')[1] ?? process.env.HOST ?? 'localhost';

console.log('Starting RAG HTTP+WebSocket server...');
console.log(`Port: ${port}`);
console.log(`Host: ${host}`);

startHttpServer({
  port,
  host,
  documentStoragePath: './data/documents',
});