import { create } from 'zustand';

/**
 * Stage metrics data from WebSocket events
 */
export interface StageMetrics {
  fileSizeBytes?: number;
  pagesExtracted?: number;
  tokensExtracted?: number;
  embeddingDimension?: number;
  chunksCreated?: number;
  processingTimeMs?: number;
  throughput?: number;
}

/**
 * Log entry for timeline event messages
 */
export interface LogEntry {
  timestamp: number;
  message: string;
  type: 'info' | 'warn' | 'error';
  stage?: string;
}

/**
 * Log cache limits
 */
export const MAX_STAGE_LOGS = 20;
export const MAX_GLOBAL_LOGS = 100;

/**
 * Startup progress stage
 */
export type StartupStage = 'checking' | 'loading_text' | 'loading_multimodal' | 'ready';

/**
 * Startup progress state
 */
export interface StartupProgress {
  stage: StartupStage;
  progress: number;
  message: string;
  model?: string;
  isReady: boolean;
  hasError: boolean;
  errorMessage?: string;
}

/**
 * Timeline stage state
 */
export interface TimelineStage {
  name: 'ingest' | 'parse' | 'chunk' | 'embed' | 'index';
  status: 'pending' | 'running' | 'completed' | 'error';
  progress: number;
  startTime?: number;
  endTime?: number;
  duration?: number;
  metrics?: StageMetrics;
  message?: string;
}

/**
 * Pipeline timeline state
 */
export interface TimelineState {
  stages: TimelineStage[];
  currentDocumentId: string | null;
  isRunning: boolean;
  totalDuration: number;
  startTime?: number;
  endTime?: number;
  // Startup progress state
  startupProgress: StartupProgress;
  // Log cache
  stageLogs: Map<string, LogEntry[]>;
  globalLogs: LogEntry[];

  // Event handlers
  handlePipelineStart: (documentId: string, timestamp: number) => void;
  handleStageStart: (stage: string, timestamp: number, message?: string) => void;
  handleStageProgress: (stage: string, progress: number, message?: string) => void;
  handleStageComplete: (stage: string, timestamp: number, message?: string) => void;
  handleStageMetrics: (stage: string, metrics: StageMetrics) => void;
  handlePipelineComplete: (timestamp: number) => void;
  handleError: (stage: string, message: string) => void;
  reset: () => void;
  // Startup handlers
  handleStartupProgress: (progress: Partial<StartupProgress>) => void;
  handleStartupReady: (message: string) => void;
  handleStartupError: (message: string) => void;
  // Log handlers
  addStageLog: (stage: string, entry: LogEntry) => void;
  addGlobalLog: (entry: LogEntry) => void;
  clearLogs: () => void;
}

const initialStages: TimelineStage[] = [
  { name: 'ingest', status: 'pending', progress: 0 },
  { name: 'parse', status: 'pending', progress: 0 },
  { name: 'chunk', status: 'pending', progress: 0 },
  { name: 'embed', status: 'pending', progress: 0 },
  { name: 'index', status: 'pending', progress: 0 },
];

const initialStartupProgress: StartupProgress = {
  stage: 'checking',
  progress: 0,
  message: '',
  isReady: false,
  hasError: false,
};

