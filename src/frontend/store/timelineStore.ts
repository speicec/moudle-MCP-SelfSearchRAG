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
 * Timeline stage state
 */
export interface TimelineStage {
  name: 'ingest' | 'parse' | 'embed' | 'index';
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

  // Event handlers
  handlePipelineStart: (documentId: string, timestamp: number) => void;
  handleStageStart: (stage: string, timestamp: number) => void;
  handleStageProgress: (stage: string, progress: number) => void;
  handleStageComplete: (stage: string, timestamp: number) => void;
  handleStageMetrics: (stage: string, metrics: StageMetrics) => void;
  handlePipelineComplete: (timestamp: number) => void;
  handleError: (stage: string, message: string) => void;
  reset: () => void;
}

const initialStages: TimelineStage[] = [
  { name: 'ingest', status: 'pending', progress: 0 },
  { name: 'parse', status: 'pending', progress: 0 },
  { name: 'embed', status: 'pending', progress: 0 },
  { name: 'index', status: 'pending', progress: 0 },
];

export const useTimelineStore = create<TimelineState>((set) => ({
  stages: initialStages,
  currentDocumentId: null,
  isRunning: false,
  totalDuration: 0,
  startTime: undefined,
  endTime: undefined,

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
    });
  },

  handleStageStart: (stage: string, timestamp: number) => {
    set((state) => ({
      stages: state.stages.map((s) =>
        s.name === stage ? { ...s, status: 'running', startTime: timestamp, progress: 0 } : s
      ),
    }));
  },

  handleStageProgress: (stage: string, progress: number) => {
    set((state) => ({
      stages: state.stages.map((s) =>
        s.name === stage ? { ...s, progress } : s
      ),
    }));
  },

  handleStageComplete: (stage: string, timestamp: number) => {
    set((state) => ({
      stages: state.stages.map((s) => {
        if (s.name === stage) {
          const duration = s.startTime ? timestamp - s.startTime : undefined;
          return { ...s, status: 'completed', endTime: timestamp, duration, progress: 100 };
        }
        return s;
      }),
    }));
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
    set((state) => ({
      isRunning: false,
      stages: state.stages.map((s) =>
        s.name === stage ? { ...s, status: 'error', message } : s
      ),
    }));
  },

  reset: () => {
    set({
      stages: initialStages,
      currentDocumentId: null,
      isRunning: false,
      totalDuration: 0,
      startTime: undefined,
      endTime: undefined,
    });
  },
}));