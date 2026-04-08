/**
 * @spec plugin-system.md#内置插件
 * @layer 1
 * @description 内置Embedder插件
 */

import { BasePlugin } from '../../interface';
import type { PluginDefinition } from '../../../types/index';
import type { IEmbedder, EmbeddingResult, BatchEmbeddingResult } from '../../../embedding/interface';

// Mock Embedder (用于测试)
class MockEmbedder extends BasePlugin implements IEmbedder {
  meta = {
    name: 'embedder:mock',
    version: '1.0.0',
    type: 'embedder' as const,
    compatibleVersions: ['1.x']
  };

  private dimensions: number = 384;

  constructor(dimensions: number = 384) {
    super();
    this.dimensions = dimensions;
  }

  async embed(text: string): Promise<EmbeddingResult> {
    // 生成伪向量（用于测试）
    const embedding = this.generateMockEmbedding(text);
    return {
      text,
      embedding,
      model: 'mock',
      dimensions: this.dimensions
    };
  }

  async embedBatch(texts: string[]): Promise<BatchEmbeddingResult> {
    const start = Date.now();
    const results = await Promise.all(texts.map(t => this.embed(t)));
    return {
      results,
      totalTokens: texts.reduce((sum, t) => sum + t.length, 0),
      duration: Date.now() - start
    };
  }

  getModelInfo(): { name: string; dimensions: number } {
    return { name: 'mock', dimensions: this.dimensions };
  }

  private generateMockEmbedding(text: string): number[] {
    // 基于文本hash生成伪向量
    const hash = this.hashString(text);
    const embedding: number[] = [];
    for (let i = 0; i < this.dimensions; i++) {
      embedding.push(Math.sin(hash + i) * 0.5);
    }
    return embedding;
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return hash;
  }
}

// API Embedder (调用外部API)
class APIEmbedder extends BasePlugin implements IEmbedder {
  meta = {
    name: 'embedder:api',
    version: '1.0.0',
    type: 'embedder' as const,
    compatibleVersions: ['1.x']
  };

  private endpoint: string;
  private apiKey: string;
  private model: string;
  private dimensions: number;

  constructor(config: { endpoint: string; apiKey: string; model: string; dimensions?: number }) {
    super();
    this.endpoint = config.endpoint;
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.dimensions = config.dimensions || 1536;
  }

  async embed(text: string): Promise<EmbeddingResult> {
    // 调用API
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({ input: text, model: this.model })
    });

    const data = await response.json() as { data?: { embedding?: number[] }[] };
    const embedding = data.data?.[0]?.embedding || [];

    return {
      text,
      embedding,
      model: this.model,
      dimensions: embedding.length
    };
  }

  async embedBatch(texts: string[]): Promise<BatchEmbeddingResult> {
    const start = Date.now();
    const results = await Promise.all(texts.map(t => this.embed(t)));
    return {
      results,
      totalTokens: texts.reduce((sum, t) => sum + t.length, 0),
      duration: Date.now() - start
    };
  }

  getModelInfo(): { name: string; dimensions: number } {
    return { name: this.model, dimensions: this.dimensions };
  }
}

// 插件定义
export const mockEmbedderDefinition: PluginDefinition = {
  meta: {
    name: 'embedder:mock',
    version: '1.0.0',
    type: 'embedder',
    compatibleVersions: ['1.x']
  },
  factory: () => new MockEmbedder()
};

export const apiEmbedderDefinition: PluginDefinition = {
  meta: {
    name: 'embedder:api',
    version: '1.0.0',
    type: 'embedder',
    compatibleVersions: ['1.x']
  },
  factory: (config: Record<string, unknown>) => new APIEmbedder(config as { endpoint: string; apiKey: string; model: string })
};

export { MockEmbedder, APIEmbedder };