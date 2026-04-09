import type { Document, DocumentStatus } from './document.js';
import { updateDocumentStatus } from './document.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Storage configuration
 */
export interface StorageConfig {
  basePath: string;
  maxDocuments: number;
}

/**
 * Default storage configuration
 */
export const DEFAULT_STORAGE_CONFIG: StorageConfig = {
  basePath: './data/documents',
  maxDocuments: 10000,
};

/**
 * Document storage - manages document persistence
 */
export class DocumentStorage {
  private documents: Map<string, Document> = new Map();
  private config: StorageConfig;

  constructor(config: Partial<StorageConfig> = {}) {
    this.config = {
      ...DEFAULT_STORAGE_CONFIG,
      ...config,
    };
  }

  /**
   * Store a document with unique ID
   */
  async store(document: Document): Promise<Document> {
    // Ensure document has unique ID
    const id = document.id || uuidv4();
    const storedDocument: Document = {
      ...document,
      id,
      createdAt: document.createdAt ?? new Date(),
      updatedAt: new Date(),
    };

    // Check capacity
    if (this.documents.size >= this.config.maxDocuments) {
      throw new Error(`Storage capacity exceeded: ${this.config.maxDocuments} documents`);
    }

    // Store document
    this.documents.set(id, storedDocument);

    return storedDocument;
  }

  /**
   * Get a document by ID
   */
  async get(id: string): Promise<Document | null> {
    const document = this.documents.get(id);
    return document ?? null;
  }

  /**
   * Update document status
   */
  async updateStatus(id: string, status: DocumentStatus): Promise<Document> {
    const document = this.documents.get(id);
    if (!document) {
      throw new Error(`Document not found: ${id}`);
    }

    const updated = updateDocumentStatus(document, status);
    this.documents.set(id, updated);
    return updated;
  }

  /**
   * Delete a document
   */
  async delete(id: string): Promise<boolean> {
    return this.documents.delete(id);
  }

  /**
   * Check if document exists
   */
  exists(id: string): boolean {
    return this.documents.has(id);
  }

  /**
   * List all documents
   */
  async list(options?: ListOptions): Promise<Document[]> {
    const all = Array.from(this.documents.values());

    // Apply filters
    let filtered = all;

    if (options?.status) {
      filtered = filtered.filter(d => d.status === options.status);
    }

    if (options?.format) {
      filtered = filtered.filter(d => d.metadata.format === options.format);
    }

    // Sort by upload timestamp (newest first)
    filtered.sort((a, b) =>
      b.metadata.uploadTimestamp.getTime() - a.metadata.uploadTimestamp.getTime()
    );

    // Apply limit
    if (options?.limit) {
      filtered = filtered.slice(0, options.limit);
    }

    return filtered;
  }

  /**
   * Get storage statistics
   */
  getStats(): StorageStats {
    const all = Array.from(this.documents.values());

    const byStatus: Record<DocumentStatus, number> = {
      pending: 0,
      queued: 0,
      processing: 0,
      indexed: 0,
      failed: 0,
    };

    const byFormat: Record<string, number> = {};

    let totalSizeBytes = 0;

    for (const doc of all) {
      byStatus[doc.status]++;
      byFormat[doc.metadata.format] = (byFormat[doc.metadata.format] ?? 0) + 1;
      totalSizeBytes += doc.metadata.sizeBytes;
    }

    return {
      totalDocuments: all.length,
      byStatus,
      byFormat,
      totalSizeBytes,
      averageSizeBytes: all.length > 0 ? totalSizeBytes / all.length : 0,
    };
  }

  /**
   * Clear all documents
   */
  clear(): void {
    this.documents.clear();
  }

  /**
   * Get document count
   */
  count(): number {
    return this.documents.size;
  }
}

/**
 * List options
 */
export interface ListOptions {
  limit?: number | undefined;
  status?: DocumentStatus | undefined;
  format?: string | undefined;
}

/**
 * Storage statistics
 */
export interface StorageStats {
  totalDocuments: number;
  byStatus: Record<DocumentStatus, number>;
  byFormat: Record<string, number>;
  totalSizeBytes: number;
  averageSizeBytes: number;
}

/**
 * Global storage instance
 */
export const globalStorage = new DocumentStorage();

/**
 * Create a storage instance
 */
export function createStorage(config?: Partial<StorageConfig>): DocumentStorage {
  return new DocumentStorage(config);
}