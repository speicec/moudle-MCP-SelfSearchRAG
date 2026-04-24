/**
 * TraceStore - 追踪数据状态管理
 *
 * 管理历史追踪记录和评估结果
 */

import { create } from 'zustand';

/**
 * 追踪记录摘要
 */
export interface TraceSummary {
  traceId: string;
  sessionId?: string;
  timestamp: string;
  query: string;
  status: 'running' | 'completed' | 'failed';
  overallScore?: number;
  riskLevel?: 'safe' | 'caution' | 'warning' | 'danger';
  durationMs: number;
  llmCallCount: number;
}

/**
 * 追踪详情
 */
export interface TraceDetail {
  traceId: string;
  sessionId?: string;
  timestamp: string;
  query: {
    raw: string;
    rewritten?: string;
    entities?: {
      diseases: Array<{ id: string; canonicalName: string }>;
      drugs: Array<{ id: string; canonicalName: string }>;
      indicators: Array<{ id: string; canonicalName: string }>;
    };
  };
  phases: Array<{
    spanId: string;
    phase: string;
    startTime: number;
    endTime: number;
    durationMs: number;
  }>;
  retrieval: {
    chunks: Array<{
      chunkId: string;
      content: string;
      similarityScore: number;
    }>;
    topK: number;
  };
  llmCalls: Array<{
    callId: string;
    model: string;
    latencyMs: number;
  }>;
  answer: {
    text: string;
    confidence?: number;
  };
  evaluation?: {
    overallScore: number;
    faithfulness: number;
    contextRelevance: number;
    answerRelevance: number;
    riskLevel: string;
  };
  status: string;
  error?: string;
}

/**
 * 追踪列表筛选条件
 */
export interface TraceFilter {
  status?: 'running' | 'completed' | 'failed';
  sessionId?: string;
  minScore?: number;
  maxScore?: number;
  riskLevel?: 'safe' | 'caution' | 'warning' | 'danger';
  dateRange?: {
    start: string;
    end: string;
  };
}

/**
 * TraceStore 状态
 */
export interface TraceState {
  // 追踪列表
  traces: TraceSummary[];
  selectedTrace: TraceDetail | null;
  totalTraces: number;
  currentPage: number;
  pageSize: number;
  filter: TraceFilter;

  // 加载状态
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchTraces: (page?: number, filter?: TraceFilter) => Promise<void>;
  fetchTraceDetail: (traceId: string) => Promise<void>;
  setFilter: (filter: TraceFilter) => void;
  clearFilter: () => void;
  selectTrace: (trace: TraceDetail | null) => void;
  reset: () => void;
}

const defaultFilter: TraceFilter = {};

export const useTraceStore = create<TraceState>((set, get) => ({
  traces: [],
  selectedTrace: null,
  totalTraces: 0,
  currentPage: 1,
  pageSize: 20,
  filter: defaultFilter,
  isLoading: false,
  error: null,

  fetchTraces: async (page = 1, filter = get().filter) => {
    set({ isLoading: true, error: null, currentPage: page, filter });
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(get().pageSize));

      if (filter.status) params.set('status', filter.status);
      if (filter.sessionId) params.set('sessionId', filter.sessionId);
      if (filter.riskLevel) params.set('riskLevel', filter.riskLevel);
      if (filter.minScore) params.set('minScore', String(filter.minScore));
      if (filter.maxScore) params.set('maxScore', String(filter.maxScore));
      if (filter.dateRange) {
        params.set('startDate', filter.dateRange.start);
        params.set('endDate', filter.dateRange.end);
      }

      const response = await fetch(`/api/traces?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch traces');
      }

      const data = await response.json() as {
        traces: TraceSummary[];
        total: number;
      };

      set({
        traces: data.traces,
        totalTraces: data.total,
        isLoading: false,
      });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  fetchTraceDetail: async (traceId: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`/api/traces/${traceId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch trace detail');
      }

      const trace = await response.json() as TraceDetail;
      set({
        selectedTrace: trace,
        isLoading: false,
      });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  setFilter: (filter: TraceFilter) => {
    set({ filter });
    get().fetchTraces(1, filter);
  },

  clearFilter: () => {
    set({ filter: defaultFilter });
    get().fetchTraces(1, defaultFilter);
  },

  selectTrace: (trace: TraceDetail | null) => {
    set({ selectedTrace: trace });
  },

  reset: () => {
    set({
      traces: [],
      selectedTrace: null,
      totalTraces: 0,
      currentPage: 1,
      filter: defaultFilter,
      isLoading: false,
      error: null,
    });
  },
}));