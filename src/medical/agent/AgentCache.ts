/**
 * Agent Cache - Agent 结果缓存
 *
 * 缓存 LLM 推理结果和检索结果，提高响应速度
 */

import type { MedicalEntities, MedicalAnswer, SourceCitation } from '../types.js';
import type { AgentResult, AgentState } from './types.js';

/**
 * 缓存键
 */
interface CacheKey {
  query: string;
  domain?: string;
  iteration?: number;
}

/**
 * 缓存条目
 */
interface CacheEntry<T> {
  key: string;
  value: T;
  timestamp: number;
  ttl: number; // milliseconds
  hits: number;
}

/**
 * 缓存配置
 */
export interface CacheConfig {
  maxSize: number;
  defaultTtl: number; // milliseconds
  enableLlmCache: boolean;
  enableRetrievalCache: boolean;
}

/**
 * 默认缓存配置
 */
export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  maxSize: 100,
  defaultTtl: 3600000, // 1 hour
  enableLlmCache: true,
  enableRetrievalCache: true,
};

/**
 * AgentCache - Agent 缓存管理器
 */
export class AgentCache {
  private llmCache: Map<string, CacheEntry<string>> = new Map();
  private retrievalCache: Map<string, CacheEntry<Array<{
    content: string;
    source: SourceCitation;
  }>>> = new Map();
  private answerCache: Map<string, CacheEntry<MedicalAnswer>> = new Map();
  private config: CacheConfig;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      ...DEFAULT_CACHE_CONFIG,
      ...config,
    };
  }

  /**
   * 生成缓存键
   */
  private generateKey(data: CacheKey): string {
    return JSON.stringify({
      query: data.query.toLowerCase(),
      domain: data.domain ?? 'all',
      iteration: data.iteration,
    });
  }

  /**
   * 检查缓存是否有效
   */
  private isValid<T>(entry: CacheEntry<T>): boolean {
    return Date.now() - entry.timestamp < entry.ttl;
  }

  /**
   * 清理过期缓存
   */
  private cleanup<T>(cache: Map<string, CacheEntry<T>>): void {
    for (const [key, entry] of cache.entries()) {
      if (!this.isValid(entry)) {
        cache.delete(key);
      }
    }
  }

  /**
   * 检查缓存大小
   */
  private ensureSize<T>(cache: Map<string, CacheEntry<T>>): void {
    if (cache.size >= this.config.maxSize) {
      // 删除最旧的条目
      const entries = [...cache.entries()];
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      const toDelete = entries.slice(0, Math.floor(this.config.maxSize * 0.2));
      for (const [key] of toDelete) {
        cache.delete(key);
      }
    }
  }

  // ==================== LLM 缓存 ====================

  /**
   * 缓存 LLM 响应
   */
  cacheLlmResponse(prompt: string, response: string, ttl?: number): void {
    if (!this.config.enableLlmCache) return;

    this.cleanup(this.llmCache);
    this.ensureSize(this.llmCache);

    const key = this.generateKey({ query: prompt });
    const entry: CacheEntry<string> = {
      key,
      value: response,
      timestamp: Date.now(),
      ttl: ttl ?? this.config.defaultTtl,
      hits: 0,
    };

    this.llmCache.set(key, entry);
  }

  /**
   * 获取缓存的 LLM 响应
   */
  getCachedLlmResponse(prompt: string): string | null {
    if (!this.config.enableLlmCache) return null;

    const key = this.generateKey({ query: prompt });
    const entry = this.llmCache.get(key);

    if (entry && this.isValid(entry)) {
      entry.hits++;
      return entry.value;
    }

    return null;
  }

  // ==================== 检索缓存 ====================

  /**
   * 缓存检索结果
   */
  cacheRetrievalResults(
    query: string,
    results: Array<{ content: string; source: SourceCitation }>,
    ttl?: number,
  ): void {
    if (!this.config.enableRetrievalCache) return;

    this.cleanup(this.retrievalCache);
    this.ensureSize(this.retrievalCache);

    const key = this.generateKey({ query });
    const entry: CacheEntry<Array<{ content: string; source: SourceCitation }>> = {
      key,
      value: results,
      timestamp: Date.now(),
      ttl: ttl ?? this.config.defaultTtl,
      hits: 0,
    };

    this.retrievalCache.set(key, entry);
  }

  /**
   * 获取缓存的检索结果
   */
  getCachedRetrievalResults(query: string): Array<{ content: string; source: SourceCitation }> | null {
    if (!this.config.enableRetrievalCache) return null;

    const key = this.generateKey({ query });
    const entry = this.retrievalCache.get(key);

    if (entry && this.isValid(entry)) {
      entry.hits++;
      return entry.value;
    }

    return null;
  }

  // ==================== 回答缓存 ====================

  /**
   * 缓存完整回答
   */
  cacheAnswer(entities: MedicalEntities, answer: MedicalAnswer, ttl?: number): void {
    this.cleanup(this.answerCache);
    this.ensureSize(this.answerCache);

    const keyArgs: { query: string } & { domain?: string } = {
      query: entities.rawQuery,
    };
    const domain = entities.drugs[0]?.classification.category;
    if (domain !== undefined) {
      keyArgs.domain = domain;
    }
    const key = this.generateKey(keyArgs);

    const entry: CacheEntry<MedicalAnswer> = {
      key,
      value: answer,
      timestamp: Date.now(),
      ttl: ttl ?? this.config.defaultTtl,
      hits: 0,
    };

    this.answerCache.set(key, entry);
  }

  /**
   * 获取缓存的回答
   */
  getCachedAnswer(entities: MedicalEntities): MedicalAnswer | null {
    const keyArgs: { query: string } & { domain?: string } = {
      query: entities.rawQuery,
    };
    const domain = entities.drugs[0]?.classification.category;
    if (domain !== undefined) {
      keyArgs.domain = domain;
    }
    const key = this.generateKey(keyArgs);

    const entry = this.answerCache.get(key);

    if (entry && this.isValid(entry)) {
      entry.hits++;
      return entry.value;
    }

    return null;
  }

  // ==================== 统计 ====================

  /**
   * 获取缓存统计
   */
  getStats(): {
    llmCache: { size: number; hits: number };
    retrievalCache: { size: number; hits: number };
    answerCache: { size: number; hits: number };
  } {
    return {
      llmCache: {
        size: this.llmCache.size,
        hits: this.sumHits(this.llmCache),
      },
      retrievalCache: {
        size: this.retrievalCache.size,
        hits: this.sumHits(this.retrievalCache),
      },
      answerCache: {
        size: this.answerCache.size,
        hits: this.sumHits(this.answerCache),
      },
    };
  }

  /**
   * 计算总命中数
   */
  private sumHits<T>(cache: Map<string, CacheEntry<T>>): number {
    return [...cache.values()].reduce((sum, entry) => sum + entry.hits, 0);
  }

  /**
   * 清空所有缓存
   */
  clear(): void {
    this.llmCache.clear();
    this.retrievalCache.clear();
    this.answerCache.clear();
  }

  /**
   * 导出缓存状态
   */
  exportState(): {
    llmEntries: Array<{ key: string; timestamp: number; hits: number }>;
    retrievalEntries: Array<{ key: string; timestamp: number; hits: number }>;
    answerEntries: Array<{ key: string; timestamp: number; hits: number }>;
  } {
    return {
      llmEntries: [...this.llmCache.values()].map(e => ({
        key: e.key,
        timestamp: e.timestamp,
        hits: e.hits,
      })),
      retrievalEntries: [...this.retrievalCache.values()].map(e => ({
        key: e.key,
        timestamp: e.timestamp,
        hits: e.hits,
      })),
      answerEntries: [...this.answerCache.values()].map(e => ({
        key: e.key,
        timestamp: e.timestamp,
        hits: e.hits,
      })),
    };
  }
}

/**
 * 创建 AgentCache
 */
export function createAgentCache(config?: Partial<CacheConfig>): AgentCache {
  return new AgentCache(config);
}

/**
 * 全局缓存实例（可选）
 */
let globalCache: AgentCache | null = null;

/**
 * 获取全局缓存
 */
export function getGlobalCache(): AgentCache {
  if (!globalCache) {
    globalCache = createAgentCache();
  }
  return globalCache;
}

/**
 * 设置全局缓存
 */
export function setGlobalCache(cache: AgentCache): void {
  globalCache = cache;
}