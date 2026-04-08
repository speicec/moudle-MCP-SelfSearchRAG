/**
 * @spec reranker.md#召回
 * @layer 4
 * @description 多路召回实现
 */

import type { SearchResult } from '../../types/index';
import type {
  RecallConfig,
  RecallResult,
  RecallPath,
  ProcessedQuery
} from '../interface';

export class MultiPathRecall {
  // 向量召回
  async vectorRecall(
    queryEmbedding: number[],
    topK: number,
    vectorStore: { search: (v: number[], k: number) => Promise<SearchResult[]> }
  ): Promise<RecallResult[]> {
    const results = await vectorStore.search(queryEmbedding, topK);
    return results.map(r => ({
      chunkId: r.chunkId,
      docId: r.docId,
      content: r.content,
      source: r.source,
      score: r.score,
      recallPath: 'vector' as RecallPath,
      metadata: r.metadata
    }));
  }

  // 全文召回
  async fulltextRecall(
    queryText: string,
    topK: number,
    fulltextStore: { search: (q: string, k: number) => Promise<SearchResult[]> }
  ): Promise<RecallResult[]> {
    const results = await fulltextStore.search(queryText, topK);
    return results.map(r => ({
      chunkId: r.chunkId,
      docId: r.docId,
      content: r.content,
      source: r.source,
      score: r.score,
      recallPath: 'fulltext' as RecallPath,
      metadata: r.metadata
    }));
  }

  // 代码召回（简化实现）
  async codeRecall(
    query: string,
    topK: number,
    vectorStore: { search: (v: number[], k: number) => Promise<SearchResult[]> },
    embedder?: { embed: (t: string) => Promise<number[]> }
  ): Promise<RecallResult[]> {
    if (!embedder) return [];

    const queryEmbedding = await embedder.embed(query);
    const results = await vectorStore.search(queryEmbedding, topK);

    return results
      .filter(r => r.metadata?.type === 'code')
      .map(r => ({
        chunkId: r.chunkId,
        docId: r.docId,
        content: r.content,
        source: r.source,
        score: r.score,
        recallPath: 'code' as RecallPath,
        metadata: r.metadata
      }));
  }

  // 多路召回合并
  async mergeRecalls(
    results: Map<RecallPath, RecallResult[]>,
    config: RecallConfig
  ): Promise<RecallResult[]> {
    const allResults: RecallResult[] = [];

    // 合并所有路径的结果
    for (const [, pathResults] of results) {
      allResults.push(...pathResults);
    }

    // 去重（按chunkId）
    const seen = new Set<string>();
    const unique: RecallResult[] = [];

    for (const result of allResults) {
      if (!seen.has(result.chunkId)) {
        seen.add(result.chunkId);
        unique.push(result);
      }
    }

    // 按分数排序
    unique.sort((a, b) => b.score - a.score);

    // 返回top candidates
    const maxCandidates = (config.vector?.topK || 20) * 2;
    return unique.slice(0, maxCandidates);
  }
}

export const multiPathRecall = new MultiPathRecall();