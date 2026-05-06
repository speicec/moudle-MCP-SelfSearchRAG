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
      if (event.message) {
        useTimelineStore.getState().addGlobalLog({
          timestamp: event.timestamp,
          message: event.message,
          type: 'info',
        });
      }
    } else if (event.type === 'stage:start' && event.stage) {
      useTimelineStore.getState().handleStageStart(event.stage, event.timestamp, event.message);
    } else if (event.type === 'stage:progress' && event.stage) {
      useTimelineStore.getState().handleStageProgress(event.stage, event.progress ?? 0, event.message);
    } else if (event.type === 'stage:complete' && event.stage) {
      useTimelineStore.getState().handleStageComplete(event.stage, event.timestamp, event.message);
    } else if (event.type === 'stage:metrics' && event.stage && event.metrics) {
      useTimelineStore.getState().handleStageMetrics(event.stage, event.metrics);
    } else if (event.type === 'pipeline:complete') {
      useTimelineStore.getState().handlePipelineComplete(event.timestamp);
      if (event.message) {
        useTimelineStore.getState().addGlobalLog({
          timestamp: event.timestamp,
          message: event.message,
          type: 'info',
        });
      }
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

    // Handle Agent visualization events
    if (event.type === 'agent:input' && event.query) {
      useRetrievalStore.getState().handleAgentInput(event.query, event.timestamp);
    } else if (event.type === 'agent:entities' && event.entityMatches) {
      useRetrievalStore.getState().handleAgentEntities(event.entityMatches, event.keywordMatches);
    } else if (event.type === 'agent:complexity' && event.complexity) {
      useRetrievalStore.getState().handleAgentComplexity(event.complexity);
    } else if (event.type === 'agent:mode') {
      useRetrievalStore.getState().handleAgentMode(
        event.executionMode ?? 'react',
        event.executionReason ?? '',
        event.matchedTemplate
      );
    } else if (event.type === 'agent:query_rewrite' && event.queryRewriting) {
      useRetrievalStore.getState().handleAgentQueryRewriting(event.queryRewriting);
    } else if (event.type === 'agent:template' && event.templateAttempts) {
      useRetrievalStore.getState().handleAgentTemplate(event.templateAttempts, event.matchedTemplate);
    } else if (event.type === 'agent:dag' && event.dag) {
      useRetrievalStore.getState().handleAgentDAG(event.dag);
    } else if (event.type === 'agent:execution' && event.executorState) {
      useRetrievalStore.getState().handleAgentExecution(event.executorState);
    } else if (event.type === 'agent:complete' && event.agentResult) {
      useRetrievalStore.getState().handleAgentComplete(event.agentResult);
    }

    // Handle evidence evaluation events (new)
    if (event.type === 'evidence:evaluated' && event.evidenceEvaluation) {
      // Update retrieval results with evidence data
      const results = useRetrievalStore.getState().results;
      const updatedResults = results.map((result, index) => {
        const evidence = event.evidenceEvaluation?.find(e => e.chunkIndex === index);
        if (evidence) {
          return { ...result, evidenceEvaluation: evidence };
        }
        return result;
      });
      useRetrievalStore.getState().handleRetrievalComplete(updatedResults, useRetrievalStore.getState().duration ?? 0, event.timestamp);
      useChatStore.getState().setCurrentSources(updatedResults);
    }

    // Handle evaluation:complete events (RAGAS evaluation results)
    if (event.type === 'evaluation:complete' && event.dimensionScores && event.layerScores) {
      console.log(`[EventHandler] Received evaluation:complete, overallScore: ${event.overallScore}`);

      // Update risk distribution incrementally
      const currentMetrics = useStatsStore.getState().evaluationMetrics;
      const newRiskDistribution = {
        ...currentMetrics.riskDistribution,
        total: currentMetrics.riskDistribution.total + 1,
      };

      // Increment the appropriate risk level count
      if (event.riskLevel) {
        newRiskDistribution[event.riskLevel] = currentMetrics.riskDistribution[event.riskLevel] + 1;
      }

      // Call handleEvaluationUpdate with new metrics
      useStatsStore.getState().handleEvaluationUpdate({
        avgOverall: event.overallScore ?? 0,
        dimensionScores: event.dimensionScores,
        layerScores: event.layerScores,
        riskDistribution: newRiskDistribution,
        totalEvaluations: currentMetrics.totalEvaluations + 1,
        lastEvaluationTime: event.timestamp,
      });
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