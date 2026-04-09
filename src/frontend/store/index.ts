import { create } from 'zustand';

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
}

export interface RetrievalResult {
  smallChunkId: string;
  parentChunkId: string;
  parentChunkContent: string;
  similarityScore: number;
  sourceDocumentId: string;
}

export interface PipelineEvent {
  type: string;
  stage?: string;
  progress?: number;
  message?: string;
  timestamp: number;
  documentId?: string;
  error?: {
    message: string;
    stack?: string;
  };
}

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
  submitQuery: (query: string) => Promise<void>;
  clearHistory: () => Promise<void>;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isLoading: false,
  error: null,
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
    }));

    try {
      const response = await fetch('/api/chat/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      const data = await response.json();

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.assembledContext?.content || 'No results found',
        timestamp: Date.now(),
        results: data.results,
      };

      set((state) => ({
        messages: [...state.messages, assistantMessage],
        isLoading: false,
      }));
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },
  clearHistory: async () => {
    try {
      await fetch('/api/chat/history', { method: 'DELETE' });
      set({ messages: [] });
    } catch (error) {
      set({ error: (error as Error).message });
    }
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