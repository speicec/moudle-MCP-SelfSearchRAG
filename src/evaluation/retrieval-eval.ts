/**
 * @spec evaluation.md#检索评估
 * @layer 4
 * @description 检索评估器实现
 */

import type {
  EvaluationQuery,
  RetrievalMetrics,
  IRetrievalEvaluator
} from './interface';

export interface RetrievalEvaluatorConfig {
  metrics?: ('hit_rate' | 'mrr' | 'ndcg' | 'precision' | 'recall')[];
  kValues?: number[];
}

export class RetrievalEvaluator implements IRetrievalEvaluator {
  private metrics: string[];
  private kValues: number[];

  constructor(config?: RetrievalEvaluatorConfig) {
    this.metrics = config?.metrics || ['hit_rate', 'mrr', 'ndcg'];
    this.kValues = config?.kValues || [1, 5, 10, 20];
  }

  async evaluate(
    queries: EvaluationQuery[],
    results: Array<{ query: string; retrievedIds: string[] }>
  ): Promise<RetrievalMetrics> {
    const details: RetrievalMetrics['details'] = [];
    const hitRateCounts = new Map<number, number>();
    const precisionSums = new Map<number, number>();
    const recallSums = new Map<number, number>();
    const dcgSums = new Map<number, number>();
    const idcgSums = new Map<number, number>();
    let mrrSum = 0;

    // Initialize counts
    for (const k of this.kValues) {
      hitRateCounts.set(k, 0);
      precisionSums.set(k, 0);
      recallSums.set(k, 0);
      dcgSums.set(k, 0);
      idcgSums.set(k, 0);
    }

    for (let i = 0; i < queries.length; i++) {
      const query = queries[i];
      const result = results[i];
      const expected = new Set(query.expectedDocIds);
      const retrieved = result.retrievedIds;

      // Find rank of first relevant document
      let hit = false;
      let rank = -1;
      for (let j = 0; j < retrieved.length; j++) {
        if (expected.has(retrieved[j])) {
          if (!hit) {
            rank = j + 1;
            hit = true;
          }
        }
      }

      details.push({
        query: query.query,
        retrieved: retrieved.slice(0, 10),
        expected: query.expectedDocIds,
        hit,
        rank
      });

      // Calculate metrics for each k
      for (const k of this.kValues) {
        const topK = retrieved.slice(0, k);
        const hitsInTopK = topK.filter(id => expected.has(id)).length;

        // Hit rate
        if (hitsInTopK > 0) {
          hitRateCounts.set(k, hitRateCounts.get(k)! + 1);
        }

        // Precision@k
        const precision = hitsInTopK / k;
        precisionSums.set(k, precisionSums.get(k)! + precision);

        // Recall@k
        const recall = expected.size > 0 ? hitsInTopK / expected.size : 0;
        recallSums.set(k, recallSums.get(k)! + recall);

        // DCG@k
        let dcg = 0;
        for (let j = 0; j < topK.length; j++) {
          if (expected.has(topK[j])) {
            dcg += 1 / Math.log2(j + 2);
          }
        }
        dcgSums.set(k, dcgSums.get(k)! + dcg);

        // IDCG@k (ideal DCG)
        const idealHits = Math.min(expected.size, k);
        let idcg = 0;
        for (let j = 0; j < idealHits; j++) {
          idcg += 1 / Math.log2(j + 2);
        }
        idcgSums.set(k, idcgSums.get(k)! + idcg);
      }

      // MRR
      if (rank > 0) {
        mrrSum += 1 / rank;
      }
    }

    // Calculate final metrics
    const hitRate = new Map<number, number>();
    const precision = new Map<number, number>();
    const recall = new Map<number, number>();
    const ndcg = new Map<number, number>();

    for (const k of this.kValues) {
      hitRate.set(k, hitRateCounts.get(k)! / queries.length);
      precision.set(k, precisionSums.get(k)! / queries.length);
      recall.set(k, recallSums.get(k)! / queries.length);

      const dcgSum = dcgSums.get(k)!;
      const idcgSum = idcgSums.get(k)!;
      ndcg.set(k, idcgSum > 0 ? dcgSum / idcgSum : 0);
    }

    const mrr = queries.length > 0 ? mrrSum / queries.length : 0;

    return {
      hitRate,
      mrr,
      ndcg,
      precision,
      recall,
      details
    };
  }
}

export const retrievalEvaluator = new RetrievalEvaluator();