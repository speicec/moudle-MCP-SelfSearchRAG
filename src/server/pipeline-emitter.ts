import type { PipelineEvent, PipelineStageName, StageMetrics, ChunkCreatedData, RetrievalMatchData, StatsUpdateData, RetrievalResultItem } from './types.js';
import { WebSocketHandler } from './websocket-handler.js';

/**
 * Pipeline event emitter for WebSocket broadcasting
 */
export class PipelineEmitter {
  private wsHandler: WebSocketHandler | undefined;
  private documentId: string;

  constructor(documentId: string, wsHandler?: WebSocketHandler) {
    this.documentId = documentId;
    this.wsHandler = wsHandler ?? WebSocketHandler.getGlobalHandler();
  }

  setWebSocketHandler(handler: WebSocketHandler): void {
    this.wsHandler = handler;
  }

  emit(event: PipelineEvent): void {
    if (this.wsHandler) {
      this.wsHandler.broadcast(event);
    }
  }

  emitPipelineStart(): void {
    this.emit({
      type: 'pipeline:start',
      documentId: this.documentId,
      message: 'Pipeline execution started',
      timestamp: Date.now(),
    });
  }

  emitStageStart(stage: PipelineStageName): void {
    this.emit({
      type: 'stage:start',
      stage,
      documentId: this.documentId,
      message: `Stage ${stage} started`,
      timestamp: Date.now(),
    });
  }

  emitStageProgress(stage: PipelineStageName, progress: number, message?: string): void {
    this.emit({
      type: 'stage:progress',
      stage,
      progress,
      documentId: this.documentId,
      message: message ?? `Stage ${stage} progress: ${progress}%`,
      timestamp: Date.now(),
    });
  }

  emitStageComplete(stage: PipelineStageName, message?: string): void {
    this.emit({
      type: 'stage:complete',
      stage,
      documentId: this.documentId,
      message: message ?? `Stage ${stage} completed`,
      timestamp: Date.now(),
    });
  }

  emitStageMetrics(stage: PipelineStageName, metrics: StageMetrics): void {
    this.emit({
      type: 'stage:metrics',
      stage,
      documentId: this.documentId,
      metrics,
      message: `Stage ${stage} metrics collected`,
      timestamp: Date.now(),
    });
  }

  emitChunkCreated(chunk: ChunkCreatedData, totalChunks: number): void {
    this.emit({
      type: 'chunk:created',
      documentId: this.documentId,
      chunk,
      totalChunks,
      message: `Chunk created: ${chunk.id}`,
      timestamp: Date.now(),
    });
  }

  emitRetrievalStart(query: string): void {
    this.emit({
      type: 'retrieval:start',
      query,
      message: `Retrieval started for query`,
      timestamp: Date.now(),
    });
  }

  emitRetrievalMatch(query: string, match: RetrievalMatchData): void {
    this.emit({
      type: 'retrieval:match',
      query,
      match,
      message: `Match found: rank ${match.rank}`,
      timestamp: Date.now(),
    });
  }

  emitRetrievalComplete(query: string, results: RetrievalResultItem[], duration: number): void {
    this.emit({
      type: 'retrieval:complete',
      query,
      results,
      duration,
      message: `Retrieval complete: ${results.length} results in ${duration}ms`,
      timestamp: Date.now(),
    });
  }

  emitStatsUpdate(stats: StatsUpdateData): void {
    this.emit({
      type: 'stats:update',
      stats,
      message: 'Statistics updated',
      timestamp: Date.now(),
    });
  }

  emitPipelineComplete(stats: { chunksCreated: number; tokensProcessed: number }): void {
    this.emit({
      type: 'pipeline:complete',
      documentId: this.documentId,
      message: `Pipeline completed: ${stats.chunksCreated} chunks, ${stats.tokensProcessed} tokens`,
      timestamp: Date.now(),
    });
  }

  emitError(message: string, stack?: string): void {
    const errorObj: { message: string; stack?: string } = { message };
    if (stack !== undefined) {
      errorObj.stack = stack;
    }
    this.emit({
      type: 'error',
      documentId: this.documentId,
      error: errorObj,
      timestamp: Date.now(),
    });
  }
}

/**
 * Create pipeline emitter for a document
 */
export function createPipelineEmitter(documentId: string, wsHandler?: WebSocketHandler): PipelineEmitter {
  return new PipelineEmitter(documentId, wsHandler);
}