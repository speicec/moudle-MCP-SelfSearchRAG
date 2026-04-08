/**
 * @spec resources.md
 * @layer 6
 * @description MCP Resources实现
 */

import type { IResourceProvider, ResourceContent, ResourceDefinition } from './interface';
import type { IMetadataStore } from '../../storage/interface';

// 文档列表Resource
export class DocsResource implements IResourceProvider {
  private metadataStore: IMetadataStore;

  constructor(metadataStore: IMetadataStore) {
    this.metadataStore = metadataStore;
  }

  getUri(): string {
    return 'rag://docs';
  }

  getName(): string {
    return 'Indexed Documents';
  }

  async read(): Promise<ResourceContent> {
    const docs = await this.metadataStore.listDocuments();

    return {
      uri: this.getUri(),
      mimeType: 'application/json',
      text: JSON.stringify({
        documents: docs.map(doc => ({
          id: doc.id,
          path: doc.path,
          indexed_at: doc.indexedAt,
          chunks_count: 0, // Would need to count
          size_bytes: doc.metadata.size,
          metadata: doc.metadata
        })),
        total: docs.length,
        updated_at: new Date().toISOString()
      }, null, 2)
    };
  }
}

// 检索历史Resource
export class HistoryResource implements IResourceProvider {
  private queries: Array<{
    id: string;
    query: string;
    mode: string;
    results_count: number;
    duration_ms: number;
    timestamp: Date;
  }> = [];

  getUri(): string {
    return 'rag://history';
  }

  getName(): string {
    return 'Search History';
  }

  addQuery(query: {
    id: string;
    query: string;
    mode: string;
    results_count: number;
    duration_ms: number;
  }): void {
    this.queries.push({
      ...query,
      timestamp: new Date()
    });

    // Keep only last 100 queries
    if (this.queries.length > 100) {
      this.queries.shift();
    }
  }

  async read(): Promise<ResourceContent> {
    return {
      uri: this.getUri(),
      mimeType: 'application/json',
      text: JSON.stringify({
        queries: this.queries.map(q => ({
          ...q,
          timestamp: q.timestamp.toISOString()
        })),
        total_queries: this.queries.length
      }, null, 2)
    };
  }
}

// 配置Resource
export class ConfigResource implements IResourceProvider {
  private config: Record<string, unknown>;

  constructor(config: Record<string, unknown>) {
    this.config = config;
  }

  getUri(): string {
    return 'rag://config';
  }

  getName(): string {
    return 'System Configuration';
  }

  updateConfig(newConfig: Record<string, unknown>): void {
    this.config = { ...this.config, ...newConfig };
  }

  async read(): Promise<ResourceContent> {
    return {
      uri: this.getUri(),
      mimeType: 'application/json',
      text: JSON.stringify(this.config, null, 2)
    };
  }
}

// 指标Resource
export class MetricsResource implements IResourceProvider {
  private startTime: Date = new Date();
  private totalSearches = 0;
  private totalIndexed = 0;
  private searchLatencies: number[] = [];
  private indexLatencies: number[] = [];
  private errorCount = 0;
  private lastError?: string;

  getUri(): string {
    return 'rag://metrics';
  }

  getName(): string {
    return 'System Metrics';
  }

  recordSearch(latencyMs: number): void {
    this.totalSearches++;
    this.searchLatencies.push(latencyMs);
    if (this.searchLatencies.length > 100) {
      this.searchLatencies.shift();
    }
  }

  recordIndex(latencyMs: number): void {
    this.totalIndexed++;
    this.indexLatencies.push(latencyMs);
    if (this.indexLatencies.length > 100) {
      this.indexLatencies.shift();
    }
  }

  recordError(error: string): void {
    this.errorCount++;
    this.lastError = error;
  }

  async read(): Promise<ResourceContent> {
    const avgSearchLatency = this.searchLatencies.length > 0
      ? this.searchLatencies.reduce((a, b) => a + b, 0) / this.searchLatencies.length
      : 0;

    const avgIndexLatency = this.indexLatencies.length > 0
      ? this.indexLatencies.reduce((a, b) => a + b, 0) / this.indexLatencies.length
      : 0;

    return {
      uri: this.getUri(),
      mimeType: 'application/json',
      text: JSON.stringify({
        uptime_seconds: Math.floor((Date.now() - this.startTime.getTime()) / 1000),
        total_indexed: this.totalIndexed,
        total_searches: this.totalSearches,
        avg_search_latency_ms: Math.round(avgSearchLatency),
        avg_index_latency_ms: Math.round(avgIndexLatency),
        error_count: this.errorCount,
        last_error: this.lastError,
        memory_usage_mb: process.memoryUsage().heapUsed / 1024 / 1024
      }, null, 2)
    };
  }
}

// 所有Resource定义
export const resourceDefinitions: ResourceDefinition[] = [
  { uri: 'rag://docs', name: 'Indexed Documents', description: '已索引文档列表', mimeType: 'application/json' },
  { uri: 'rag://history', name: 'Search History', description: '检索历史记录', mimeType: 'application/json' },
  { uri: 'rag://config', name: 'System Configuration', description: '当前系统配置', mimeType: 'application/json' },
  { uri: 'rag://metrics', name: 'System Metrics', description: '系统运行指标', mimeType: 'application/json' }
];