/**
 * Confidence Calculator
 *
 * Calculates internal confidence scores for retrieval results (used for large sample scenarios).
 */

import type { ConfidenceWeights, ConfidenceRetrievalResult } from './types.js';
import type { EnhancedRetrievalConfig } from './config.js';
import { DEFAULT_ENHANCED_RETRIEVAL_CONFIG, DEFAULT_CONFIDENCE_WEIGHTS } from './config.js';
import { determineConfidenceLevel } from './types.js';

/**
 * Keyword extraction utility (simple implementation)
 */
function extractKeywords(text: string): Set<string> {
  // Simple keyword extraction: split by whitespace and punctuation
  const words = text.toLowerCase()
    .replace(/[^\w\s\u4e00-\u9fa5]/g, ' ') // Keep Chinese characters
    .split(/\s+/)
    .filter(w => w.length > 1);

  return new Set(words);
}

/**
 * Calculate Jaccard similarity between keyword sets
 */
function jaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 && setB.size === 0) return 0;

  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);

  return intersection.size / union.size;
}

/**
 * Confidence Calculator class
 */
export class ConfidenceCalculator {
  private config: EnhancedRetrievalConfig;
  private weights: ConfidenceWeights;
  private queryKeywordsCache: Map<string, Set<string>> = new Map();

  constructor(config?: Partial<EnhancedRetrievalConfig>) {
    this.config = { ...DEFAULT_ENHANCED_RETRIEVAL_CONFIG, ...config };
    this.weights = this.config.confidenceWeights;
  }

  /**
   * Calculate confidence scores for multiple results
   */
  calculate(
    query: string,
    results: ConfidenceRetrievalResult[]
  ): number[] {
    // Extract query keywords once
    const queryKeywords = this.getQueryKeywords(query);

    const scores: number[] = [];
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (!result) continue;
      const score = this.calculateSingle(query, queryKeywords, result, i, results.length);
      scores.push(score);
    }

    console.log('[ConfidenceCalculator] Calculated scores:', {
      count: scores.length,
      avg: scores.reduce((a, b) => a + b, 0) / scores.length,
      min: Math.min(...scores),
      max: Math.max(...scores),
    });

    return scores;
  }

  /**
   * Calculate confidence score for a single result
   */
  private calculateSingle(
    query: string,
    queryKeywords: Set<string>,
    result: ConfidenceRetrievalResult,
    position: number,
    totalResults: number
  ): number {
    // Calculate individual scores
    const similarityScore = this.calculateSimilarityScore(result);
    const keywordMatchScore = this.calculateKeywordMatchScore(queryKeywords, result);
    const positionScore = this.calculatePositionScore(position, totalResults);
    const chunkQualityScore = this.calculateChunkQualityScore(result);

    // Weighted combination
    const confidence = (
      this.weights.similarity * similarityScore +
      this.weights.keywordMatch * keywordMatchScore +
      this.weights.position * positionScore +
      this.weights.chunkQuality * chunkQualityScore
    );

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Calculate similarity score component
   */
  private calculateSimilarityScore(result: ConfidenceRetrievalResult): number {
    // Use existing similarity score directly
    return result.similarityScore;
  }

  /**
   * Calculate keyword match score using Jaccard similarity
   */
  private calculateKeywordMatchScore(
    queryKeywords: Set<string>,
    result: ConfidenceRetrievalResult
  ): number {
    // Extract keywords from result content
    const contentKeywords = extractKeywords(
      result.parentChunkContent || result.smallChunkContent
    );

    return jaccardSimilarity(queryKeywords, contentKeywords);
  }

  /**
   * Calculate position score (earlier results score higher)
   */
  private calculatePositionScore(position: number, totalResults: number): number {
    if (totalResults <= 1) return 1;

    // Linear decay: position 0 = 1.0, last position = 0.5
    const normalizedPosition = position / (totalResults - 1);
    return 1 - normalizedPosition * 0.5;
  }

  /**
   * Calculate chunk quality score from quality metadata
   */
  private calculateChunkQualityScore(result: ConfidenceRetrievalResult): number {
    // Use chunk quality if available, otherwise use similarity as proxy
    if (result.chunkQualityScore > 0) {
      return result.chunkQualityScore;
    }

    // Fallback: estimate from metadata
    const boundaryConfidence = result.metadata?.boundaryConfidence ?? 0.5;
    return boundaryConfidence;
  }

  /**
   * Get cached query keywords
   */
  private getQueryKeywords(query: string): Set<string> {
    const cached = this.queryKeywordsCache.get(query);
    if (cached) return cached;

    const keywords = extractKeywords(query);
    this.queryKeywordsCache.set(query, keywords);
    return keywords;
  }

  /**
   * Apply confidence scores to results
   */
  applyScores(
    results: ConfidenceRetrievalResult[],
    scores: number[]
  ): ConfidenceRetrievalResult[] {
    return results.map((result, index) => {
      const score = scores[index] ?? 0;
      return {
        ...result,
        confidenceScore: score,
        confidenceLevel: determineConfidenceLevel(score),
      };
    });
  }

  /**
   * Calculate and apply scores to results
   */
  calculateAndApply(
    query: string,
    results: ConfidenceRetrievalResult[]
  ): ConfidenceRetrievalResult[] {
    const scores = this.calculate(query, results);
    return this.applyScores(results, scores);
  }

  /**
   * Sort results by confidence score descending
   */
  sortByConfidence(results: ConfidenceRetrievalResult[]): ConfidenceRetrievalResult[] {
    return [...results].sort((a, b) => b.confidenceScore - a.confidenceScore);
  }

  /**
   * Get average confidence score
   */
  getAverageConfidence(results: ConfidenceRetrievalResult[]): number {
    if (results.length === 0) return 0;
    return results.reduce((sum, r) => sum + r.confidenceScore, 0) / results.length;
  }

  /**
   * Get confidence distribution
   */
  getConfidenceDistribution(results: ConfidenceRetrievalResult[]): {
    high: number;
    medium: number;
    low: number;
    avg: number;
  } {
    const distribution = {
      high: 0,
      medium: 0,
      low: 0,
      avg: this.getAverageConfidence(results),
    };

    for (const result of results) {
      if (result.confidenceLevel === 'high') distribution.high++;
      else if (result.confidenceLevel === 'medium') distribution.medium++;
      else distribution.low++;
    }

    return distribution;
  }

  /**
   * Clear keyword cache
   */
  clearCache(): void {
    this.queryKeywordsCache.clear();
  }

  /**
   * Get weights configuration
   */
  getWeights(): ConfidenceWeights {
    return { ...this.weights };
  }

  /**
   * Set custom weights
   */
  setWeights(weights: Partial<ConfidenceWeights>): void {
    // Validate weights sum to 1
    const newWeights = { ...this.weights, ...weights };
    const sum = Object.values(newWeights).reduce((a, b) => a + b, 0);

    if (Math.abs(sum - 1) > 0.01) {
      throw new Error(`Confidence weights must sum to 1, current sum: ${sum}`);
    }

    this.weights = newWeights;
  }

  /**
   * Get configuration
   */
  getConfig(): EnhancedRetrievalConfig {
    return { ...this.config };
  }
}

/**
 * Create confidence calculator instance
 */
export function createConfidenceCalculator(
  config?: Partial<EnhancedRetrievalConfig>
): ConfidenceCalculator {
  return new ConfidenceCalculator(config);
}