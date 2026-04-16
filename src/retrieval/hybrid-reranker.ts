/**
 * Hybrid Reranker
 *
 * Routes between LocalReranker (small samples) and ConfidenceCalculator (large samples).
 */

import type { ConfidenceRetrievalResult, RerankingOutput } from './types.js';
import type { EnhancedRetrievalConfig } from './config.js';
import { DEFAULT_ENHANCED_RETRIEVAL_CONFIG } from './config.js';
import { LocalReranker, createLocalReranker } from './local-reranker.js';
import { ConfidenceCalculator, createConfidenceCalculator } from './confidence-calculator.js';

/**
 * Hybrid Reranker class
 */
export class HybridReranker {
  private config: EnhancedRetrievalConfig;
  private threshold: number;
  private localReranker: LocalReranker;
  private confidenceCalculator: ConfidenceCalculator;

  constructor(config?: Partial<EnhancedRetrievalConfig>) {
    this.config = { ...DEFAULT_ENHANCED_RETRIEVAL_CONFIG, ...config };
    this.threshold = this.config.rerankerThreshold; // 20 by default

    this.localReranker = createLocalReranker(this.config);
    this.confidenceCalculator = createConfidenceCalculator(this.config);
  }

  /**
   * Initialize the hybrid reranker
   */
  async initialize(): Promise<void> {
    console.log('[HybridReranker] Initializing with threshold:', this.threshold);

    // Initialize local reranker (may fail gracefully)
    await this.localReranker.initialize();

    console.log('[HybridReranker] Ready. Local reranker status:', this.localReranker.getStatus().status);
  }

  /**
   * Determine which reranker to use based on sample size
   */
  private determineMethod(resultCount: number): 'local-reranker' | 'internal-confidence' {
    if (resultCount <= this.threshold && this.localReranker.isReady()) {
      return 'local-reranker';
    }
    return 'internal-confidence';
  }

  /**
   * Rerank results using hybrid strategy
   */
  async rerank(
    query: string,
    results: ConfidenceRetrievalResult[]
  ): Promise<RerankingOutput> {
    const method = this.determineMethod(results.length);

    console.log('[HybridReranker] Reranking', results.length, 'results using', method);

    let rerankedResults: ConfidenceRetrievalResult[];
    let scores: number[];

    if (method === 'local-reranker') {
      // Use local model for small samples
      rerankedResults = await this.localReranker.rerankResults(query, results);
      scores = rerankedResults.map(r => r.confidenceScore);

    } else {
      // Use internal confidence calculator for large samples
      rerankedResults = this.confidenceCalculator.calculateAndApply(query, results);
      scores = rerankedResults.map(r => r.confidenceScore);
    }

    // Sort by confidence descending
    rerankedResults.sort((a, b) => b.confidenceScore - a.confidenceScore);

    return {
      results: rerankedResults,
      scores,
      method,
    };
  }

  /**
   * Rerank with custom threshold override
   */
  async rerankWithThreshold(
    query: string,
    results: ConfidenceRetrievalResult[],
    threshold?: number
  ): Promise<RerankingOutput> {
    const effectiveThreshold = threshold ?? this.threshold;
    const method = results.length <= effectiveThreshold && this.localReranker.isReady()
      ? 'local-reranker'
      : 'internal-confidence';

    let rerankedResults: ConfidenceRetrievalResult[];
    let scores: number[];

    if (method === 'local-reranker') {
      rerankedResults = await this.localReranker.rerankResults(query, results);
      scores = rerankedResults.map(r => r.confidenceScore);
    } else {
      rerankedResults = this.confidenceCalculator.calculateAndApply(query, results);
      scores = rerankedResults.map(r => r.confidenceScore);
    }

    rerankedResults.sort((a, b) => b.confidenceScore - a.confidenceScore);

    return { results: rerankedResults, scores, method };
  }

  /**
   * Get average confidence score from reranked results
   */
  getAverageConfidence(results: ConfidenceRetrievalResult[]): number {
    return this.confidenceCalculator.getAverageConfidence(results);
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
    return this.confidenceCalculator.getConfidenceDistribution(results);
  }

  /**
   * Check if local reranker is available
   */
  isLocalRerankerAvailable(): boolean {
    return this.localReranker.isReady();
  }

  /**
   * Get reranker status
   */
  getStatus(): {
    threshold: number;
    localRerankerReady: boolean;
    methodForSize: (size: number) => string;
  } {
    return {
      threshold: this.threshold,
      localRerankerReady: this.localReranker.isReady(),
      methodForSize: (size: number) => this.determineMethod(size),
    };
  }

  /**
   * Set threshold for routing
   */
  setThreshold(threshold: number): void {
    if (threshold < 10 || threshold > 50) {
      throw new Error('Threshold must be in range [10, 50]');
    }
    this.threshold = threshold;
    console.log('[HybridReranker] Threshold updated to:', threshold);
  }

  /**
   * Set custom confidence weights
   */
  setConfidenceWeights(weights: Partial<{
    similarity: number;
    keywordMatch: number;
    position: number;
    chunkQuality: number;
  }>): void {
    this.confidenceCalculator.setWeights(weights);
  }

  /**
   * Shutdown the reranker
   */
  async shutdown(): Promise<void> {
    console.log('[HybridReranker] Shutting down');
    await this.localReranker.shutdown();
  }

  /**
   * Get configuration
   */
  getConfig(): EnhancedRetrievalConfig {
    return { ...this.config };
  }
}

/**
 * Create hybrid reranker instance
 */
export function createHybridReranker(
  config?: Partial<EnhancedRetrievalConfig>
): HybridReranker {
  return new HybridReranker(config);
}