export const useTimelineStore = create<TimelineState>((set) => ({
  stages: initialStages,
  currentDocumentId: null,
  isRunning: false,
  totalDuration: 0,
  startTime: undefined,
  endTime: undefined,
  startupProgress: initialStartupProgress,
  stageLogs: new Map(),
  globalLogs: [],

  handlePipelineStart: (documentId: string, timestamp: number) => {
    set({
      currentDocumentId: documentId,
      isRunning: true,
      startTime: timestamp,
      stages: initialStages.map((stage) => ({
        ...stage,
        status: 'pending',
        progress: 0,
        startTime: undefined,
        endTime: undefined,
        duration: undefined,
        metrics: undefined,
      })),
      stageLogs: new Map(),
      globalLogs: [],
    });
  },

  handleStageStart: (stage: string, timestamp: number, message?: string) => {
    set((state) => {
      const updates: Partial<TimelineState> = {
        stages: state.stages.map((s) =>
          s.name === stage ? { ...s, status: 'running', startTime: timestamp, progress: 0 } : s
        ),
      };
      if (message) {
        const entry: LogEntry = { timestamp, message, type: 'info', stage };
        updates.stageLogs = new Map(state.stageLogs).set(
          stage,
          [...(state.stageLogs.get(stage) || []), entry].slice(-MAX_STAGE_LOGS)
        );
        updates.globalLogs = [...state.globalLogs, entry].slice(-MAX_GLOBAL_LOGS);
      }
      return updates;
    });
  },

  handleStageProgress: (stage: string, progress: number, message?: string) => {
    set((state) => {
      const updates: Partial<TimelineState> = {
        stages: state.stages.map((s) =>
          s.name === stage ? { ...s, progress } : s
        ),
      };
      if (message) {
        const entry: LogEntry = { timestamp: Date.now(), message, type: 'info', stage };
        updates.stageLogs = new Map(state.stageLogs).set(
          stage,
          [...(state.stageLogs.get(stage) || []), entry].slice(-MAX_STAGE_LOGS)
        );
        updates.globalLogs = [...state.globalLogs, entry].slice(-MAX_GLOBAL_LOGS);
      }
      return updates;
    });
  },

  handleStageComplete: (stage: string, timestamp: number, message?: string) => {
    set((state) => {
      const updates: Partial<TimelineState> = {
        stages: state.stages.map((s) => {
          if (s.name === stage) {
            const duration = s.startTime ? timestamp - s.startTime : undefined;
            return { ...s, status: 'completed', endTime: timestamp, duration, progress: 100 };
          }
          return s;
        }),
      };
      if (message) {
        const entry: LogEntry = { timestamp, message, type: 'info', stage };
        updates.stageLogs = new Map(state.stageLogs).set(
          stage,
          [...(state.stageLogs.get(stage) || []), entry].slice(-MAX_STAGE_LOGS)
        );
        updates.globalLogs = [...state.globalLogs, entry].slice(-MAX_GLOBAL_LOGS);
      }
      return updates;
    });
  },

  handleStageMetrics: (stage: string, metrics: StageMetrics) => {
    set((state) => ({
      stages: state.stages.map((s) =>
        s.name === stage ? { ...s, metrics } : s
      ),
    }));
  },

  handlePipelineComplete: (timestamp: number) => {
    set((state) => ({
      isRunning: false,
      endTime: timestamp,
      totalDuration: state.startTime ? timestamp - state.startTime : 0,
    }));
  },

  handleError: (stage: string, message: string) => {
    set((state) => {
      const entry: LogEntry = { timestamp: Date.now(), message, type: 'error', stage };
      return {
        isRunning: false,
        stages: state.stages.map((s) =>
          s.name === stage ? { ...s, status: 'error', message } : s
        ),
        stageLogs: new Map(state.stageLogs).set(
          stage,
          [...(state.stageLogs.get(stage) || []), entry].slice(-MAX_STAGE_LOGS)
        ),
        globalLogs: [...state.globalLogs, entry].slice(-MAX_GLOBAL_LOGS),
      };
    });
  },

  reset: () => {
    set({
      stages: initialStages,
      currentDocumentId: null,
      isRunning: false,
      totalDuration: 0,
      startTime: undefined,
      endTime: undefined,
      startupProgress: initialStartupProgress,
      stageLogs: new Map(),
      globalLogs: [],
    });
  },

  handleStartupProgress: (progress: Partial<StartupProgress>) => {
    set((state) => ({
      startupProgress: { ...state.startupProgress, ...progress },
    }));
  },

  handleStartupReady: (message: string) => {
    set({
      startupProgress: {
        stage: 'ready',
        progress: 100,
        message,
        isReady: true,
        hasError: false,
      },
    });
  },

  handleStartupError: (message: string) => {
    set((state) => ({
      startupProgress: {
        ...state.startupProgress,
        isReady: false,
        hasError: true,
        errorMessage: message,
      },
    }));
  },

  addStageLog: (stage: string, entry: LogEntry) => {
    set((state) => ({
      stageLogs: new Map(state.stageLogs).set(
        stage,
        [...(state.stageLogs.get(stage) || []), entry].slice(-MAX_STAGE_LOGS)
      ),
    }));
  },

  addGlobalLog: (entry: LogEntry) => {
    set((state) => ({
      globalLogs: [...state.globalLogs, entry].slice(-MAX_GLOBAL_LOGS),
    }));
  },

  clearLogs: () => {
    set({
      stageLogs: new Map(),
      globalLogs: [],
    });
  },
}));