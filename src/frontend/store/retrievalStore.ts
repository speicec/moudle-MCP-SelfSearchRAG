import { create } from 'zustand';
import type {
  EntityMatch,
  KeywordMatch,
  ComplexityAssessment,
  QueryRewriting,
  TemplateAttempt,
  TaskDAG,
  ExecutorState,
  AgentResultSummary,
  AgentPhase,
  ExecutionMode,
  EvidenceEvaluation,
  GradeLevel,
  EvidenceStatistics,
} from '../types/visualization.js';

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
  // Semantic similarity score (Dense Cosine for display, not RRF)
  semanticScore?: number;
  // GRADE evidence evaluation (new)
  evidenceEvaluation?: EvidenceEvaluation;
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

  // Agent visualization state
  agentEnabled: boolean;
  agentPhase: AgentPhase | null;
  agentQuery: string | null;
  entityMatches: EntityMatch[];
  keywordMatches: KeywordMatch[];
  complexity: ComplexityAssessment | null;
  executionMode: ExecutionMode | null;
  executionReason: string | null;
  matchedTemplate: string | null;
  queryRewriting: QueryRewriting | null;
  templateAttempts: TemplateAttempt[];
  dag: TaskDAG | null;
  executorState: ExecutorState | null;
  agentResult: AgentResultSummary | null;

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

  // Agent visualization actions
  handleAgentInput: (query: string, timestamp: number) => void;
  handleAgentEntities: (entityMatches: EntityMatch[], keywordMatches?: KeywordMatch[]) => void;
  handleAgentComplexity: (complexity: ComplexityAssessment) => void;
  handleAgentMode: (mode: ExecutionMode, reason: string, matchedTemplate?: string) => void;
  handleAgentQueryRewriting: (queryRewriting: QueryRewriting) => void;
  handleAgentTemplate: (templateAttempts: TemplateAttempt[], matchedTemplate?: string) => void;
  handleAgentDAG: (dag: TaskDAG) => void;
  handleAgentExecution: (executorState: ExecutorState) => void;
  handleAgentComplete: (agentResult: AgentResultSummary) => void;
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

  // Agent visualization initial state
  agentEnabled: false,
  agentPhase: null,
  agentQuery: null,
  entityMatches: [],
  keywordMatches: [],
  complexity: null,
  executionMode: null,
  executionReason: null,
  matchedTemplate: null,
  queryRewriting: null,
  templateAttempts: [],
  dag: null,
  executorState: null,
  agentResult: null,

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

  // Agent visualization handlers
  handleAgentInput: (query: string, timestamp: number) => {
    set({
      agentEnabled: true,
      agentPhase: 'input',
      agentQuery: query,
      startTime: timestamp,
      entityMatches: [],
      keywordMatches: [],
      complexity: null,
      executionMode: null,
      executionReason: null,
      matchedTemplate: null,
      queryRewriting: null,
      templateAttempts: [],
      dag: null,
      executorState: null,
      agentResult: null,
    });
  },

  handleAgentEntities: (entityMatches: EntityMatch[], keywordMatches?: KeywordMatch[]) => {
    set({
      agentPhase: 'entities',
      entityMatches,
      keywordMatches: keywordMatches ?? [],
    });
  },

  handleAgentComplexity: (complexity: ComplexityAssessment) => {
    set({
      agentPhase: 'complexity',
      complexity,
    });
  },

  handleAgentMode: (mode: ExecutionMode, reason: string, matchedTemplate?: string) => {
    set({
      agentPhase: 'mode',
      executionMode: mode,
      executionReason: reason,
      matchedTemplate: matchedTemplate ?? null,
    });
  },

  handleAgentQueryRewriting: (queryRewriting: QueryRewriting) => {
    set({
      agentPhase: 'query_rewrite',
      queryRewriting,
    });
  },

  handleAgentTemplate: (templateAttempts: TemplateAttempt[], matchedTemplate?: string) => {
    set({
      agentPhase: 'template',
      templateAttempts,
      matchedTemplate: matchedTemplate ?? null,
    });
  },

  handleAgentDAG: (dag: TaskDAG) => {
    set({
      agentPhase: 'dag',
      dag,
    });
  },

  handleAgentExecution: (executorState: ExecutorState) => {
    set({
      agentPhase: 'execution',
      executorState,
    });
  },

  handleAgentComplete: (agentResult: AgentResultSummary) => {
    set({
      agentPhase: 'complete',
      agentResult,
      isRunning: false,
    });
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
      // Reset Agent state
      agentEnabled: false,
      agentPhase: null,
      agentQuery: null,
      entityMatches: [],
      keywordMatches: [],
      complexity: null,
      executionMode: null,
      executionReason: null,
      matchedTemplate: null,
      queryRewriting: null,
      templateAttempts: [],
      dag: null,
      executorState: null,
      agentResult: null,
    });
  },
}));