/**
 * @spec harness.md#健康检查
 * @layer 5
 * @description 健康检查实现
 */

import type { IVectorStore, IMetadataStore } from '../../storage/interface';
import type { IEmbedder } from '../../embedding/interface';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: Record<string, {
    status: 'healthy' | 'unhealthy';
    message?: string;
    latency?: number;
  }>;
  timestamp: Date;
}

export interface IHealthChecker {
  check(): Promise<HealthStatus>;
  addCheck(name: string, checker: () => Promise<{ healthy: boolean; message?: string; latency?: number }>): void;
}

export class HealthChecker implements IHealthChecker {
  private checks: Map<string, () => Promise<{ healthy: boolean; message?: string; latency?: number }>> = new Map();
  private vectorStore?: IVectorStore;
  private metadataStore?: IMetadataStore;
  private embedder?: IEmbedder;

  constructor(
    vectorStore?: IVectorStore,
    metadataStore?: IMetadataStore,
    embedder?: IEmbedder
  ) {
    this.vectorStore = vectorStore;
    this.metadataStore = metadataStore;
    this.embedder = embedder;

    // Register default checks
    if (vectorStore) {
      this.addCheck('milvus', () => this.checkMilvus());
    }
    if (metadataStore) {
      this.addCheck('sqlite', () => this.checkSQLite());
    }
    if (embedder) {
      this.addCheck('embedding', () => this.checkEmbedding());
    }
  }

  addCheck(name: string, checker: () => Promise<{ healthy: boolean; message?: string; latency?: number }>): void {
    this.checks.set(name, checker);
  }

  async check(): Promise<HealthStatus> {
    const checkResults: Record<string, { status: 'healthy' | 'unhealthy'; message?: string; latency?: number }> = {};
    let allHealthy = true;
    let anyHealthy = false;

    for (const [name, checker] of this.checks) {
      try {
        const result = await checker();
        checkResults[name] = {
          status: result.healthy ? 'healthy' : 'unhealthy',
          message: result.message,
          latency: result.latency
        };
        if (result.healthy) {
          anyHealthy = true;
        } else {
          allHealthy = false;
        }
      } catch (error) {
        checkResults[name] = {
          status: 'unhealthy',
          message: error instanceof Error ? error.message : 'Unknown error'
        };
        allHealthy = false;
      }
    }

    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (allHealthy) {
      status = 'healthy';
    } else if (anyHealthy) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return {
      status,
      checks: checkResults,
      timestamp: new Date()
    };
  }

  private async checkMilvus(): Promise<{ healthy: boolean; message?: string; latency?: number }> {
    if (!this.vectorStore) {
      return { healthy: false, message: 'Not configured' };
    }

    const start = Date.now();
    try {
      const connected = this.vectorStore.isConnected();
      const latency = Date.now() - start;

      return {
        healthy: connected,
        message: connected ? 'Connected' : 'Not connected',
        latency
      };
    } catch (error) {
      return {
        healthy: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        latency: Date.now() - start
      };
    }
  }

  private async checkSQLite(): Promise<{ healthy: boolean; message?: string; latency?: number }> {
    const start = Date.now();
    try {
      // SQLite is in-memory, so it's always "connected"
      return {
        healthy: true,
        message: 'Ready',
        latency: Date.now() - start
      };
    } catch (error) {
      return {
        healthy: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        latency: Date.now() - start
      };
    }
  }

  private async checkEmbedding(): Promise<{ healthy: boolean; message?: string; latency?: number }> {
    if (!this.embedder) {
      return { healthy: false, message: 'Not configured' };
    }

    const start = Date.now();
    try {
      // Try to get model info
      const modelInfo = this.embedder.getModelInfo();
      return {
        healthy: true,
        message: `Model: ${modelInfo.name}`,
        latency: Date.now() - start
      };
    } catch (error) {
      return {
        healthy: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        latency: Date.now() - start
      };
    }
  }
}

export const healthChecker = new HealthChecker();