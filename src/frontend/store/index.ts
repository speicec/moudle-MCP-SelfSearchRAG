import { create } from 'zustand';

// Re-export from new store files
export { useTimelineStore, type TimelineStage, type StageMetrics, type TimelineState } from './timelineStore';
export { useChunkStore, type ChunkItem, type ChunkCreatedEvent, type ChunkFilterOptions, type PaginationState, type ChunkState } from './chunkStore';
export { useStatsStore, type StatsUpdateEvent, type PipelineStats, type RetrievalStats, type ChunkStats, type StageTimeDistribution, type PerformanceIndicator, type StatsState } from './statsStore';
export { useRetrievalStore, type RetrievalMatch, type RetrievalResult, type RetrievalFlowState } from './retrievalStore';

// Types
export interface Document {
  id: string;
  filename: string;
  size: number;
  uploadedAt: number;
  status: 'pending' | 'processing' | 'indexed' | 'error';
  errorMessage?: string;
}

export interface PipelineStage {
  name: 'ingest' | 'parse' | 'chunk' | 'embed' | 'index';
  status: 'pending' | 'running' | 'completed' | 'error';
  progress: number;
  message?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  results?: RetrievalResult[];
  thinking?: string; // LLM thinking chain content
}

export interface RetrievalResult {
  smallChunkId: string;
  parentChunkId: string;
  parentChunkContent: string;
  similarityScore: number;
  sourceDocumentId: string;
  // GRADE evidence evaluation (new)
  evidenceEvaluation?: {
    literatureType: 'rct' | 'meta_analysis' | 'guideline' | 'observational' | 'case_report' | 'expert_opinion';
    grade: 'A' | 'B' | 'C' | 'D';
    isCurrent: boolean;
    year?: number;
    sourceGuideline?: string;
    expirationWarning?: string;
    sourceAuthority?: 'international' | 'national' | 'local';
    authorityWeight?: number;
    timeWeight?: number;
    consistencyScore?: number;
    compositeScore?: number;
  };
}

/**
 * Extended PipelineEvent type for WebSocket events
 */
export interface PipelineEvent {
  type: string;
  stage?: string;
  progress?: number;
  message?: string;
  timestamp: number;
  documentId?: string;
  // New fields for extended events
  metrics?: StageMetrics;
  chunk?: ChunkCreatedEvent;
  totalChunks?: number;
  query?: string;
  match?: RetrievalMatch;
  results?: RetrievalResult[];
  duration?: number;
  stats?: StatsUpdateEvent;
  error?: {
    message: string;
    stack?: string;
  };
}

// Import types for PipelineEvent
import type { StageMetrics } from './timelineStore';
import type { ChunkCreatedEvent } from './chunkStore';
import type { StatsUpdateEvent } from './statsStore';
import type { RetrievalMatch } from './retrievalStore';

// Document store
interface DocumentState {
  documents: Document[];
  isLoading: boolean;
  error: string | null;
  fetchDocuments: () => Promise<void>;
  uploadDocument: (file: File) => Promise<void>;
  deleteDocument: (id: string) => Promise<void>;
}

