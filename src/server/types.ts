/**
 * HTTP/WebSocket type definitions
 */

/**
 * Pipeline event types for WebSocket broadcasting
 */
export type PipelineEventType =
  | 'pipeline:start'
  | 'stage:start'
  | 'stage:progress'
  | 'stage:complete'
  | 'stage:metrics'
  | 'pipeline:complete'
  | 'chunk:created'
  | 'retrieval:start'
  | 'retrieval:match'
  | 'retrieval:complete'
  | 'stats:update'
  | 'generation:start'
  | 'generation:thinking'
  | 'generation:answer'
  | 'generation:complete'
  | 'generation:error'
  | 'error';

/**
 * Pipeline stage names
 */
export type PipelineStageName = 'ingest' | 'parse' | 'chunk' | 'embed' | 'index';

/**
 * Stage metrics for detailed processing statistics
 */
export interface StageMetrics {
  fileSizeBytes?: number;
  pagesExtracted?: number;
  tokensExtracted?: number;
  embeddingDimension?: number;
  chunksCreated?: number;
  processingTimeMs?: number;
  throughput?: number; // items per second
}

/**
 * Chunk creation event data
 */
export interface ChunkCreatedData {
  id: string;
  level: 'small' | 'parent';
  contentPreview: string; // first 100 chars
  tokenCount: number;
  qualityScore: number;
  position: { start: number; end: number };
  metadata?: Record<string, unknown>;
}

/**
 * Retrieval match data
 */
export interface RetrievalMatchData {
  smallChunkId: string;
  similarityScore: number;
  rank: number;
}

/**
 * Statistics update data
 */
export interface StatsUpdateData {
  pipelineStats: {
    totalDocumentsProcessed: number;
    averageProcessingTimeMs: number;
    totalChunksCreated: number;
    averageChunksPerDocument: number;
  };
  retrievalStats: {
    totalQueries: number;
    averageRetrievalTimeMs: number;
    averageResultsPerQuery: number;
    successRate: number;
  };
  chunkStats: {
    totalSmallChunks: number;
    totalParentChunks: number;
    averageQualityScore: number;
    qualityDistribution: { high: number; medium: number; low: number };
  };
  stageTimeDistribution: {
    ingest: number;
    parse: number;
    embed: number;
    index: number;
  };
}

/**
 * Pipeline event for WebSocket broadcasting
 */
export interface PipelineEvent {
  type: PipelineEventType;
  stage?: PipelineStageName;
  progress?: number; // 0-100
  message?: string;
  timestamp: number;
  documentId?: string;
  // New fields for extended events
  metrics?: StageMetrics;
  chunk?: ChunkCreatedData;
  totalChunks?: number;
  query?: string;
  match?: RetrievalMatchData;
  results?: RetrievalResultItem[];
  duration?: number;
  stats?: StatsUpdateData;
  error?: {
    message: string;
    stack?: string;
  };
  // Generation event fields
  phase?: 'analysis' | 'retrieval' | 'reasoning' | 'answer';
  sourcesCount?: number;
  thinkingContent?: string;
  answerContent?: string;
  thinkingTokens?: number;
  answerTokens?: number;
  totalDuration?: number;
}

/**
 * Document metadata
 */
export interface DocumentMetadata {
  id: string;
  filename: string;
  size: number;
  uploadedAt: number;
  status: 'pending' | 'processing' | 'indexed' | 'error';
  errorMessage?: string;
}

/**
 * Chat query request
 */
export interface ChatQueryRequest {
  query: string;
  documentIds?: string[];
  topK?: number;
  similarityThreshold?: number;
  maxContextTokens?: number;
}

/**
 * Chat query response
 */
export interface ChatQueryResponse {
  query: string;
  results: RetrievalResultItem[];
  assembledContext?: {
    content: string;
    tokenCount: number;
    truncated: boolean;
  };
}

/**
 * Retrieval result item
 */
export interface RetrievalResultItem {
  smallChunkId: string;
  parentChunkId: string;
  parentChunkContent: string;
  similarityScore: number;
  sourceDocumentId: string;
  // Context window fields (new)
  contextWindow?: string | undefined;
  windowStart?: number | undefined;
  windowEnd?: number | undefined;
}

/**
 * WebSocket message from client
 */
export interface WebSocketClientMessage {
  type: 'subscribe' | 'unsubscribe';
  documentId?: string;
}

/**
 * HTTP server configuration
 */
export interface HttpServerConfig {
  port: number;
  host: string;
  documentStoragePath: string;
  cors?: {
    origin: string | string[];
  };
}

/**
 * Default HTTP server configuration
 */
export const DEFAULT_HTTP_SERVER_CONFIG: HttpServerConfig = {
  port: 3001,
  host: 'localhost',
  documentStoragePath: './data/documents',
};

/**
 * Fastify instance extensions
 */
declare module 'fastify' {
  interface FastifyInstance {
    documentStoragePath?: string;
    wsHandler?: import('./websocket-handler.js').WebSocketHandler;
    hierarchicalStore?: import('../chunking/hierarchical-store.js').HierarchicalStore;
    embeddingService?: import('../embedding/embedding-service.js').TextEmbeddingService;
    statsService?: import('./stats-aggregation-service.js').StatsAggregationService;
  }
}