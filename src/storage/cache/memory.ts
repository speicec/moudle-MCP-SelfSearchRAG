/**
 * @spec architecture.md#CacheStore
 * @layer 1
 * @description 内存缓存存储实现
 */

import type { ICacheStore, CacheStats } from '../interface';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  hits: number;
}

export class MemoryCacheStore implements ICacheStore {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private maxSize: number;
  private defaultTtl: number;
  private hits: number = 0;
  private misses: number = 0;

  constructor(maxSize: number = 10000, defaultTtl: number = 3600) {
    this.maxSize = maxSize;
    this.defaultTtl = defaultTtl * 1000;
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      this.misses++;
      return null;
    }

    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    entry.hits++;
    this.hits++;
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    if (this.cache.size >= this.maxSize) {
      this.evict();
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + (ttl ? ttl * 1000 : this.defaultTtl),
      hits: 0
    });
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  async getStats(): Promise<CacheStats> {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: total > 0 ? this.hits / total : 0,
      missRate: total > 0 ? this.misses / total : 0
    };
  }

  private evict(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt < now) {
        this.cache.delete(key);
      }
    }

    if (this.cache.size >= this.maxSize) {
      let minHits = Infinity;
      let lruKey: string | null = null;

      for (const [key, entry] of this.cache.entries()) {
        if (entry.hits < minHits) {
          minHits = entry.hits;
          lruKey = key;
        }
      }

      if (lruKey) {
        this.cache.delete(lruKey);
      }
    }
  }
}