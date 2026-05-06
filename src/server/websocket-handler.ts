import type { FastifyInstance } from 'fastify';
import type WebSocket from 'ws';
import type { PipelineEvent, WebSocketClientMessage } from './types.js';

/**
 * Evaluation complete event data
 */
export interface EvaluationCompleteEventData {
  evaluationId: string;
  traceId: string;
  sessionId?: string;
  dimensionScores: {
    faithfulness: number;
    contextRelevance: number;
    answerRelevance: number;
    medicalAccuracy: number;
    safetyAssessment: number;
    evidenceTraceability: number;
    completeness: number;
    terminologyAccuracy: number;
  };
  layerScores: {
    layer1: number;
    layer2: number;
    layer3: number;
  };
  overallScore: number;
  riskLevel: 'safe' | 'caution' | 'warning' | 'danger';
}

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
    console.log(`[WS Debug] Client connected. Total clients: ${this.clients.size}`);
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
    console.log(`[WS Debug] Client disconnected. Total clients: ${this.clients.size}`);
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
    // Debug: Log broadcast details for generation events
    if (event.type.startsWith('generation:')) {
      console.log(`[WS Debug] Broadcasting ${event.type} to ${this.clients.size} clients`);
    }

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
   * Broadcast evaluation:complete event
   * Implements evaluation-websocket-push capability
   */
  broadcastEvaluation(data: EvaluationCompleteEventData): void {
    const event: PipelineEvent = {
      type: 'evaluation:complete',
      evaluationId: data.evaluationId,
      traceId: data.traceId,
      dimensionScores: data.dimensionScores,
      layerScores: data.layerScores,
      overallScore: data.overallScore,
      riskLevel: data.riskLevel,
      timestamp: Date.now(),
    };

    // Add sessionId only if provided (avoid undefined assignment with exactOptionalPropertyTypes)
    if (data.sessionId) {
      (event as PipelineEvent & { sessionId: string }).sessionId = data.sessionId;
    }

    // If sessionId is provided, try targeted broadcast first
    if (data.sessionId) {
      this.broadcastToSession(data.sessionId, event);
    } else {
      // Fall back to global broadcast
      this.broadcast(event);
    }

    console.log(`[WS Debug] Broadcasted evaluation:complete to clients, evaluationId: ${data.evaluationId}`);
  }

  /**
   * Broadcast event to a specific session's connections
   * For targeted evaluation result delivery
   */
  private sessionConnections: Map<string, Set<WebSocket>> = new Map();

  registerSession(sessionId: string, socket: WebSocket): void {
    let connections = this.sessionConnections.get(sessionId);
    if (!connections) {
      connections = new Set();
      this.sessionConnections.set(sessionId, connections);
    }
    connections.add(socket);
  }

  unregisterSession(sessionId: string, socket: WebSocket): void {
    const connections = this.sessionConnections.get(sessionId);
    if (connections) {
      connections.delete(socket);
      if (connections.size === 0) {
        this.sessionConnections.delete(sessionId);
      }
    }
  }

  broadcastToSession(sessionId: string, event: PipelineEvent): void {
    const connections = this.sessionConnections.get(sessionId);
    const message = JSON.stringify(event);

    if (connections && connections.size > 0) {
      // Broadcast to session-specific connections
      for (const client of connections) {
        if (client.readyState === 1) { // WebSocket.OPEN
          client.send(message);
        }
      }
      console.log(`[WS Debug] Broadcasted to session ${sessionId}: ${connections.size} clients`);
    } else {
      // No session connections, fall back to global broadcast
      console.log(`[WS Debug] No session connections for ${sessionId}, falling back to global broadcast`);
      this.broadcast(event);
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