export const useDocumentStore = create<DocumentState>((set) => ({
  documents: [],
  isLoading: false,
  error: null,
  fetchDocuments: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch('/api/documents');
      const documents: Document[] = await response.json();
      set({ documents, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },
  uploadDocument: async (file: File) => {
    set({ isLoading: true, error: null });
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Upload failed');
      }
      // Refresh documents list
      const listResponse = await fetch('/api/documents');
      const documents: Document[] = await listResponse.json();
      set({ documents, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },
  deleteDocument: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`/api/documents/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Delete failed');
      }
      set((state) => ({
        documents: state.documents.filter((d) => d.id !== id),
        isLoading: false,
      }));
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },
}));

// Chat store
interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  // Generation state fields
  isGenerating: boolean;
  generationPhase: 'idle' | 'analysis' | 'retrieval' | 'reasoning' | 'answer' | 'complete' | 'error';
  currentThinking: string;
  currentAnswer: string;
  currentSources: RetrievalResult[];
  // Prevent duplicate completion handling
  lastCompleteTimestamp: number | null;
  submitQuery: (query: string) => Promise<void>;
  clearHistory: () => Promise<void>;
  // Generation event handlers
  handleGenerationStart: (query: string, sourcesCount: number) => void;
  handleGenerationThinking: (content: string) => void;
  handleGenerationAnswer: (content: string) => void;
  handleGenerationComplete: (thinkingTokens: number, answerTokens: number, duration: number) => void;
  handleGenerationError: (error: string) => void;
  // Additional method
  setCurrentSources: (sources: RetrievalResult[]) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isLoading: false,
  error: null,
  isGenerating: false,
  generationPhase: 'idle',
  currentThinking: '',
  currentAnswer: '',
  currentSources: [],
  lastCompleteTimestamp: null,
  submitQuery: async (query: string) => {
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: Date.now(),
    };
    set((state) => ({
      messages: [...state.messages, userMessage],
      isLoading: true,
      error: null,
      isGenerating: true,
      generationPhase: 'analysis',
      currentThinking: '',
      currentAnswer: '',
      currentSources: [],
      lastCompleteTimestamp: null, // Reset for new query
    }));

    try {
      // Send HTTP request to trigger backend processing
      // The actual assistant message will be added via WebSocket streaming events
      // (generation:start → generation:thinking → generation:answer → generation:complete)
      const response = await fetch('/api/chat/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });

      // Check for errors but don't add assistant message here
      // WebSocket events handle the streaming display and final message addition
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Generation request failed');
      }

      // Request successful - streaming will proceed via WebSocket
      // No need to process response data here, WebSocket handles it
    } catch (error) {
      set({
        error: (error as Error).message,
        isLoading: false,
        isGenerating: false,
        generationPhase: 'error',
      });
    }
  },
  clearHistory: async () => {
    try {
      await fetch('/api/chat/history', { method: 'DELETE' });
      set({
        messages: [],
        currentThinking: '',
        currentAnswer: '',
        currentSources: [],
        generationPhase: 'idle',
      });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },
  // Generation event handlers
  handleGenerationStart: (query: string, sourcesCount: number) => {
    set((state) => ({
      isGenerating: true,
      generationPhase: 'retrieval',
      currentThinking: '',
      currentAnswer: '',
      // Keep currentSources - they were set during retrieval:complete
      // Don't clear them here!
      lastCompleteTimestamp: null, // Reset for new query
      error: null,
    }));
  },
  handleGenerationThinking: (content: string) => {
    set((state) => ({
      generationPhase: 'reasoning',
      currentThinking: state.currentThinking + content,
    }));
  },
  handleGenerationAnswer: (content: string) => {
    set((state) => ({
      generationPhase: 'answer',
      currentAnswer: state.currentAnswer + content,
    }));
  },
  handleGenerationComplete: (thinkingTokens: number, answerTokens: number, duration: number) => {
    // Debug: Log when complete is called
    console.log(`[ChatStore] handleGenerationComplete called: thinkingTokens=${thinkingTokens}, answerTokens=${answerTokens}`);

    // Create assistant message from accumulated content
    const state = useChatStore.getState();

    // Prevent duplicate completion handling - check if already processed this completion
    const completionKey = `${state.currentAnswer.slice(0, 100)}:${thinkingTokens}`;
    const now = Date.now();

    // If we recently processed a completion with the same content, skip
    if (state.lastCompleteTimestamp && now - state.lastCompleteTimestamp < 2000) {
      console.log(`[ChatStore] Skipping duplicate completion - last was ${now - state.lastCompleteTimestamp}ms ago`);
      return;
    }

    // Debug: Check current state before adding message
    console.log(`[ChatStore] Before adding: messages.length=${state.messages.length}, currentAnswer="${state.currentAnswer.slice(0, 50)}..."`);

    const assistantMessage: ChatMessage = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: state.currentAnswer,
      timestamp: Date.now(),
      results: state.currentSources,
      thinking: state.currentThinking, // Include thinking chain
    };

    set((prevState) => ({
      messages: [...prevState.messages, assistantMessage],
      isGenerating: false,
      generationPhase: 'complete',
      isLoading: false,
      lastCompleteTimestamp: now,
      // Keep thinking for display, but clear current answer for next query
      currentAnswer: '',
    }));

    // Debug: Log after state update
    console.log(`[ChatStore] After adding: messages.length=${useChatStore.getState().messages.length}`);
  },
  handleGenerationError: (error: string) => {
    set({
      error,
      isGenerating: false,
      generationPhase: 'error',
      isLoading: false,
    });
  },
  // Additional method to set sources from retrieval
  setCurrentSources: (sources: RetrievalResult[]) => {
    set({ currentSources: sources });
  },
}));

// Pipeline store
interface PipelineState {
  stages: PipelineStage[];
  currentDocumentId: string | null;
  isRunning: boolean;
  handleEvent: (event: PipelineEvent) => void;
  reset: () => void;
}

const initialStages: PipelineStage[] = [
  { name: 'ingest', status: 'pending', progress: 0 },
  { name: 'parse', status: 'pending', progress: 0 },
  { name: 'chunk', status: 'pending', progress: 0 },
  { name: 'embed', status: 'pending', progress: 0 },
  { name: 'index', status: 'pending', progress: 0 },
];

export const usePipelineStore = create<PipelineState>((set) => ({
  stages: initialStages,
  currentDocumentId: null,
  isRunning: false,
  handleEvent: (event: PipelineEvent) => {
    set((state) => {
      if (event.documentId && event.documentId !== state.currentDocumentId) {
        // New document - reset stages
        return {
          currentDocumentId: event.documentId,
          isRunning: event.type !== 'pipeline:complete',
          stages: initialStages.map((stage) => ({
            ...stage,
            status: event.type === 'pipeline:start' ? 'pending' : stage.status,
          })),
        };
      }

      if (event.type === 'stage:start' && event.stage) {
        return {
          isRunning: true,
          stages: state.stages.map((s) =>
            s.name === event.stage ? { ...s, status: 'running', progress: 0 } : s
          ),
        };
      }

      if (event.type === 'stage:progress' && event.stage) {
        return {
          stages: state.stages.map((s) =>
            s.name === event.stage ? { ...s, progress: event.progress ?? 0 } : s
          ),
        };
      }

      if (event.type === 'stage:complete' && event.stage) {
        return {
          stages: state.stages.map((s) =>
            s.name === event.stage ? { ...s, status: 'completed', progress: 100 } : s
          ),
        };
      }

      if (event.type === 'pipeline:complete') {
        return { isRunning: false };
      }

      if (event.type === 'error' && event.stage) {
        return {
          isRunning: false,
          stages: state.stages.map((s) =>
            s.name === event.stage ? { ...s, status: 'error', message: event.error?.message } : s
          ),
        };
      }

      return state;
    });
  },
  reset: () => {
    set({ stages: initialStages, currentDocumentId: null, isRunning: false });
  },
}));

// Connection store
type ConnectionStatus = 'connected' | 'disconnected' | 'reconnecting';

interface ConnectionState {
  status: ConnectionStatus;
  connect: () => void;
  disconnect: () => void;
  setStatus: (status: ConnectionStatus) => void;
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  status: 'disconnected',
  connect: () => set({ status: 'connected' }),
  disconnect: () => set({ status: 'disconnected' }),
  setStatus: (status: ConnectionStatus) => set({ status }),
}));

// App store for global UI state
interface AppState {
  selectedDocumentId: string | null;
  setSelectedDocumentId: (id: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  selectedDocumentId: null,
  setSelectedDocumentId: (id) => set({ selectedDocumentId: id }),
}));