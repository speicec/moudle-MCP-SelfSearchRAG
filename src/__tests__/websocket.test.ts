import { describe, it, expect, beforeEach } from 'vitest';
import { WebSocketHandler } from '../server/websocket-handler.js';
import type { PipelineEvent } from '../server/types.js';

describe('WebSocketHandler', () => {
  let handler: WebSocketHandler;

  beforeEach(() => {
    handler = new WebSocketHandler();
  });

  describe('getClientCount', () => {
    it('should return 0 initially', () => {
      expect(handler.getClientCount()).toBe(0);
    });
  });

  describe('broadcast', () => {
    it('should not throw when no clients connected', () => {
      const event: PipelineEvent = {
        type: 'pipeline:start',
        timestamp: Date.now(),
      };

      expect(() => handler.broadcast(event)).not.toThrow();
    });
  });

  describe('getGlobalHandler', () => {
    it('should return undefined when not set', () => {
      expect(WebSocketHandler.getGlobalHandler()).toBeUndefined();
    });
  });
});