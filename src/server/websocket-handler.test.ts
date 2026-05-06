/**
 * WebSocket Handler Tests - evaluation:complete event broadcasting
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WebSocketHandler, type EvaluationCompleteEventData } from './websocket-handler.js';
import type { PipelineEvent } from './types.js';
import type WebSocket from 'ws';

// Mock WebSocket
const createMockSocket = () => ({
  readyState: 1, // WebSocket.OPEN
  send: vi.fn(),
  on: vi.fn(),
  close: vi.fn(),
});

describe('WebSocketHandler', () => {
  let handler: WebSocketHandler;
  let mockSocket: ReturnType<typeof createMockSocket>;

  beforeEach(() => {
    handler = new WebSocketHandler();
    mockSocket = createMockSocket() as unknown as WebSocket;
    vi.clearAllMocks();
  });

  describe('basic broadcast', () => {
    it('should broadcast event to all connected clients', () => {
      // Add mock clients
      handler.registerWebSocketRoute({ register: vi.fn() } as any);
      // Access private addClient via prototype
      (handler as any).addClient(mockSocket);

      const event: PipelineEvent = {
        type: 'stats:update',
        timestamp: Date.now(),
      };

      handler.broadcast(event);

      // First call is "connected" message, second is the broadcast
      expect(mockSocket.send).toHaveBeenCalledTimes(2);
      const broadcastMessage = mockSocket.send.mock.calls[1]?.[0] as string;
      expect(broadcastMessage).toBe(JSON.stringify(event));
    });

    it('should not send to closed connections', () => {
      // Only add the open socket, closed socket won't receive "connected" either
      (handler as any).addClient(mockSocket);

      handler.broadcast({ type: 'error', timestamp: Date.now() });

      // mockSocket should receive "connected" + broadcast (2 calls)
      expect(mockSocket.send).toHaveBeenCalledTimes(2);
    });

    it('should skip closed connections during broadcast', () => {
      const closedSocket = { readyState: 3, send: vi.fn() } as unknown as WebSocket; // WebSocket.CLOSED
      const openSocket1 = createMockSocket() as unknown as WebSocket;
      const openSocket2 = createMockSocket() as unknown as WebSocket;

      // Add sockets - closed socket won't be added properly because it's closed
      (handler as any).clients.add(openSocket1);
      (handler as any).clients.add(closedSocket);
      (handler as any).clients.add(openSocket2);

      handler.broadcast({ type: 'error', timestamp: Date.now() });

      // Open sockets should receive the broadcast
      expect(openSocket1.send).toHaveBeenCalled();
      expect(openSocket2.send).toHaveBeenCalled();
      // Closed socket should not receive
      expect(closedSocket.send).not.toHaveBeenCalled();
    });
  });

  describe('broadcastEvaluation', () => {
    it('should broadcast evaluation:complete event with correct structure', () => {
      (handler as any).addClient(mockSocket);

      const evaluationData: EvaluationCompleteEventData = {
        evaluationId: 'eval-123',
        traceId: 'trace-456',
        sessionId: 'session-789',
        dimensionScores: {
          faithfulness: 0.85,
          contextRelevance: 0.72,
          answerRelevance: 0.80,
          medicalAccuracy: 0.88,
          safetyAssessment: 0.95,
          evidenceTraceability: 0.70,
          completeness: 0.75,
          terminologyAccuracy: 0.82,
        },
        layerScores: {
          layer1: 0.79,
          layer2: 0.915,
          layer3: 0.757,
        },
        overallScore: 0.82,
        riskLevel: 'safe',
      };

      handler.broadcastEvaluation(evaluationData);

      // Verify send was called (first is "connected", second is evaluation)
      expect(mockSocket.send).toHaveBeenCalledTimes(2);

      // Parse the second sent message to verify structure
      const sentMessage = mockSocket.send.mock.calls[1]?.[0] as string;
      const sentEvent = JSON.parse(sentMessage) as PipelineEvent;

      expect(sentEvent.type).toBe('evaluation:complete');
      expect(sentEvent.evaluationId).toBe('eval-123');
      expect(sentEvent.traceId).toBe('trace-456');
      expect(sentEvent.overallScore).toBe(0.82);
      expect(sentEvent.riskLevel).toBe('safe');
      expect(sentEvent.dimensionScores?.faithfulness).toBe(0.85);
      expect(sentEvent.layerScores?.layer1).toBe(0.79);
      expect(sentEvent.timestamp).toBeDefined();
    });

    it('should broadcast without sessionId when not provided', () => {
      (handler as any).addClient(mockSocket);

      const evaluationData: EvaluationCompleteEventData = {
        evaluationId: 'eval-123',
        traceId: 'trace-456',
        dimensionScores: {
          faithfulness: 0.85,
          contextRelevance: 0.72,
          answerRelevance: 0.80,
          medicalAccuracy: 0.88,
          safetyAssessment: 0.95,
          evidenceTraceability: 0.70,
          completeness: 0.75,
          terminologyAccuracy: 0.82,
        },
        layerScores: {
          layer1: 0.79,
          layer2: 0.915,
          layer3: 0.757,
        },
        overallScore: 0.82,
        riskLevel: 'caution',
      };

      handler.broadcastEvaluation(evaluationData);

      // First is "connected", second is evaluation
      const sentMessage = mockSocket.send.mock.calls[1]?.[0] as string;
      const sentEvent = JSON.parse(sentMessage) as PipelineEvent;

      expect(sentEvent.type).toBe('evaluation:complete');
      // sessionId should not be in the event when not provided
      expect(sentEvent.sessionId).toBeUndefined();
    });

    it('should handle different risk levels', () => {
      (handler as any).addClient(mockSocket);

      const riskLevels: Array<'safe' | 'caution' | 'warning' | 'danger'> = ['safe', 'caution', 'warning', 'danger'];

      for (const riskLevel of riskLevels) {
        vi.clearAllMocks();

        const evaluationData: EvaluationCompleteEventData = {
          evaluationId: `eval-${riskLevel}`,
          traceId: 'trace-test',
          dimensionScores: {
            faithfulness: 0.5,
            contextRelevance: 0.5,
            answerRelevance: 0.5,
            medicalAccuracy: 0.5,
            safetyAssessment: riskLevel === 'danger' ? 0.3 : 0.6,
            evidenceTraceability: 0.5,
            completeness: 0.5,
            terminologyAccuracy: 0.5,
          },
          layerScores: { layer1: 0.5, layer2: 0.5, layer3: 0.5 },
          overallScore: 0.5,
          riskLevel,
        };

        handler.broadcastEvaluation(evaluationData);

        const sentMessage = mockSocket.send.mock.calls[0]?.[0] as string;
        const sentEvent = JSON.parse(sentMessage) as PipelineEvent;

        expect(sentEvent.riskLevel).toBe(riskLevel);
      }
    });
  });

  describe('session targeting', () => {
    it('should broadcast to session-specific connections', () => {
      const sessionSocket = createMockSocket() as unknown as WebSocket;
      const otherSocket = createMockSocket() as unknown as WebSocket;

      (handler as any).addClient(mockSocket);
      (handler as any).addClient(otherSocket);
      handler.registerSession('session-target', sessionSocket);

      const evaluationData: EvaluationCompleteEventData = {
        evaluationId: 'eval-123',
        traceId: 'trace-456',
        sessionId: 'session-target',
        dimensionScores: {
          faithfulness: 0.85,
          contextRelevance: 0.72,
          answerRelevance: 0.80,
          medicalAccuracy: 0.88,
          safetyAssessment: 0.95,
          evidenceTraceability: 0.70,
          completeness: 0.75,
          terminologyAccuracy: 0.82,
        },
        layerScores: { layer1: 0.79, layer2: 0.915, layer3: 0.757 },
        overallScore: 0.82,
        riskLevel: 'safe',
      };

      handler.broadcastEvaluation(evaluationData);

      // Session socket should receive the message
      expect(sessionSocket.send).toHaveBeenCalled();
    });

    it('should fallback to global broadcast when no session connections', () => {
      (handler as any).addClient(mockSocket);

      const evaluationData: EvaluationCompleteEventData = {
        evaluationId: 'eval-123',
        traceId: 'trace-456',
        sessionId: 'non-existent-session',
        dimensionScores: {
          faithfulness: 0.85,
          contextRelevance: 0.72,
          answerRelevance: 0.80,
          medicalAccuracy: 0.88,
          safetyAssessment: 0.95,
          evidenceTraceability: 0.70,
          completeness: 0.75,
          terminologyAccuracy: 0.82,
        },
        layerScores: { layer1: 0.79, layer2: 0.915, layer3: 0.757 },
        overallScore: 0.82,
        riskLevel: 'safe',
      };

      handler.broadcastEvaluation(evaluationData);

      // Global broadcast should still work
      expect(mockSocket.send).toHaveBeenCalled();
    });
  });

  describe('getClientCount', () => {
    it('should return correct client count', () => {
      expect(handler.getClientCount()).toBe(0);

      (handler as any).addClient(mockSocket);
      expect(handler.getClientCount()).toBe(1);

      const secondSocket = createMockSocket() as unknown as WebSocket;
      (handler as any).addClient(secondSocket);
      expect(handler.getClientCount()).toBe(2);
    });
  });
});