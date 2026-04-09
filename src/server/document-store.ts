import type { WebSocketHandler } from './websocket-handler.js';
import type { PipelineEvent } from './types.js';

/**
 * Document store for managing uploaded documents
 */
export class DocumentStore {
  private storagePath: string;
  private wsHandler: WebSocketHandler | undefined;

  constructor(storagePath: string, wsHandler?: WebSocketHandler) {
    this.storagePath = storagePath;
    if (wsHandler !== undefined) {
      this.wsHandler = wsHandler;
    }
  }

  setWebSocketHandler(handler: WebSocketHandler): void {
    this.wsHandler = handler;
  }

  emitEvent(event: PipelineEvent): void {
    if (this.wsHandler) {
      this.wsHandler.broadcast(event);
    }
  }
}