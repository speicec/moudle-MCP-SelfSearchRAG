/**
 * VectorStoreFactory - Factory pattern for creating vector store adapters
 *
 * Supports two adapter types:
 * - 'qdrant': Production-grade HNSW + Sparse indexing
 * - 'in-memory': Local testing/development fallback
 *
 * Factory handles:
 * - Configuration loading from environment
 * - Lazy initialization
 * - Graceful fallback on connection failure
 */

import type { VectorStoreAdapter } from './vector-store-adapter.js';
import { InMemoryVectorStoreAdapter, createInMemoryVectorStoreAdapter } from './in-memory-adapter.js';

/**
 * Vector store type selection
 */
export type VectorStoreType = 'qdrant' | 'in-memory';

/**
 * Factory configuration
 */
export interface VectorStoreFactoryConfig {
  type: VectorStoreType;
  qdrant?: {
    url: string;
    apiKey?: string | undefined;
    timeoutMs: number;
  };
}

/**
 * Get vector store type from environment
 */
export function getVectorStoreType(): VectorStoreType {
  const type = process.env.VECTOR_STORE_TYPE?.toLowerCase();
  if (type === 'qdrant') {
    return 'qdrant';
  }
  // Default to in-memory for development
  return 'in-memory';
}

/**
 * Get Qdrant URL from environment
 */
export function getQdrantUrl(): string {
  return process.env.QDRANT_URL ?? 'http://localhost:6333';
}

/**
 * Get Qdrant API key from environment (optional)
 */
export function getQdrantApiKey(): string | undefined {
  return process.env.QDRANT_API_KEY;
}

/**
 * Default factory configuration
 */
export const DEFAULT_FACTORY_CONFIG: VectorStoreFactoryConfig = {
  type: getVectorStoreType(),
  qdrant: {
    url: getQdrantUrl(),
    apiKey: getQdrantApiKey(),
    timeoutMs: 10000,
  },
};

/**
 * VectorStoreFactory class
 */
export class VectorStoreFactory {
  private config: VectorStoreFactoryConfig;
  private adapter: VectorStoreAdapter | null = null;
  private initializationPromise: Promise<void> | null = null;

  constructor(config?: Partial<VectorStoreFactoryConfig>) {
    this.config = { ...DEFAULT_FACTORY_CONFIG, ...config };
  }

  /**
   * Get vector store type
   */
  getType(): VectorStoreType {
    return this.config.type;
  }

  /**
   * Get configuration
   */
  getConfig(): VectorStoreFactoryConfig {
    return { ...this.config };
  }

  /**
   * Create and initialize vector store adapter
   * Uses lazy initialization with singleton pattern
   */
  async createAdapter(): Promise<VectorStoreAdapter> {
    // Return existing adapter if already initialized
    if (this.adapter && this.adapter.isReady()) {
      return this.adapter;
    }

    // Wait for ongoing initialization if in progress
    if (this.initializationPromise) {
      await this.initializationPromise;
      if (this.adapter) {
        return this.adapter;
      }
    }

    // Start initialization
    this.initializationPromise = this.initializeAdapter();
    await this.initializationPromise;
    this.initializationPromise = null;

    return this.adapter!;
  }

  /**
   * Initialize adapter based on configuration
   */
  private async initializeAdapter(): Promise<void> {
    console.log(`[VectorStoreFactory] Creating ${this.config.type} adapter`);

    if (this.config.type === 'qdrant') {
      try {
        const { createQdrantVectorStoreAdapter } = await import('./qdrant-client.js');

        const qdrantConfig = this.config.qdrant!;
        this.adapter = createQdrantVectorStoreAdapter({
          url: qdrantConfig.url,
          apiKey: qdrantConfig.apiKey,
          timeoutMs: qdrantConfig.timeoutMs,
        });

        await this.adapter.initialize();
        console.log('[VectorStoreFactory] Qdrant adapter initialized successfully');
      } catch (error) {
        console.error('[VectorStoreFactory] Failed to initialize Qdrant adapter:', error);
        console.warn('[VectorStoreFactory] Falling back to in-memory adapter');

        this.adapter = createInMemoryVectorStoreAdapter();
        await this.adapter.initialize();
        this.config.type = 'in-memory';
      }
    } else {
      this.adapter = createInMemoryVectorStoreAdapter();
      await this.adapter.initialize();
      console.log('[VectorStoreFactory] In-memory adapter initialized');
    }
  }

  /**
   * Shutdown the adapter
   */
  async shutdown(): Promise<void> {
    if (this.adapter) {
      await this.adapter.shutdown();
      this.adapter = null;
    }
    console.log('[VectorStoreFactory] Shutdown complete');
  }

  /**
   * Log startup information
   */
  logStartupInfo(): void {
    console.log('='.repeat(60));
    console.log('[VectorStoreFactory] Vector Store Configuration:');
    console.log(`  Type: ${this.config.type}`);

    if (this.config.type === 'qdrant') {
      console.log(`  Qdrant URL: ${this.config.qdrant!.url}`);
      console.log(`  API Key: ${this.config.qdrant!.apiKey ? 'configured' : 'not configured'}`);
      console.log(`  Timeout: ${this.config.qdrant!.timeoutMs}ms`);
      console.log('  Features:');
      console.log('    - HNSW indexing for fast dense search');
      console.log('    - Sparse vector support for keyword matching');
      console.log('    - Metadata filtering at index level');
    } else {
      console.log('  Mode: In-memory (development/testing)');
      console.log('  Note: Performance is O(N) - use Qdrant for production');
    }

    console.log('='.repeat(60));
  }

  /**
   * Check if adapter is ready
   */
  isReady(): boolean {
    return this.adapter?.isReady() ?? false;
  }

  /**
   * Get current adapter (throws if not initialized)
   */
  getAdapter(): VectorStoreAdapter {
    if (!this.adapter || !this.adapter.isReady()) {
      throw new Error('Vector store adapter not initialized. Call createAdapter() first.');
    }
    return this.adapter;
  }
}

/**
 * Global factory instance
 */
let globalFactory: VectorStoreFactory | null = null;

/**
 * Get global vector store factory
 */
export function getVectorStoreFactory(): VectorStoreFactory {
  if (!globalFactory) {
    globalFactory = new VectorStoreFactory();
    globalFactory.logStartupInfo();
  }
  return globalFactory;
}

/**
 * Create new factory with custom config
 */
export function createVectorStoreFactory(config?: Partial<VectorStoreFactoryConfig>): VectorStoreFactory {
  return new VectorStoreFactory(config);
}

/**
 * Reset global factory (for testing)
 */
export function resetVectorStoreFactory(): void {
  if (globalFactory) {
    globalFactory.shutdown().catch(err => {
      console.error('[VectorStoreFactory] Error during reset:', err);
    });
  }
  globalFactory = null;
}