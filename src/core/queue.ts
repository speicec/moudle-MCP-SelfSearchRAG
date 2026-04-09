import type { Document, DocumentStatus } from './document.js';
import { updateDocumentStatus } from './document.js';

/**
 * Queue item representing a document to be processed
 */
export interface QueueItem {
  documentId: string;
  priority: number;
  addedAt: Date;
  attempts: number;
  lastAttemptAt?: Date;
  error?: string;
}

/**
 * Queue configuration
 */
export interface QueueConfig {
  maxConcurrent: number;
  maxAttempts: number;
  retryDelayMs: number;
}

/**
 * Default queue configuration
 */
export const DEFAULT_QUEUE_CONFIG: QueueConfig = {
  maxConcurrent: 5,
  maxAttempts: 3,
  retryDelayMs: 1000,
};

/**
 * Processing queue - manages document processing order
 */
export class ProcessingQueue {
  private queue: QueueItem[] = [];
  private processing: Map<string, QueueItem> = new Map();
  private completed: Set<string> = new Set();
  private failed: Map<string, string> = new Map();
  private config: QueueConfig;

  constructor(config: Partial<QueueConfig> = {}) {
    this.config = {
      ...DEFAULT_QUEUE_CONFIG,
      ...config,
    };
  }

  /**
   * Add document to queue
   */
  enqueue(documentId: string, priority: number = 0): QueueItem {
    const item: QueueItem = {
      documentId,
      priority,
      addedAt: new Date(),
      attempts: 0,
    };

    // Insert sorted by priority (higher priority first)
    const insertIndex = this.queue.findIndex(
      (existing) => existing.priority < priority
    );

    if (insertIndex === -1) {
      this.queue.push(item);
    } else {
      this.queue.splice(insertIndex, 0, item);
    }

    return item;
  }

  /**
   * Get next item to process
   */
  dequeue(): QueueItem | null {
    if (this.queue.length === 0) {
      return null;
    }

    if (this.processing.size >= this.config.maxConcurrent) {
      return null; // At capacity
    }

    const item = this.queue.shift()!;
    item.attempts++;
    item.lastAttemptAt = new Date();
    this.processing.set(item.documentId, item);

    return item;
  }

  /**
   * Mark item as processing started
   */
  startProcessing(documentId: string): void {
    const item = this.processing.get(documentId);
    if (item) {
      item.lastAttemptAt = new Date();
    }
  }

  /**
   * Mark item as completed
   */
  complete(documentId: string): void {
    this.processing.delete(documentId);
    this.completed.add(documentId);
  }

  /**
   * Mark item as failed
   */
  fail(documentId: string, error: string): void {
    const item = this.processing.get(documentId);

    if (item && item.attempts < this.config.maxAttempts) {
      // Retry - move back to queue
      item.error = error;
      this.processing.delete(documentId);

      // Re-enqueue for retry
      const retryItem = this.enqueue(documentId, item.priority);
      retryItem.attempts = item.attempts;
      retryItem.error = error;
    } else {
      // Max attempts exceeded - mark as permanently failed
      this.processing.delete(documentId);
      this.failed.set(documentId, error);
    }
  }

  /**
   * Get queue status
   */
  getStatus(): QueueStatus {
    return {
      pending: this.queue.length,
      processing: this.processing.size,
      completed: this.completed.size,
      failed: this.failed.size,
      capacity: this.config.maxConcurrent,
    };
  }

  /**
   * Get pending items
   */
  getPending(): QueueItem[] {
    return [...this.queue];
  }

  /**
   * Get processing items
   */
  getProcessing(): QueueItem[] {
    return Array.from(this.processing.values());
  }

  /**
   * Get failed items
   */
  getFailed(): Map<string, string> {
    return new Map(this.failed);
  }

  /**
   * Check if document is in queue
   */
  isInQueue(documentId: string): boolean {
    return this.queue.some((item) => item.documentId === documentId);
  }

  /**
   * Check if document is being processed
   */
  isProcessing(documentId: string): boolean {
    return this.processing.has(documentId);
  }

  /**
   * Check if document is completed
   */
  isCompleted(documentId: string): boolean {
    return this.completed.has(documentId);
  }

  /**
   * Check if document has failed
   */
  hasFailed(documentId: string): boolean {
    return this.failed.has(documentId);
  }

  /**
   * Clear all queues
   */
  clear(): void {
    this.queue = [];
    this.processing.clear();
    this.completed.clear();
    this.failed.clear();
  }

  /**
   * Remove item from queue
   */
  remove(documentId: string): boolean {
    // Remove from pending queue
    const queueIndex = this.queue.findIndex(
      (item) => item.documentId === documentId
    );
    if (queueIndex !== -1) {
      this.queue.splice(queueIndex, 1);
      return true;
    }

    // Remove from processing
    if (this.processing.has(documentId)) {
      this.processing.delete(documentId);
      return true;
    }

    return false;
  }

  /**
   * Re-queue failed items
   */
  retryFailed(): number {
    const failedIds = Array.from(this.failed.keys());
    this.failed.clear();

    for (const documentId of failedIds) {
      this.enqueue(documentId, 0);
    }

    return failedIds.length;
  }
}

/**
 * Queue status
 */
export interface QueueStatus {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  capacity: number;
}

/**
 * Global queue instance
 */
export const globalQueue = new ProcessingQueue();

/**
 * Create a processing queue
 */
export function createQueue(config?: Partial<QueueConfig>): ProcessingQueue {
  return new ProcessingQueue(config);
}