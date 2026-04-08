/**
 * @spec reranker.md
 * @layer 4
 * @description 检索层单元测试
 */

import { describe, it, expect } from 'vitest';
import { MultiPathRecall } from '../../src/retrieval/recall/index';
import { RuleBasedReranker, RRFReranker } from '../../src/retrieval/rerank/index';
import { ResultFusion } from '../../src/retrieval/fusion/index';
import type { RecallResult } from '../../src/retrieval/interface';

describe('MultiPathRecall', () => {
  const recall = new MultiPathRecall();

  it('should merge recall results', async () => {
    const results = new Map<string, RecallResult[]>();
    results.set('vector', [
      { chunkId: '1', docId: 'doc1', content: 'content 1', source: 'test.ts', score: 0.9, recallPath: 'vector', metadata: { type: 'text' } },
      { chunkId: '2', docId: 'doc1', content: 'content 2', source: 'test.ts', score: 0.8, recallPath: 'vector', metadata: { type: 'text' } }
    ]);
    results.set('fulltext', [
      { chunkId: '2', docId: 'doc1', content: 'content 2', source: 'test.ts', score: 0.7, recallPath: 'fulltext', metadata: { type: 'text' } },
      { chunkId: '3', docId: 'doc1', content: 'content 3', source: 'test.ts', score: 0.6, recallPath: 'fulltext', metadata: { type: 'text' } }
    ]);

    const merged = await recall.mergeRecalls(results, { vector: { enabled: true, topK: 10, threshold: 0.5 } });

    // Should deduplicate by chunkId
    expect(merged.length).toBe(3);
    // Should be sorted by score
    expect(merged[0].score).toBeGreaterThanOrEqual(merged[merged.length - 1].score);
  });
});

describe('RuleBasedReranker', () => {
  const reranker = new RuleBasedReranker();

  it('should rerank candidates', async () => {
    const candidates: RecallResult[] = [
      { chunkId: '1', docId: 'doc1', content: 'RAG system implementation', source: 'test.ts', score: 0.8, recallPath: 'vector', metadata: { type: 'text' } },
      { chunkId: '2', docId: 'doc1', content: 'Vector database design', source: 'test.ts', score: 0.7, recallPath: 'vector', metadata: { type: 'text' } }
    ];

    const query = {
      parsed: {
        raw: 'RAG implementation',
        intent: 'how-to' as const,
        intentConfidence: 0.9,
        keywords: { core: ['RAG', 'implementation'], related: [], excluded: [] },
        semantic: {},
        complexity: { level: 'simple' as const, score: 2, reasons: [] },
        modality: 'text' as const,
        language: 'en'
      },
      route: { strategy: 'single-hop' as const, reason: '', estimatedResources: { retrievalPaths: 1, maxCandidates: 20, estimatedTokens: 500, estimatedLatency: 100 } },
      queries: [],
      executionPlan: { phases: [] }
    };

    const result = await reranker.rerank(query, candidates);

    expect(result.length).toBe(2);
    expect(result[0].rerankScore).toBeDefined();
    expect(result[0].confidence).toBeDefined();
    // Should be sorted by rerankScore
    expect(result[0].rerankScore).toBeGreaterThanOrEqual(result[1].rerankScore);
  });

  it('should boost exact matches', async () => {
    const candidates: RecallResult[] = [
      { chunkId: '1', docId: 'doc1', content: 'exact match keywords here', source: 'test.ts', score: 0.7, recallPath: 'vector', metadata: { type: 'text' } },
      { chunkId: '2', docId: 'doc1', content: 'no related terms', source: 'test.ts', score: 0.7, recallPath: 'vector', metadata: { type: 'text' } }
    ];

    const query = {
      parsed: {
        raw: 'exact match',
        intent: 'definition' as const,
        intentConfidence: 0.9,
        keywords: { core: ['exact', 'match'], related: [], excluded: [] },
        semantic: {},
        complexity: { level: 'simple' as const, score: 1, reasons: [] },
        modality: 'text' as const,
        language: 'en'
      },
      route: { strategy: 'single-hop' as const, reason: '', estimatedResources: { retrievalPaths: 1, maxCandidates: 20, estimatedTokens: 500, estimatedLatency: 100 } },
      queries: [],
      executionPlan: { phases: [] }
    };

    const result = await reranker.rerank(query, candidates);

    // First result should have higher score due to exact match
    expect(result[0].chunkId).toBe('1');
  });

  it('should return rule-based strategy', () => {
    expect(reranker.getStrategy()).toBe('rule-based');
  });
});

