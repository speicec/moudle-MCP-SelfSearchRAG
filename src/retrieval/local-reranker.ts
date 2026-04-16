/**
 * Local Reranker using bge-reranker-v2-m3
 *
 * Provides local reranking capability when sample count is small.
 * Falls back to mock inference when model is not available.
 */

import type { ConfidenceRetrievalResult } from './types.js';
import type { EnhancedRetrievalConfig } from './config.js';

export interface RerankRequest {
  query: string;
  documents: string[];
}

export interface RerankResult {
  index: number;
  score: number;
}

export interface LocalRerankerStatus {
  status: 'not_loaded' | 'loading' | 'ready' | 'error';
  model?: string;
  error?: string;
}

export interface LocalRerankerConfig {
  model: string;
  status: LocalRerankerStatus;
}

type InferenceFunction = (request: RerankRequest) => Promise<RerankResult[]>;

/**
 * Local Reranker class
 */
export class LocalReranker {
  private config: EnhancedRetrievalConfig;
  private inferenceFn: InferenceFunction | null = null;
  private status: LocalRerankerStatus = { status: 'not_loaded' };

  constructor(config: EnhancedRetrievalConfig) {
    this.config = config;
  }

  /**
   * Set custom inference function (for testing or custom model)
   */
  setInferenceFunction(fn: InferenceFunction): void {
    this.inferenceFn = fn;
  }

  /**
   * Initialize the reranker
   */
  async initialize(): Promise<void> {
    if (this.inferenceFn) {
      this.status = { status: 'ready', model: this.config.localRerankerModel };
      return;
    }

    // In production, this would load the actual model
    // For now, we'll use mock inference
    this.status = { status: 'ready', model: this.config.localRerankerModel };
    console.log('[LocalReranker] Initialized with mock inference (model not loaded)');
  }

  /**
   * Check if reranker is ready
   */
  isReady(): boolean {
    return this.status.status === 'ready' && this.inferenceFn !== null;
  }

  /**
   * Get current status
   */
  getStatus(): LocalRerankerStatus {
    return this.status;
  }

  /**
   * Get configuration
   */
  getConfig(): LocalRerankerConfig {
    return {
      model: this.config.localRerankerModel,
      status: this.status,
    };
  }

  /**
   * Rerank documents based on query
   */
  async rerank(query: string, documents: string[]): Promise<RerankResult[]> {
    if (documents.length === 0) {
      return [];
    }

    // Try to use custom inference function
    if (this.inferenceFn) {
      try {
        return await this.inferenceFn({ query, documents });
      } catch (error) {
        console.warn('[LocalReranker] Inference error, falling back to mock:', error);
      }
    }

    // Fall back to mock inference
    return this.mockInference(query, documents);
  }

  /**
   * Rerank ConfidenceRetrievalResults
   */
  async rerankResults(
    query: string,
    results: ConfidenceRetrievalResult[]
  ): Promise<ConfidenceRetrievalResult[]> {
    if (results.length === 0) {
      return [];
    }

    const documents = results.map(r => r.parentChunkContent || r.smallChunkContent);
    const scores = await this.rerank(query, documents);

    // Apply scores to results
    const scoredResults = results.map((result, i) => {
      const score = scores.find(s => s.index === i)?.score ?? this.mockScore(query, documents[i] ?? '');
      const level = this.getConfidenceLevel(score);

      return {
        ...result,
        confidenceScore: score,
        confidenceLevel: level,
      };
    });

    // Sort by confidence descending
    return scoredResults.sort((a, b) => (b.confidenceScore ?? 0) - (a.confidenceScore ?? 0));
  }

  /**
   * Mock inference based on keyword overlap
   */
  private mockInference(query: string, documents: string[]): RerankResult[] {
    return documents.map((doc, i) => ({
      index: i,
      score: this.mockScore(query, doc),
    }));
  }

  /**
   * Calculate mock score based on keyword overlap
   */
  private mockScore(query: string, document: string): number {
    if (!query || !document) {
      return 0.3;
    }

    const queryTerms = this.tokenize(query);
    const docTerms = this.tokenize(document);

    if (queryTerms.length === 0) {
      return 0.3;
    }

    // Count matching terms
    const matchCount = queryTerms.filter(t => docTerms.includes(t)).length;
    const matchRatio = matchCount / queryTerms.length;

    // Score based on match ratio: 0 matches = 0.3, full match = 0.9
    const baseScore = 0.3 + matchRatio * 0.6;

    // Ensure within bounds
    return Math.max(0.3, Math.min(1, baseScore));
  }

  /**
   * Simple tokenizer for Chinese and English
   * For Chinese: use character-based n-gram (2-3 chars)
   * For English: use word-based split
   */
  private tokenize(text: string): string[] {
    const result: string[] = [];

    // Split by whitespace and punctuation first
    const segments = text.toLowerCase().split(/[\s,，。！？!?.;；:：]+/);
    const nonEmptySegments = segments.filter(t => t.length > 0);

    for (const segment of nonEmptySegments) {
      // Check if segment is primarily Chinese characters
      const chineseCharCount = (segment.match(/\p{Script=Han}/gu) ?? []).length;

      if (chineseCharCount > segment.length * 0.5) {
        // Chinese text: use character n-gram for partial matching
        // 2-char grams for better recall
        for (let i = 0; i < segment.length - 1; i++) {
          const gram = segment.slice(i, i + 2);
          if (gram.length === 2) {
            result.push(gram);
          }
        }
      } else {
        // English/mixed: use word as-is
        result.push(segment);
      }
    }

    return result;
  }

  /**
   * Get confidence level from score
   */
  private getConfidenceLevel(score: number): 'high' | 'medium' | 'low' {
    if (score >= 0.7) return 'high';
    if (score >= 0.5) return 'medium';
    return 'low';
  }

  /**
   * Shutdown the reranker
   */
  async shutdown(): Promise<void> {
    this.inferenceFn = null;
    this.status = { status: 'not_loaded' };
    console.log('[LocalReranker] Shutdown complete');
  }
}

/**
 * Create a LocalReranker instance
 */
export function createLocalReranker(config?: Partial<EnhancedRetrievalConfig>): LocalReranker {
  const defaultConfig: EnhancedRetrievalConfig = {
    modelContextWindow: 64000,
    systemPromptTokens: 500,
    outputReservation: 12000,
    fillRatio: 0.6,
    overfetchRatio: 1.5,
    minConfidenceThreshold: 0.3,
    rerankerThreshold: 20,
    localRerankerModel: 'bge-reranker-v2-m3',
    enableDecomposition: true,
    enableRewrite: true,
    enableExpansion: true,
    maxSubQueries: 5,
    maxExpandedTerms: 5,
    confidenceWeights: {
      similarity: 0.5,
      keywordMatch: 0.2,
      position: 0.1,
      chunkQuality: 0.2,
    },
    queryCacheTTL: 300000,
    analysisCacheTTL: 300000,
    queryAnalysisTimeoutMs: 2000,
    queryRewriteTimeoutMs: 2000,
    queryDecomposeTimeoutMs: 3000,
  };

  return new LocalReranker({ ...defaultConfig, ...config });
}