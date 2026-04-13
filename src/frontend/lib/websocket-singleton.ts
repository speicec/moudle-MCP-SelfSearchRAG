/**
 * WebSocket singleton manager - ensures only ONE connection exists globally
 * Uses window object to persist across HMR and React StrictMode re-renders
 */

import type { PipelineEvent } from '../store';

const WS_URL = `ws://${window.location.host}/ws`;
const RECONNECT_DELAY_BASE = 1000;
const MAX_RECONNECT_DELAY = 30000;

// Global key for window object
const WS_SINGLETON_KEY = '__RAG_WS_SINGLETON__';

/**
 * Global WebSocket singleton stored in window object
 */
class WebSocketSingleton {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private isConnecting = false;
  private eventHandler: ((event: PipelineEvent) => void) | null = null;
  private statusHandler: ((status: 'connected' | 'disconnected' | 'reconnecting') => void) | null = null;
  private messageCounter = 0;
  private recentMessages: Map<string, number> = new Map();

  constructor() {
    console.log('[WS Singleton] Instance created');
  }

  /**
   * Set event handler (called once from hook)
   */
  setEventHandler(handler: (event: PipelineEvent) => void): void {
    console.log('[WS Singleton] Handler registered');
    this.eventHandler = handler;
  }

  /**
   * Set status handler (called once from hook)
   */
  setStatusHandler(handler: (status: 'connected' | 'disconnected' | 'reconnecting') => void): void {
    this.statusHandler = handler;
  }

  /**
   * Connect to WebSocket server
   */
  connect(): void {
    // Prevent multiple connections
    if (this.ws) {
      const state = this.ws.readyState;
      if (state === WebSocket.OPEN || state === WebSocket.CONNECTING) {
        console.log(`[WS Singleton] Already in state ${state}, skipping connect`);
        return;
      }
    }

    if (this.isConnecting) {
      console.log('[WS Singleton] Connection already in progress, skipping');
      return;
    }

    this.isConnecting = true;
    console.log('[WS Singleton] Creating new WebSocket connection...');

    try {
      this.ws = new WebSocket(WS_URL);

      this.ws.onopen = () => {
        console.log('[WS Singleton] Connected');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.statusHandler?.('connected');
      };

      this.ws.onmessage = (event) => {
        try {
          const message: PipelineEvent = JSON.parse(event.data);
          this.messageCounter++;

          // Debug: Check for duplicate messages (generation events with same content)
          if (message.type.startsWith('generation:') && message.thinkingContent) {
            const contentKey = `${message.type}:${message.thinkingContent.slice(0, 50)}`;
            const lastSeen = this.recentMessages.get(contentKey);
            if (lastSeen && lastSeen > this.messageCounter - 10) {
              console.warn(`[WS Singleton] DUPLICATE MESSAGE! Count: ${this.messageCounter}, Content: "${message.thinkingContent.slice(0, 30)}..."`);
            }
            this.recentMessages.set(contentKey, this.messageCounter);
            // Clean up old entries
            if (this.recentMessages.size > 100) {
              const entries = Array.from(this.recentMessages.entries());
              this.recentMessages = new Map(entries.slice(-50));
            }
          }

          // Debug: Log all generation events
          if (message.type.startsWith('generation:')) {
            console.log(`[WS Singleton] Message #${this.messageCounter}: ${message.type}, thinking: "${message.thinkingContent?.slice(0, 30)}..."`);
          }

          this.eventHandler?.(message);
        } catch (error) {
          console.error('[WS Singleton] Failed to parse message:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('[WS Singleton] Disconnected');
        this.isConnecting = false;
        this.ws = null;
        this.statusHandler?.('disconnected');

        // Reconnect with exponential backoff
        const delay = Math.min(
          RECONNECT_DELAY_BASE * Math.pow(2, this.reconnectAttempts),
          MAX_RECONNECT_DELAY
        );
        this.reconnectAttempts++;

        console.log(`[WS Singleton] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
        this.statusHandler?.('reconnecting');

        this.reconnectTimeout = setTimeout(() => {
          this.connect();
        }, delay);
      };

      this.ws.onerror = (error) => {
        console.error('[WS Singleton] Error:', error);
        this.isConnecting = false;
      };
    } catch (error) {
      console.error('[WS Singleton] Failed to create WebSocket:', error);
      this.isConnecting = false;
      this.statusHandler?.('disconnected');
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    console.log('[WS Singleton] Disconnect requested');
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnecting = false;
    this.statusHandler?.('disconnected');
  }

  /**
   * Send message to server
   */
  send(message: object): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

// Use window object to store singleton (survives HMR and module reloads)
function getWebSocketSingleton(): WebSocketSingleton {
  // Check if singleton already exists in window
  const existing = (window as unknown as Record<string, unknown>)[WS_SINGLETON_KEY];
  if (existing && existing instanceof WebSocketSingleton) {
    console.log('[WS Singleton] Returning existing instance from window');
    return existing;
  }

  // Create new instance and store in window
  console.log('[WS Singleton] Creating new instance and storing in window');
  const instance = new WebSocketSingleton();
  (window as unknown as Record<string, unknown>)[WS_SINGLETON_KEY] = instance;
  return instance;
}

// Export singleton getter
export { getWebSocketSingleton };