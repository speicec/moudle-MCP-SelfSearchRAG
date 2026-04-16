import { create } from 'zustand';

/**
 * Confidence level type
 */
export type ConfidenceLevel = 'high' | 'medium' | 'low';

/**
 * Retrieval match data
 */
export interface RetrievalMatch {
  smallChunkId: string;
  similarityScore: number;
  rank: number;
}

/**
 * Retrieval result data (basic)
 */
export interface RetrievalResult {
  smallChunkId: string;
  parentChunkId: string;
  parentChunkContent: string;
  similarityScore: number;
  sourceDocumentId: string;
  contextWindow?: string;
  windowStart?: number;
  windowEnd?: number;
}

/**
 * Enhanced retrieval result with confidence
 */
export interface EnhancedRetrievalResult extends RetrievalResult {
  confidenceScore: number;
  confidenceLevel: ConfidenceLevel;
  keywordMatchScore?: number;
  positionScore?: number;
  chunkQualityScore?: number;
}

/**
 * Query analysis data
 */
export interface QueryAnalysis {
  complexity: 'simple' | 'complex' | 'structured';
  wasRewritten: boolean;
  wasDecomposed: boolean;
  expandedTerms: string[];
}

/**
 * Retrieval statistics
 */
export interface RetrievalStats {
  coarseTopK: number;
  refinedCount: number;
  avgConfidence: number;
  truncated: boolean;
  method: 'local-reranker' | 'internal-confidence';
}

/**
 * Context chunk with confidence
 */
export interface ContextChunk {
  content: string;
  confidence: number;
  confidenceLevel: ConfidenceLevel;
  source: string;
  page?: number;
}

/**
 * Retrieval flow state
 */
export interface RetrievalFlowState {
  // Current query
  currentQuery: string | null;
  isRunning: boolean;
  startTime?: number;
  endTime?: number;
  duration?: number;

  // Matches (for animation)
  matches: RetrievalMatch[];
  results: RetrievalResult[];
  enhancedResults: EnhancedRetrievalResult[];

  // Enhanced retrieval data
  queryAnalysis: QueryAnalysis | null;
  retrievalStats: RetrievalStats | null;
  contextChunks: ContextChunk[];

  // Step tracking
  currentStep: 'idle' | 'embedding' | 'analyzing' | 'searching' | 'reranking' | 'expanding' | 'complete';
  embeddingProgress: number;

  // Actions
  handleRetrievalStart: (query: string, timestamp: number) => void;
  handleRetrievalMatch: (match: RetrievalMatch) => void;
  handleRetrievalComplete: (results: RetrievalResult[], duration: number, timestamp: number) => void;
  handleEnhancedComplete: (data: {
    results: EnhancedRetrievalResult[];
    queryAnalysis: QueryAnalysis;
    retrievalStats: RetrievalStats;
    contextChunks: ContextChunk[];
    duration: number;
  }) => void;
  setStep: (step: 'idle' | 'embedding' | 'analyzing' | 'searching' | 'reranking' | 'expanding' | 'complete') => void;
  setEmbeddingProgress: (progress: number) => void;
  reset: () => void;
}

export const useRetrievalStore = create<RetrievalFlowState>((set) => ({
  currentQuery: null,
  isRunning: false,
  startTime: undefined,
  endTime: undefined,
  duration: undefined,
  matches: [],
  results: [],
  enhancedResults: [],
  queryAnalysis: null,
  retrievalStats: null,
  contextChunks: [],
  currentStep: 'idle',
  embeddingProgress: 0,

  handleRetrievalStart: (query: string, timestamp: number) => {
    set({
      currentQuery: query,
      isRunning: true,
      startTime: timestamp,
      matches: [],
      results: [],
      enhancedResults: [],
      currentStep: 'analyzing',
      embeddingProgress: 0,
      duration: undefined,
      endTime: undefined,
      queryAnalysis: null,
      retrievalStats: null,
      contextChunks: [],
    });
  },

  handleRetrievalMatch: (match: RetrievalMatch) => {
    set((state) => ({
      matches: [...state.matches, match],
      currentStep: 'searching',
    }));
  },

  handleRetrievalComplete: (results: RetrievalResult[], duration: number, timestamp: number) => {
    set({
      results,
      duration,
      endTime: timestamp,
      isRunning: false,
      currentStep: 'complete',
    });
  },

  handleEnhancedComplete: (data) => {
    set({
      enhancedResults: data.results,
      queryAnalysis: data.queryAnalysis,
      retrievalStats: data.retrievalStats,
      contextChunks: data.contextChunks,
      duration: data.duration,
      isRunning: false,
      currentStep: 'complete',
    });
  },

  setStep: (step) => {
    set({ currentStep: step });
  },

  setEmbeddingProgress: (progress: number) => {
    set({ embeddingProgress: progress });
  },

  reset: () => {
    set({
      currentQuery: null,
      isRunning: false,
      startTime: undefined,
      endTime: undefined,
      duration: undefined,
      matches: [],
      results: [],
      enhancedResults: [],
      currentStep: 'idle',
      embeddingProgress: 0,
      queryAnalysis: null,
      retrievalStats: null,
      contextChunks: [],
    });
  },
}));