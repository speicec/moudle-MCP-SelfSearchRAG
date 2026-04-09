import type { SearchResult, QueryOptions } from '../core/types.js';
import type { VectorStore } from './vector-store.js';
import type { EmbeddingResult } from '../core/context.js';

/**
 * Search engine interface
 */
export interface SearchEngine {
  /**
   * Search for results matching query
   */
  search(query: string, options?: QueryOptions): Promise<SearchResult[]>;

  /**
   * Search by embedding vector
   */
  searchByVector(vector: number[], options?: QueryOptions): Promise<SearchResult[]>;
}

/**
 * Hybrid search weights
 */
export interface HybridWeights {
  semantic: number;
  keyword: number;
}

/**
 * Default hybrid weights
 */
export const DEFAULT_HYBRID_WEIGHTS: HybridWeights = {
  semantic: 0.7,
  keyword: 0.3,
};

/**
 * Semantic search engine
 */
export class SemanticSearchEngine implements SearchEngine {
  private vectorStore: VectorStore;
  private embedder: (text: string) => Promise<number[]>;

  constructor(
    vectorStore: VectorStore,
    embedder: (text: string) => Promise<number[]>
  ) {
    this.vectorStore = vectorStore;
    this.embedder = embedder;
  }

  /**
   * Search by text query
   */
  async search(query: string, options?: QueryOptions): Promise<SearchResult[]> {
    const vector = await this.embedder(query);
    return this.searchByVector(vector, options);
  }

  /**
   * Search by embedding vector
   */
  async searchByVector(vector: number[], options?: QueryOptions): Promise<SearchResult[]> {
    return this.vectorStore.search(vector, options);
  }
}

/**
 * Keyword search engine
 */
export class KeywordSearchEngine implements SearchEngine {
  private vectorStore: VectorStore;
  private chunks: Map<string, string> = new Map();

  constructor(vectorStore: VectorStore) {
    this.vectorStore = vectorStore;
  }

  /**
   * Register chunk content for keyword matching
   */
  registerChunk(id: string, content: string): void {
    this.chunks.set(id, content.toLowerCase());
  }

  /**
   * Search by text query using keyword matching
   */
  async search(query: string, options?: QueryOptions): Promise<SearchResult[]> {
    const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 0);
    const results: SearchResult[] = [];
    const topK = options?.topK ?? 10;

    for (const [id, content] of this.chunks) {
      const score = this.calculateKeywordScore(terms, content);

      if (score > 0) {
        results.push({
          id,
          score,
          content: '', // Content would be fetched
          sourceDocumentId: id.split('_')[0] ?? '',
          modality: 'text',
          metadata: {},
        });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  /**
   * Search by vector (not applicable for keyword search)
   */
  async searchByVector(_vector: number[], _options?: QueryOptions): Promise<SearchResult[]> {
    // Keyword search doesn't support vector queries
    return [];
  }

  /**
   * Calculate keyword match score
   */
  private calculateKeywordScore(terms: string[], content: string): number {
    let score = 0;

    for (const term of terms) {
      const regex = new RegExp(term, 'gi');
      const matches = content.match(regex);
      if (matches) {
        // BM25-inspired scoring
        const tf = matches.length;
        const docLength = content.split(/\s+/).length;
        score += (tf * 2.5) / (tf + 1.2 * (docLength / 100));
      }
    }

    return score / terms.length;
  }
}

/**
 * Hybrid search engine combining semantic and keyword
 */
export class HybridSearchEngine implements SearchEngine {
  private semanticEngine: SemanticSearchEngine;
  private keywordEngine: KeywordSearchEngine;
  private weights: HybridWeights;

  constructor(
    semanticEngine: SemanticSearchEngine,
    keywordEngine: KeywordSearchEngine,
    weights?: HybridWeights
  ) {
    this.semanticEngine = semanticEngine;
    this.keywordEngine = keywordEngine;
    this.weights = weights ?? DEFAULT_HYBRID_WEIGHTS;
  }

  /**
   * Search using hybrid approach
   */
  async search(query: string, options?: QueryOptions): Promise<SearchResult[]> {
    // Run both searches in parallel
    const [semanticResults, keywordResults] = await Promise.all([
      this.semanticEngine.search(query, options),
      this.keywordEngine.search(query, options),
    ]);

    // Merge and rank results
    return this.mergeResults(semanticResults, keywordResults);
  }

  /**
   * Search by vector (semantic only)
   */
  async searchByVector(vector: number[], options?: QueryOptions): Promise<SearchResult[]> {
    return this.semanticEngine.searchByVector(vector, options);
  }

  /**
   * Merge semantic and keyword results
   */
  private mergeResults(
    semantic: SearchResult[],
    keyword: SearchResult[]
  ): SearchResult[] {
    const merged = new Map<string, SearchResult>();

    // Add semantic results
    for (const result of semantic) {
      merged.set(result.id, {
        ...result,
        score: result.score * this.weights.semantic,
      });
    }

    // Add/merge keyword results
    for (const result of keyword) {
      const existing = merged.get(result.id);

      if (existing) {
        // Combine scores
        existing.score += result.score * this.weights.keyword;
      } else {
        merged.set(result.id, {
          ...result,
          score: result.score * this.weights.keyword,
        });
      }
    }

    // Sort by combined score
    const results = Array.from(merged.values());
    results.sort((a, b) => b.score - a.score);

    return results;
  }

  /**
   * Update search weights
   */
  setWeights(weights: HybridWeights): void {
    this.weights = weights;
  }
}

/**
 * Create semantic search engine
 */
export function createSemanticSearchEngine(
  vectorStore: VectorStore,
  embedder: (text: string) => Promise<number[]>
): SemanticSearchEngine {
  return new SemanticSearchEngine(vectorStore, embedder);
}

/**
 * Create keyword search engine
 */
export function createKeywordSearchEngine(vectorStore: VectorStore): KeywordSearchEngine {
  return new KeywordSearchEngine(vectorStore);
}

/**
 * Create hybrid search engine
 */
export function createHybridSearchEngine(
  semanticEngine: SemanticSearchEngine,
  keywordEngine: KeywordSearchEngine,
  weights?: HybridWeights
): HybridSearchEngine {
  return new HybridSearchEngine(semanticEngine, keywordEngine, weights);
}