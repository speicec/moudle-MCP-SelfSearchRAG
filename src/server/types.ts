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
  | 'pipeline:complete'
  | 'error';

/**
 * Pipeline stage names
 */
export type PipelineStageName = 'ingest' | 'parse' | 'chunk' | 'embed' | 'index';

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
  error?: {
    message: string;
    stack?: string;
  };
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
  }
}