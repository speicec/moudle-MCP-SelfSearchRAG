/**
 * Low Confidence Handler
 *
 * Handles low confidence retrieval results to prevent LLM hallucination.
 */

import type { ConfidenceRetrievalResult, NoMatchResult } from './types.js';
import type { EnhancedRetrievalConfig } from './config.js';
import { DEFAULT_ENHANCED_RETRIEVAL_CONFIG } from './config.js';

/**
 * Default suggestions for no-match scenarios
 */
const DEFAULT_SUGGESTIONS = [
  '请尝试使用其他关键词',
  '检查文档是否已正确索引',
  '简化查询问题后重试',
];

/**
 * Low Confidence Handler class
 */
export class LowConfidenceHandler {
  private config: EnhancedRetrievalConfig;
  private threshold: number;

  constructor(config?: Partial<EnhancedRetrievalConfig>) {
    this.config = { ...DEFAULT_ENHANCED_RETRIEVAL_CONFIG, ...config };
    this.threshold = this.config.minConfidenceThreshold; // 0.3 by default
  }

  /**
   * Calculate average similarity score
   */
  calculateAvgSimilarity(results: ConfidenceRetrievalResult[]): number {
    if (results.length === 0) return 0;

    const sum = results.reduce((acc, r) => acc + r.similarityScore, 0);
    return sum / results.length;
  }

  /**
   * Calculate average confidence score
   */
  calculateAvgConfidence(results: ConfidenceRetrievalResult[]): number {
    if (results.length === 0) return 0;

    const sum = results.reduce((acc, r) => acc + r.confidenceScore, 0);
    return sum / results.length;
  }

  /**
   * Check if results meet confidence threshold
   */
  check(results: ConfidenceRetrievalResult[]): NoMatchResult | null {
    // Calculate average confidence
    const avgConfidence = this.calculateAvgConfidence(results);

    console.log('[LowConfidenceHandler] Checking results:', {
      count: results.length,
      avgConfidence,
      threshold: this.threshold,
    });

    // If no results or average below threshold, return no-match
    if (results.length === 0 || avgConfidence < this.threshold) {
      return this.createNoMatchResult(avgConfidence);
    }

    // Results are acceptable
    return null;
  }

  /**
   * Check using similarity scores (fallback when confidence not calculated)
   */
  checkSimilarity(results: ConfidenceRetrievalResult[]): NoMatchResult | null {
    const avgSimilarity = this.calculateAvgSimilarity(results);

    console.log('[LowConfidenceHandler] Similarity check:', {
      count: results.length,
      avgSimilarity,
      threshold: this.threshold,
    });

    if (results.length === 0 || avgSimilarity < this.threshold) {
      return this.createNoMatchResult(avgSimilarity);
    }

    return null;
  }

  /**
   * Create no-match result
   */
  private createNoMatchResult(avgScore: number): NoMatchResult {
    return {
      status: 'no_match',
      message: this.getMessage(avgScore),
      suggestions: this.getSuggestions(avgScore),
    };
  }

  /**
   * Get appropriate message based on score
   */
  private getMessage(avgScore: number): string {
    if (avgScore < 0.1) {
      return '未找到与您问题相关的信息，可能文档库中不包含此类内容。';
    }
    if (avgScore < 0.2) {
      return '检索结果相关性较低，可能无法准确回答您的问题。';
    }
    return '未找到高置信度的相关结果，请尝试调整查询。';
  }

  /**
   * Get suggestions based on score
   */
  private getSuggestions(avgScore: number): string[] {
    if (avgScore < 0.1) {
      return [
        '请检查关键词是否正确',
        '尝试使用更通用的描述',
        ...DEFAULT_SUGGESTIONS,
      ];
    }
    return DEFAULT_SUGGESTIONS;
  }

  /**
   * Get threshold value
   */
  getThreshold(): number {
    return this.threshold;
  }

  /**
   * Set threshold value
   */
  setThreshold(threshold: number): void {
    if (threshold < 0.1 || threshold > 0.5) {
      throw new Error('Threshold must be in range [0.1, 0.5]');
    }
    this.threshold = threshold;
    console.log('[LowConfidenceHandler] Threshold updated to:', threshold);
  }

  /**
   * Check if a single result is above threshold
   */
  isResultAcceptable(result: ConfidenceRetrievalResult): boolean {
    return result.confidenceScore >= this.threshold;
  }

  /**
   * Filter results to only include those above threshold
   */
  filterAcceptableResults(results: ConfidenceRetrievalResult[]): ConfidenceRetrievalResult[] {
    return results.filter(r => this.isResultAcceptable(r));
  }

  /**
   * Get confidence level statistics
   */
  getStatistics(results: ConfidenceRetrievalResult[]): {
    total: number;
    acceptable: number;
    rejected: number;
    avgConfidence: number;
    avgSimilarity: number;
    threshold: number;
  } {
    const acceptable = this.filterAcceptableResults(results);

    return {
      total: results.length,
      acceptable: acceptable.length,
      rejected: results.length - acceptable.length,
      avgConfidence: this.calculateAvgConfidence(results),
      avgSimilarity: this.calculateAvgSimilarity(results),
      threshold: this.threshold,
    };
  }

  /**
   * Determine if should skip LLM generation
   */
  shouldSkipLLM(results: ConfidenceRetrievalResult[]): boolean {
    const noMatch = this.check(results);
    return noMatch !== null;
  }

  /**
   * Get configuration
   */
  getConfig(): EnhancedRetrievalConfig {
    return { ...this.config };
  }
}

/**
 * Create low confidence handler instance
 */
export function createLowConfidenceHandler(
  config?: Partial<EnhancedRetrievalConfig>
): LowConfidenceHandler {
  return new LowConfidenceHandler(config);
}