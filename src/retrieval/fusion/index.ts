/**
 * @spec reranker.md#融合
 * @layer 4
 * @description 结果融合实现
 */

import type { RecallResult, FusionMethod } from '../interface';

export class ResultFusion {
  // RRF融合
  fuseWithRRF(
    multiQueryResults: Map<string, RecallResult[]>,
    k: number = 60
  ): RecallResult[] {
    const scoreMap = new Map<string, { result: RecallResult; score: number }>();

    for (const [, results] of multiQueryResults) {
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const rank = i + 1;
        const rrfScore = 1 / (k + rank);

        const existing = scoreMap.get(result.chunkId);
        if (existing) {
          existing.score += rrfScore;
        } else {
          scoreMap.set(result.chunkId, { result, score: rrfScore });
        }
      }
    }

    return Array.from(scoreMap.values())
      .sort((a, b) => b.score - a.score)
      .map(item => ({ ...item.result, score: item.score }));
  }

  // 加权融合
  fuseWithWeights(
    multiQueryResults: Map<string, RecallResult[]>,
    queryWeights: Map<string, number>
  ): RecallResult[] {
    const scoreMap = new Map<string, { result: RecallResult; score: number }>();

    for (const [queryId, results] of multiQueryResults) {
      const weight = queryWeights.get(queryId) || 1;

      for (const result of results) {
        const weightedScore = result.score * weight;

        const existing = scoreMap.get(result.chunkId);
        if (existing) {
          existing.score = Math.max(existing.score, weightedScore);
        } else {
          scoreMap.set(result.chunkId, { result, score: weightedScore });
        }
      }
    }

    return Array.from(scoreMap.values())
      .sort((a, b) => b.score - a.score)
      .map(item => ({ ...item.result, score: item.score }));
  }

  // 最大分数融合
  fuseWithMax(
    multiQueryResults: Map<string, RecallResult[]>
  ): RecallResult[] {
    const scoreMap = new Map<string, { result: RecallResult; maxScore: number }>();

    for (const [, results] of multiQueryResults) {
      for (const result of results) {
        const existing = scoreMap.get(result.chunkId);
        if (existing) {
          existing.maxScore = Math.max(existing.maxScore, result.score);
        } else {
          scoreMap.set(result.chunkId, { result, maxScore: result.score });
        }
      }
    }

    return Array.from(scoreMap.values())
      .sort((a, b) => b.maxScore - a.maxScore)
      .map(item => ({ ...item.result, score: item.maxScore }));
  }

  // 通用融合入口
  async fuse(
    multiQueryResults: Map<string, RecallResult[]>,
    method: FusionMethod,
    weights?: Map<string, number>
  ): Promise<RecallResult[]> {
    switch (method) {
      case 'rrf':
        return this.fuseWithRRF(multiQueryResults);

      case 'weighted':
        return this.fuseWithWeights(multiQueryResults, weights || new Map());

      case 'max':
        return this.fuseWithMax(multiQueryResults);

      default:
        return this.fuseWithRRF(multiQueryResults);
    }
  }
}

export const resultFusion = new ResultFusion();