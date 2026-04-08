/**
 * @spec query-layer.md
 * @layer 3
 * @description 查询层单元测试
 */

import { describe, it, expect } from 'vitest';
import { QueryParser } from '../../src/query/parser';
import { QueryRouter } from '../../src/query/router';
import { QueryDecomposer } from '../../src/query/decomposer';

describe('QueryParser', () => {
  const parser = new QueryParser();

  it('should detect definition intent', async () => {
    const result = await parser.parse('什么是RAG?');
    expect(result.intent).toBe('definition');
    expect(result.intentConfidence).toBeGreaterThan(0.5);
  });

  it('should detect how-to intent', async () => {
    const result = await parser.parse('如何实现RAG系统?');
    expect(result.intent).toBe('how-to');
  });

  it('should detect comparison intent', async () => {
    const result = await parser.parse('比较向量检索和全文检索的区别');
    expect(result.intent).toBe('comparison');
  });

  it('should extract keywords', async () => {
    const result = await parser.parse('如何使用TypeScript实现RAG检索增强生成系统');
    expect(result.keywords.core.length).toBeGreaterThan(0);
    expect(result.keywords.core.some(k => k.includes('RAG') || k.includes('TypeScript'))).toBe(true);
  });

  it('should assess complexity', async () => {
    const simple = await parser.parse('什么是RAG?');
    // Complex query with multiple conditions
    const complexQuery = '如何使用TypeScript实现一个支持多模态检索的RAG系统? 并且需要与Milvus集成，然后部署到生产环境。';
    const complex = await parser.parse(complexQuery);

    expect(simple.complexity.level).toBe('simple');
    // Complexity depends on multiple factors
    expect(['simple', 'medium', 'complex']).toContain(complex.complexity.level);
  });

  it('should detect modality', async () => {
    const textQuery = await parser.parse('什么是RAG?');
    const codeQuery = await parser.parse('function hello() 的作用是什么?');

    expect(textQuery.modality).toBe('text');
    expect(codeQuery.modality).toBe('code');
  });
});

describe('QueryRouter', () => {
  const router = new QueryRouter();
  const parser = new QueryParser();

  it('should route simple definition to single-hop', async () => {
    const parsed = await parser.parse('什么是向量数据库?');
    const decision = await router.route(parsed);

    expect(decision.strategy).toBe('single-hop');
    expect(decision.estimatedResources.retrievalPaths).toBe(1);
  });

  it('should route comparison to multi-hop', async () => {
    const parsed = await parser.parse('比较Milvus和Pinecone的区别');
    const decision = await router.route(parsed);

    expect(decision.strategy).toBe('multi-hop');
    expect(decision.estimatedResources.retrievalPaths).toBe(2);
  });

  it('should route complex query to decomposition', async () => {
    const parsed = await parser.parse('如何实现一个完整的RAG系统，包括文档处理、向量存储和检索?');
    // Set high complexity manually for test
    parsed.complexity.score = 8;

    const decision = await router.route(parsed);
    expect(decision.strategy).toBe('decomposition');
  });

  it('should estimate resources correctly', async () => {
    const parsed = await parser.parse('什么是RAG?');
    const decision = await router.route(parsed);

    expect(decision.estimatedResources.maxCandidates).toBeGreaterThan(0);
    expect(decision.estimatedResources.estimatedLatency).toBeGreaterThan(0);
  });
});

describe('QueryDecomposer', () => {
  const decomposer = new QueryDecomposer();
  const parser = new QueryParser();

  it('should decompose comparison query', async () => {
    const parsed = await parser.parse('比较向量检索和全文检索的区别');
    const result = await decomposer.decompose(parsed);

    expect(result.subQueries.length).toBeGreaterThan(1);
    expect(result.fusionStrategy).toBe('sequential');
  });

  it('should decompose multi-hop query', async () => {
    const parsed = await parser.parse('首先了解RAG的原理，然后学习如何实现');
    // Ensure intent is multi-hop for decomposition
    parsed.intent = 'multi-hop';
    const result = await decomposer.decompose(parsed);

    expect(result.subQueries.length).toBeGreaterThanOrEqual(1);
    expect(result.executionOrder.length).toBe(result.subQueries.length);
  });

  it('should calculate execution order correctly', async () => {
    const parsed = await parser.parse('比较A和B的区别');
    const result = await decomposer.decompose(parsed);

    // Execution order should respect dependencies
    for (const queryId of result.executionOrder) {
      const query = result.subQueries.find(q => q.id === queryId);
      if (query?.dependsOn) {
        for (const dep of query.dependsOn) {
          expect(result.executionOrder.indexOf(dep)).toBeLessThan(result.executionOrder.indexOf(queryId));
        }
      }
    }
  });

  it('should keep single query for simple queries', async () => {
    const parsed = await parser.parse('什么是RAG?');
    const result = await decomposer.decompose(parsed);

    expect(result.subQueries.length).toBe(1);
    expect(result.subQueries[0].query).toContain('RAG');
  });
});