import { useEffect, useCallback, useRef } from 'react';
import { useConnectionStore, usePipelineStore, useTimelineStore, useChunkStore, useStatsStore, useRetrievalStore, useChatStore, type PipelineEvent } from '../store';
import { getWebSocketSingleton } from '../lib/websocket-singleton';

/**
 * Create a stable event handler that uses getState() to avoid store object dependencies
 * This function is defined outside hooks to ensure stability
 */
function createEventHandler() {
  return (event: PipelineEvent) => {
    // Debug: Log generation events
    if (event.type.startsWith('generation:')) {
      console.log(`[EventHandler] Received: ${event.type}, thinkingContent: "${event.thinkingContent?.slice(0, 30)}..."`);
    }

    // Handle legacy pipeline events using getState()
    usePipelineStore.getState().handleEvent(event);

    // Handle timeline events
    if (event.type === 'pipeline:start' && event.documentId) {
      useTimelineStore.getState().handlePipelineStart(event.documentId, event.timestamp);
    } else if (event.type === 'stage:start' && event.stage) {
      useTimelineStore.getState().handleStageStart(event.stage, event.timestamp);
    } else if (event.type === 'stage:progress' && event.stage) {
      useTimelineStore.getState().handleStageProgress(event.stage, event.progress ?? 0);
    } else if (event.type === 'stage:complete' && event.stage) {
      useTimelineStore.getState().handleStageComplete(event.stage, event.timestamp);
    } else if (event.type === 'stage:metrics' && event.stage && event.metrics) {
      useTimelineStore.getState().handleStageMetrics(event.stage, event.metrics);
    } else if (event.type === 'pipeline:complete') {
      useTimelineStore.getState().handlePipelineComplete(event.timestamp);
    } else if (event.type === 'error' && event.stage && event.error) {
      useTimelineStore.getState().handleError(event.stage, event.error.message);
    }

    // Handle chunk creation events
    if (event.type === 'chunk:created' && event.chunk && event.documentId) {
      useChunkStore.getState().handleChunkCreated(event.chunk, event.documentId);
    }

    // Handle stats update events
    if (event.type === 'stats:update' && event.stats) {
      useStatsStore.getState().handleStatsUpdate(event.stats);
    }

    // Handle retrieval events
    if (event.type === 'retrieval:start' && event.query) {
      useRetrievalStore.getState().handleRetrievalStart(event.query, event.timestamp);
    } else if (event.type === 'retrieval:match' && event.query && event.match) {
      useRetrievalStore.getState().handleRetrievalMatch(event.match);
    } else if (event.type === 'retrieval:complete' && event.query && event.results && event.duration) {
      useRetrievalStore.getState().handleRetrievalComplete(event.results, event.duration, event.timestamp);
      useChatStore.getState().setCurrentSources(event.results);
    }

    // Handle generation events
    if (event.type === 'generation:start' && event.query) {
      useChatStore.getState().handleGenerationStart(event.query, event.sourcesCount ?? 0);
    } else if (event.type === 'generation:thinking' && event.thinkingContent) {
      useChatStore.getState().handleGenerationThinking(event.thinkingContent);
    } else if (event.type === 'generation:answer' && event.answerContent) {
      useChatStore.getState().handleGenerationAnswer(event.answerContent);
    } else if (event.type === 'generation:complete') {
      console.log('[EventHandler] generation:complete received');
      useChatStore.getState().handleGenerationComplete(
        event.thinkingTokens ?? 0,
        event.answerTokens ?? 0,
        event.totalDuration ?? 0
      );
    } else if (event.type === 'generation:error' && event.error) {
      useChatStore.getState().handleGenerationError(event.error.message);
    }
  };
}

// Global stable handler - created once and reused
let globalEventHandler: ((event: PipelineEvent) => void) | null = null;

/**
 * Hook to access WebSocket singleton and register event handlers
 */
export function useWebSocket() {
  const connect = useCallback(() => {
    const wsSingleton = getWebSocketSingleton();
    wsSingleton.connect();
  }, []);

  const disconnect = useCallback(() => {
    const wsSingleton = getWebSocketSingleton();
    wsSingleton.disconnect();
  }, []);

  const subscribe = useCallback((documentId: string) => {
    const wsSingleton = getWebSocketSingleton();
    wsSingleton.send({ type: 'subscribe', documentId });
  }, []);

  const unsubscribe = useCallback((documentId: string) => {
    const wsSingleton = getWebSocketSingleton();
    wsSingleton.send({ type: 'unsubscribe', documentId });
  }, []);

  return { connect, disconnect, subscribe, unsubscribe };
}

// Auto-connect hook - registers handlers ONCE and connects
export function useWebSocketConnection() {
  const { connect } = useWebSocket();

  // Use ref to track registration status (survives StrictMode re-renders)
  const registeredRef = useRef(false);

  useEffect(() => {
    const wsSingleton = getWebSocketSingleton();

    // Register handlers ONCE only
    if (!registeredRef.current) {
      // Create stable handler once
      if (!globalEventHandler) {
        globalEventHandler = createEventHandler();
      }

      wsSingleton.setEventHandler(globalEventHandler);
      wsSingleton.setStatusHandler(useConnectionStore.getState().setStatus);
      registeredRef.current = true;
      console.log('[useWebSocketConnection] Handlers registered (once)');
    }

    // Connect (singleton will check if already connected)
    connect();

    return () => {
      // Don't disconnect or clear handlers - singleton persists
      console.log('[useWebSocketConnection] Cleanup - singleton persists');
    };
  }, [connect]); // Minimal dependency
}