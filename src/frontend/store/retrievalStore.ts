import { create } from 'zustand';

/**
 * Retrieval match data
 */
export interface RetrievalMatch {
  smallChunkId: string;
  similarityScore: number;
  rank: number;
}

/**
 * Retrieval result data
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

  // Step tracking
  currentStep: 'idle' | 'embedding' | 'searching' | 'expanding' | 'complete';
  embeddingProgress: number;

  // Actions
  handleRetrievalStart: (query: string, timestamp: number) => void;
  handleRetrievalMatch: (match: RetrievalMatch) => void;
  handleRetrievalComplete: (results: RetrievalResult[], duration: number, timestamp: number) => void;
  setStep: (step: 'idle' | 'embedding' | 'searching' | 'expanding' | 'complete') => void;
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
  currentStep: 'idle',
  embeddingProgress: 0,

  handleRetrievalStart: (query: string, timestamp: number) => {
    set({
      currentQuery: query,
      isRunning: true,
      startTime: timestamp,
      matches: [],
      results: [],
      currentStep: 'embedding',
      embeddingProgress: 0,
      duration: undefined,
      endTime: undefined,
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
      currentStep: 'idle',
      embeddingProgress: 0,
    });
  },
}));