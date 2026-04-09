import type { McpServer } from './server.js';
import type { DocumentStorage } from '../core/storage.js';
import type { RetrievalService } from '../retrieval/index-stage.js';
import type { Pipeline } from '../core/pipeline.js';
import type { Document, DocumentStatus } from '../core/document.js';
import { createDocument, isSupportedFormat, detectMimeType } from '../core/document.js';
import { ToolValidator } from './tools.js';
import { readFile } from 'fs/promises';
import { basename } from 'path';

/**
 * Tool handlers
 */
export class ToolHandlers {
  private pipeline: Pipeline;
  private storage: DocumentStorage;
  private retrieval: RetrievalService;

  constructor(
    pipeline: Pipeline,
    storage: DocumentStorage,
    retrieval: RetrievalService
  ) {
    this.pipeline = pipeline;
    this.storage = storage;
    this.retrieval = retrieval;
  }

  /**
   * Handle ingest_document tool
   */
  async ingestDocument(args: unknown): Promise<ToolResult> {
    const validation = ToolValidator.validateIngestDocument(args);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.errors.join('; '),
      };
    }

    const input = args as { document_path: string; metadata?: Record<string, unknown> };

    try {
      // Read file
      const content = await readFile(input.document_path);
      const filename = basename(input.document_path);
      const mimeType = detectMimeType(filename);

      if (!isSupportedFormat(mimeType)) {
        return {
          success: false,
          error: `Unsupported file format: ${mimeType}`,
        };
      }

      // Create document
      const document = createDocument(content, {
        filename,
        mimeType,
        customMetadata: input.metadata,
      });

      // Store document
      const storedDoc = await this.storage.store(document);

      // Process through pipeline
      const result = await this.pipeline.run(storedDoc);

      return {
        success: result.status === 'success',
        data: {
          documentId: storedDoc.id,
          status: result.status,
          errors: result.errors.length > 0 ? result.errors : undefined,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Handle query tool
   */
  async query(args: unknown): Promise<ToolResult> {
    const validation = ToolValidator.validateQuery(args);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.errors.join('; '),
      };
    }

    const input = args as {
      query_text: string;
      top_k?: number;
      threshold?: number;
      filters?: Record<string, unknown>;
      include_images?: boolean;
    };

    try {
      const results = await this.retrieval.query(input.query_text, {
        topK: input.top_k ?? 5,
        threshold: input.threshold,
        includeImages: input.include_images ?? true,
      });

      return {
        success: true,
        data: {
          query: input.query_text,
          results: results.map(r => ({
            id: r.id,
            score: r.score,
            documentId: r.sourceDocumentId,
            pageNumber: r.pageNumber,
            modality: r.modality,
          })),
          totalResults: results.length,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Handle get_document tool
   */
  async getDocument(args: unknown): Promise<ToolResult> {
    const validation = ToolValidator.validateGetDocument(args);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.errors.join('; '),
      };
    }

    const input = args as { document_id: string };

    try {
      const document = await this.storage.get(input.document_id);

      if (!document) {
        return {
          success: false,
          error: `Document not found: ${input.document_id}`,
        };
      }

      return {
        success: true,
        data: {
          id: document.id,
          metadata: document.metadata,
          status: document.status,
          createdAt: document.createdAt,
          updatedAt: document.updatedAt,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Handle list_documents tool
   */
  async listDocuments(args: unknown): Promise<ToolResult> {
    const validation = ToolValidator.validateListDocuments(args);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.errors.join('; '),
      };
    }

    const input = args as { limit?: number; status_filter?: string };

    try {
      const documents = await this.storage.list({
        limit: input.limit ?? 20,
        status: input.status_filter as DocumentStatus | undefined,
      });

      return {
        success: true,
        data: {
          documents: documents.map(d => ({
            id: d.id,
            filename: d.metadata.filename,
            status: d.status,
            format: d.metadata.format,
            sizeBytes: d.metadata.sizeBytes,
            createdAt: d.createdAt,
          })),
          total: documents.length,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Handle delete_document tool
   */
  async deleteDocument(args: unknown): Promise<ToolResult> {
    const input = args as { document_id: string };

    if (!input.document_id) {
      return {
        success: false,
        error: 'document_id is required',
      };
    }

    try {
      const removed = await this.retrieval.deleteDocument(input.document_id);

      if (removed === 0) {
        return {
          success: false,
          error: `Document not found: ${input.document_id}`,
        };
      }

      await this.storage.delete(input.document_id);

      return {
        success: true,
        data: {
          documentId: input.document_id,
          removedVectors: removed,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Handle get_stats tool
   */
  async getStats(): Promise<ToolResult> {
    try {
      const indexStats = await this.retrieval.getStats();
      const storageStats = this.storage.getStats();

      return {
        success: true,
        data: {
          index: indexStats,
          storage: storageStats,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

/**
 * Tool result
 */
export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

/**
 * Create tool handlers
 */
export function createToolHandlers(
  pipeline: Pipeline,
  storage: DocumentStorage,
  retrieval: RetrievalService
): ToolHandlers {
  return new ToolHandlers(pipeline, storage, retrieval);
}