import type { EmbeddingVector } from '../core/types.js';
import { createHash } from 'crypto';

/**
 * Cache entry
 */
interface CacheEntry {
  key: string;
  vector: number[];
  modality: 'text' | 'image';
  createdAt: Date;
  lastAccessed: Date;
  accessCount: number;
  size: number;
}

/**
 * Embedding cache configuration
 */
export interface EmbeddingCacheConfig {
  maxSize: number;
  maxAge: number;
  evictionPolicy: 'lru' | 'lfu' | 'fifo';
}

/**
 * Default embedding cache configuration
 */
export const DEFAULT_CACHE_CONFIG: EmbeddingCacheConfig = {
  maxSize: 10000,
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
  evictionPolicy: 'lru',
};

/**
 * Embedding cache for reuse optimization
 */
export class EmbeddingCache {
  private cache: Map<string, CacheEntry> = new Map();
  private config: EmbeddingCacheConfig;
  private hits: number = 0;
  private misses: number = 0;

  constructor(config: Partial<EmbeddingCacheConfig> = {}) {
    this.config = {
      ...DEFAULT_CACHE_CONFIG,
      ...config,
    };
  }

  /**
   * Generate cache key from content
   */
  generateKey(content: string | Buffer, modality: 'text' | 'image'): string {
    const data = typeof content === 'string' ? content : content.toString('base64');
    const hash = createHash('sha256').update(data).digest('hex');
    return `${modality}:${hash}`;
  }

  /**
   * Get embedding from cache
   */
  get(content: string | Buffer, modality: 'text' | 'image'): number[] | null {
    const key = this.generateKey(content, modality);
    const entry = this.cache.get(key);

    if (!entry) {
      this.misses++;
      return null;
    }

    // Check if entry has expired
    if (Date.now() - entry.createdAt.getTime() > this.config.maxAge) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    // Update access stats
    entry.lastAccessed = new Date();
    entry.accessCount++;
    this.hits++;

    return entry.vector;
  }

  /**
   * Store embedding in cache
   */
  set(content: string | Buffer, vector: number[], modality: 'text' | 'image'): void {
    const key = this.generateKey(content, modality);

    // Evict if at capacity
    if (this.cache.size >= this.config.maxSize) {
      this.evict();
    }

    const entry: CacheEntry = {
      key,
      vector,
      modality,
      createdAt: new Date(),
      lastAccessed: new Date(),
      accessCount: 0,
      size: vector.length * 8, // Approximate size in bytes
    };

    this.cache.set(key, entry);
  }

  /**
   * Check if content is cached
   */
  has(content: string | Buffer, modality: 'text' | 'image'): boolean {
    const key = this.generateKey(content, modality);
    return this.cache.has(key);
  }

  /**
   * Remove entry from cache
   */
  delete(content: string | Buffer, modality: 'text' | 'image'): boolean {
    const key = this.generateKey(content, modality);
    return this.cache.delete(key);
  }

  /**
   * Clear cache
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Evict entries based on policy
   */
  private evict(): void {
    if (this.cache.size === 0) return;

    let keyToEvict: string | null = null;

    switch (this.config.evictionPolicy) {
      case 'lru':
        // Evict least recently used
        let oldestAccess = Date.now();
        for (const [key, entry] of this.cache) {
          if (entry.lastAccessed.getTime() < oldestAccess) {
            oldestAccess = entry.lastAccessed.getTime();
            keyToEvict = key;
          }
        }
        break;

      case 'lfu':
        // Evict least frequently used
        let lowestCount = Infinity;
        for (const [key, entry] of this.cache) {
          if (entry.accessCount < lowestCount) {
            lowestCount = entry.accessCount;
            keyToEvict = key;
          }
        }
        break;

      case 'fifo':
        // Evict oldest entry
        let oldestCreated = Date.now();
        for (const [key, entry] of this.cache) {
          if (entry.createdAt.getTime() < oldestCreated) {
            oldestCreated = entry.createdAt.getTime();
            keyToEvict = key;
          }
        }
        break;
    }

    if (keyToEvict) {
      this.cache.delete(keyToEvict);
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalRequests = this.hits + this.misses;
    const entries = Array.from(this.cache.values());
    const totalSize = entries.reduce((sum, e) => sum + e.size, 0);

    return {
      entries: this.cache.size,
      maxSize: this.config.maxSize,
      hits: this.hits,
      misses: this.misses,
      hitRate: totalRequests > 0 ? this.hits / totalRequests : 0,
      totalSizeBytes: totalSize,
      textEntries: entries.filter(e => e.modality === 'text').length,
      imageEntries: entries.filter(e => e.modality === 'image').length,
    };
  }

  /**
   * Invalidate expired entries
   */
  invalidateExpired(): number {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache) {
      if (now - entry.createdAt.getTime() > this.config.maxAge) {
        this.cache.delete(key);
        removed++;
      }
    }

    return removed;
  }

  /**
   * Invalidate entries by model ID (when model changes)
   */
  invalidateByModel(_modelId: string): number {
    // In a more sophisticated implementation, we'd track model ID per entry
    this.clear();
    return this.cache.size;
  }
}

/**
 * Cache statistics
 */
export interface CacheStats {
  entries: number;
  maxSize: number;
  hits: number;
  misses: number;
  hitRate: number;
  totalSizeBytes: number;
  textEntries: number;
  imageEntries: number;
}

/**
 * Global cache instance
 */
export const globalEmbeddingCache = new EmbeddingCache();

/**
 * Create embedding cache
 */
export function createEmbeddingCache(
  config?: Partial<EmbeddingCacheConfig>
): EmbeddingCache {
  return new EmbeddingCache(config);
}