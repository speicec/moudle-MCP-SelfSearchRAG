/**
 * @spec reranker.md#精排
 * @layer 4
 * @description 重排实现
 */

import type { RecallResult, RerankedResult, RerankStrategy, ProcessedQuery } from '../interface';

export class RuleBasedReranker {
  private strategy: RerankStrategy = 'rule-based';

  // 规则权重
  private weights = {
    exactMatch: 2.0,
    keywordDensity: 0.5,
    freshness: 0.1,
    sourceQuality: 0.3
  };

  async rerank(
    query: ProcessedQuery,
    candidates: RecallResult[]
  ): Promise<RerankedResult[]> {
    const queryKeywords = query.parsed.keywords.core;

    const reranked = candidates.map(candidate => {
      const scores = {
        exactMatch: this.calculateExactMatchScore(queryKeywords, candidate.content),
        keywordDensity: this.calculateKeywordDensityScore(queryKeywords, candidate.content),
        freshness: 1.0, // 简化：假设所有内容新鲜
        sourceQuality: this.calculateSourceQualityScore(candidate.source)
      };

      // 加权计算最终分数
      const rerankScore =
        scores.exactMatch * this.weights.exactMatch +
        scores.keywordDensity * this.weights.keywordDensity +
        scores.freshness * this.weights.freshness +
        scores.sourceQuality * this.weights.sourceQuality;

      // 原始分数也考虑
      const finalScore = candidate.score * 0.3 + rerankScore * 0.7;

      return {
        ...candidate,
        rerankScore: finalScore,
        confidence: Math.min(1, finalScore / 3),
        relevanceReason: this.generateReason(scores)
      };
    });

    // 按重排分数排序
    reranked.sort((a, b) => b.rerankScore - a.rerankScore);

    return reranked;
  }

  getStrategy(): RerankStrategy {
    return this.strategy;
  }

  private calculateExactMatchScore(keywords: string[], content: string): number {
    const lowerContent = content.toLowerCase();
    const matches = keywords.filter(k => lowerContent.includes(k.toLowerCase()));
    return matches.length / Math.max(keywords.length, 1);
  }

  private calculateKeywordDensityScore(keywords: string[], content: string): number {
    if (keywords.length === 0) return 0;

    const lowerContent = content.toLowerCase();
    let totalCount = 0;

    for (const keyword of keywords) {
      const regex = new RegExp(keyword.toLowerCase(), 'g');
      const matches = lowerContent.match(regex);
      totalCount += matches ? matches.length : 0;
    }

    // 归一化（假设合理密度是每100字符出现1次）
    const expectedDensity = content.length / 100;
    return Math.min(1, totalCount / Math.max(expectedDensity, 1));
  }

  private calculateSourceQualityScore(source: string): number {
    // 简单质量评分
    if (source.endsWith('.md') || source.endsWith('.ts')) return 0.9;
    if (source.endsWith('.js') || source.endsWith('.py')) return 0.85;
    if (source.endsWith('.json')) return 0.7;
    return 0.8;
  }

  private generateReason(scores: Record<string, number>): string {
    const reasons: string[] = [];
    if (scores.exactMatch > 0.8) reasons.push('关键词高度匹配');
    if (scores.keywordDensity > 0.5) reasons.push('关键词密度高');
    if (scores.sourceQuality > 0.8) reasons.push('来源质量高');
    return reasons.length > 0 ? reasons.join('，') : '相关性一般';
  }
}

// RRF融合Reranker
export class RRFReranker {
  private k: number = 60;

  async rerank(
    multiPathResults: Map<string, RecallResult[]>
  ): Promise<RerankedResult[]> {
    const scoreMap = new Map<string, { result: RecallResult; score: number }>();

    for (const [, results] of multiPathResults) {
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const rank = i + 1;
        const rrfScore = 1 / (this.k + rank);

        const existing = scoreMap.get(result.chunkId);
        if (existing) {
          existing.score += rrfScore;
        } else {
          scoreMap.set(result.chunkId, { result, score: rrfScore });
        }
      }
    }

    // 按RRF分数排序
    const sorted = Array.from(scoreMap.values())
      .sort((a, b) => b.score - a.score);

    return sorted.map((item, i) => ({
      ...item.result,
      rerankScore: item.score,
      confidence: Math.min(1, item.score * 10),
      relevanceReason: `RRF排名 #${i + 1}`
    }));
  }
}

export const ruleBasedReranker = new RuleBasedReranker();
export const rrfReranker = new RRFReranker();