describe('RRFReranker', () => {
  const reranker = new RRFReranker();

  it('should fuse multiple result sets with RRF', async () => {
    const multiResults = new Map<string, RecallResult[]>();
    multiResults.set('query1', [
      { chunkId: '1', docId: 'doc1', content: 'content 1', source: 'test.ts', score: 0.9, recallPath: 'vector', metadata: { type: 'text' } },
      { chunkId: '2', docId: 'doc1', content: 'content 2', source: 'test.ts', score: 0.8, recallPath: 'vector', metadata: { type: 'text' } }
    ]);
    multiResults.set('query2', [
      { chunkId: '2', docId: 'doc1', content: 'content 2', source: 'test.ts', score: 0.95, recallPath: 'vector', metadata: { type: 'text' } },
      { chunkId: '3', docId: 'doc1', content: 'content 3', source: 'test.ts', score: 0.85, recallPath: 'vector', metadata: { type: 'text' } }
    ]);

    const result = await reranker.rerank(multiResults);

    expect(result.length).toBe(3);
    // Chunk 2 appears in both queries, should have higher RRF score
    expect(result.find(r => r.chunkId === '2')?.rerankScore).toBeGreaterThan(
      result.find(r => r.chunkId === '3')?.rerankScore || 0
    );
  });
});

describe('ResultFusion', () => {
  const fusion = new ResultFusion();

  it('should fuse with RRF method', async () => {
    const multiResults = new Map<string, RecallResult[]>();
    multiResults.set('path1', [
      { chunkId: '1', docId: 'doc1', content: 'content 1', source: 'test.ts', score: 0.9, recallPath: 'vector', metadata: { type: 'text' } }
    ]);
    multiResults.set('path2', [
      { chunkId: '1', docId: 'doc1', content: 'content 1', source: 'test.ts', score: 0.8, recallPath: 'fulltext', metadata: { type: 'text' } },
      { chunkId: '2', docId: 'doc1', content: 'content 2', source: 'test.ts', score: 0.7, recallPath: 'fulltext', metadata: { type: 'text' } }
    ]);

    const result = await fusion.fuse(multiResults, 'rrf');

    expect(result.length).toBe(2);
    // Deduped by chunkId
    expect(result.filter(r => r.chunkId === '1').length).toBe(1);
  });

  it('should fuse with max method', async () => {
    const multiResults = new Map<string, RecallResult[]>();
    multiResults.set('path1', [
      { chunkId: '1', docId: 'doc1', content: 'content 1', source: 'test.ts', score: 0.5, recallPath: 'vector', metadata: { type: 'text' } }
    ]);
    multiResults.set('path2', [
      { chunkId: '1', docId: 'doc1', content: 'content 1', source: 'test.ts', score: 0.9, recallPath: 'fulltext', metadata: { type: 'text' } }
    ]);

    const result = await fusion.fuse(multiResults, 'max');

    expect(result.length).toBe(1);
    expect(result[0].score).toBe(0.9); // Max score
  });

  it('should fuse with weighted method', async () => {
    const multiResults = new Map<string, RecallResult[]>();
    multiResults.set('vector', [
      { chunkId: '1', docId: 'doc1', content: 'content 1', source: 'test.ts', score: 0.8, recallPath: 'vector', metadata: { type: 'text' } }
    ]);
    multiResults.set('fulltext', [
      { chunkId: '1', docId: 'doc1', content: 'content 1', source: 'test.ts', score: 0.6, recallPath: 'fulltext', metadata: { type: 'text' } }
    ]);

    const weights = new Map([['vector', 0.8], ['fulltext', 0.2]]);
    const result = await fusion.fuse(multiResults, 'weighted', weights);

    expect(result.length).toBe(1);
    // Weighted score should be max(0.8 * 0.8, 0.6 * 0.2) = 0.64
    expect(result[0].score).toBeCloseTo(0.64, 1);
  });
});