import { useEffect, useRef, useCallback } from 'react';
import { useConnectionStore, usePipelineStore, useTimelineStore, useChunkStore, useStatsStore, useRetrievalStore, type PipelineEvent } from '../store';

const WS_URL = `ws://${window.location.host}/ws`;
const RECONNECT_DELAY_BASE = 1000;
const MAX_RECONNECT_DELAY = 30000;

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { setStatus } = useConnectionStore();
  const { handleEvent } = usePipelineStore();
  const timelineStore = useTimelineStore();
  const chunkStore = useChunkStore();
  const statsStore = useStatsStore();
  const retrievalStore = useRetrievalStore();

  /**
   * Handle all WebSocket events including new event types
   */
  const handleAllEvents = useCallback((event: PipelineEvent) => {
    // Handle legacy pipeline events
    handleEvent(event);

    // Handle new timeline events
    if (event.type === 'pipeline:start' && event.documentId) {
      timelineStore.handlePipelineStart(event.documentId, event.timestamp);
    } else if (event.type === 'stage:start' && event.stage) {
      timelineStore.handleStageStart(event.stage, event.timestamp);
    } else if (event.type === 'stage:progress' && event.stage) {
      timelineStore.handleStageProgress(event.stage, event.progress ?? 0);
    } else if (event.type === 'stage:complete' && event.stage) {
      timelineStore.handleStageComplete(event.stage, event.timestamp);
    } else if (event.type === 'stage:metrics' && event.stage && event.metrics) {
      timelineStore.handleStageMetrics(event.stage, event.metrics);
    } else if (event.type === 'pipeline:complete') {
      timelineStore.handlePipelineComplete(event.timestamp);
    } else if (event.type === 'error' && event.stage && event.error) {
      timelineStore.handleError(event.stage, event.error.message);
    }

    // Handle chunk creation events
    if (event.type === 'chunk:created' && event.chunk && event.documentId) {
      chunkStore.handleChunkCreated(event.chunk, event.documentId);
    }

    // Handle stats update events
    if (event.type === 'stats:update' && event.stats) {
      statsStore.handleStatsUpdate(event.stats);
    }

    // Handle retrieval events
    if (event.type === 'retrieval:start' && event.query) {
      retrievalStore.handleRetrievalStart(event.query, event.timestamp);
    } else if (event.type === 'retrieval:match' && event.query && event.match) {
      retrievalStore.handleRetrievalMatch(event.match);
    } else if (event.type === 'retrieval:complete' && event.query && event.results && event.duration) {
      retrievalStore.handleRetrievalComplete(event.results, event.duration, event.timestamp);
    }
  }, [handleEvent, timelineStore, chunkStore, statsStore, retrievalStore]);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
        setStatus('connected');
        reconnectAttemptsRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const message: PipelineEvent = JSON.parse(event.data);
          handleAllEvents(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setStatus('disconnected');
        wsRef.current = null;

        // Attempt reconnection with exponential backoff
        const delay = Math.min(
          RECONNECT_DELAY_BASE * Math.pow(2, reconnectAttemptsRef.current),
          MAX_RECONNECT_DELAY
        );
        reconnectAttemptsRef.current++;

        console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})`);
        setStatus('reconnecting');

        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      setStatus('disconnected');
    }
  }, [setStatus, handleAllEvents]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setStatus('disconnected');
  }, [setStatus]);

  const subscribe = useCallback((documentId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'subscribe', documentId }));
    }
  }, []);

  const unsubscribe = useCallback((documentId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'unsubscribe', documentId }));
    }
  }, []);

  return { connect, disconnect, subscribe, unsubscribe };
}

// Auto-connect hook
export function useWebSocketConnection() {
  const { connect, disconnect } = useWebSocket();

  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);
}