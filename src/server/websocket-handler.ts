import type { FastifyInstance } from 'fastify';
import type WebSocket from 'ws';
import type { PipelineEvent, WebSocketClientMessage } from './types.js';

/**
 * WebSocket handler for pipeline event broadcasting
 */
export class WebSocketHandler {
  private clients: Set<WebSocket> = new Set();
  private documentSubscriptions: Map<string, Set<WebSocket>> = new Map();

  /**
   * Register WebSocket route on Fastify instance
   */
  registerWebSocketRoute(fastify: FastifyInstance): void {
    fastify.register(async (instance) => {
      instance.get('/ws', { websocket: true }, (connection: WebSocket /* , req */) => {
        const socket = connection;
        this.addClient(socket);

        socket.on('message', (data: Buffer) => {
          try {
            const message: WebSocketClientMessage = JSON.parse(data.toString());
            this.handleClientMessage(socket, message);
          } catch {
            socket.send(JSON.stringify({
              type: 'error',
              message: 'Invalid message format',
              timestamp: Date.now(),
            }));
          }
        });

        socket.on('close', () => {
          this.removeClient(socket);
        });

        socket.on('error', (err: Error) => {
          console.error('WebSocket error:', err);
          this.removeClient(socket);
        });
      });
    });
  }

  /**
   * Add client to broadcast list
   */
  private addClient(socket: WebSocket): void {
    this.clients.add(socket);
    socket.send(JSON.stringify({
      type: 'connected',
      message: 'Connected to pipeline event stream',
      timestamp: Date.now(),
    }));
  }

  /**
   * Remove client from broadcast list
   */
  private removeClient(socket: WebSocket): void {
    this.clients.delete(socket);
    // Remove from all document subscriptions
    for (const [docId, subscribers] of this.documentSubscriptions) {
      subscribers.delete(socket);
      if (subscribers.size === 0) {
        this.documentSubscriptions.delete(docId);
      }
    }
  }

  /**
   * Handle client message (subscribe/unsubscribe)
   */
  private handleClientMessage(socket: WebSocket, message: WebSocketClientMessage): void {
    if (message.type === 'subscribe' && message.documentId) {
      let subscribers = this.documentSubscriptions.get(message.documentId);
      if (!subscribers) {
        subscribers = new Set();
        this.documentSubscriptions.set(message.documentId, subscribers);
      }
      subscribers.add(socket);
      socket.send(JSON.stringify({
        type: 'subscribed',
        documentId: message.documentId,
        timestamp: Date.now(),
      }));
    } else if (message.type === 'unsubscribe' && message.documentId) {
      const subscribers = this.documentSubscriptions.get(message.documentId);
      if (subscribers) {
        subscribers.delete(socket);
      }
      socket.send(JSON.stringify({
        type: 'unsubscribed',
        documentId: message.documentId,
        timestamp: Date.now(),
      }));
    }
  }

  /**
   * Broadcast event to all connected clients
   */
  broadcast(event: PipelineEvent): void {
    const message = JSON.stringify(event);

    // Broadcast to all clients
    for (const client of this.clients) {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(message);
      }
    }

    // Also broadcast to document-specific subscribers
    if (event.documentId) {
      const subscribers = this.documentSubscriptions.get(event.documentId);
      if (subscribers) {
        for (const subscriber of subscribers) {
          if (subscriber.readyState === 1 && !this.clients.has(subscriber)) {
            subscriber.send(message);
          }
        }
      }
    }
  }

  /**
   * Get number of connected clients
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Get WebSocket handler for global access
   */
  static getGlobalHandler(): WebSocketHandler | undefined {
    return (globalThis as unknown as { wsHandler?: WebSocketHandler }).wsHandler;
  }
}