import { useEffect, useRef, useCallback } from 'react';
import { useConnectionStore, usePipelineStore, type PipelineEvent } from '../store';

const WS_URL = `ws://${window.location.host}/ws`;
const RECONNECT_DELAY_BASE = 1000;
const MAX_RECONNECT_DELAY = 30000;

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { setStatus } = useConnectionStore();
  const { handleEvent } = usePipelineStore();

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
          handleEvent(message);
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
  }, [setStatus, handleEvent]);

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