import { create } from 'zustand';

/**
 * Chunk data for frontend display
 */
export interface ChunkItem {
  id: string;
  level: 'small' | 'parent';
  contentPreview: string;
  tokenCount: number;
  qualityScore: number;
  position: { start: number; end: number };
  parentId?: string;
  childIds?: string[];
  sourceDocumentId: string;
  metadata?: Record<string, unknown>;
}

/**
 * Chunk creation event data from WebSocket
 */
export interface ChunkCreatedEvent {
  id: string;
  level: 'small' | 'parent';
  contentPreview: string;
  tokenCount: number;
  qualityScore: number;
  position: { start: number; end: number };
  metadata?: Record<string, unknown>;
  totalChunks?: number;
}

/**
 * Pagination state
 */
export interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/**
 * Filter options
 */
export interface ChunkFilterOptions {
  level?: 'small' | 'parent';
  minQuality?: number;
  maxQuality?: number;
  sortBy?: 'position' | 'qualityScore' | 'tokenCount';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Chunk store state
 */
export interface ChunkState {
  // Current document chunks
  chunks: ChunkItem[];
  currentDocumentId: string | null;
  pagination: PaginationState;
  filters: ChunkFilterOptions;
  isLoading: boolean;
  error: string | null;

  // New chunks from WebSocket (for animations)
  newChunks: ChunkItem[];

  // Actions
  fetchChunks: (documentId: string, options?: Partial<ChunkFilterOptions> & { page?: number }) => Promise<void>;
  handleChunkCreated: (chunk: ChunkCreatedEvent, documentId: string) => void;
  setFilters: (filters: ChunkFilterOptions) => void;
  setPage: (page: number) => void;
  clearNewChunks: () => void;
  reset: () => void;
}

const defaultPagination: PaginationState = {
  page: 1,
  pageSize: 20,
  total: 0,
  totalPages: 0,
};

const defaultFilters: ChunkFilterOptions = {
  sortBy: 'position',
  sortOrder: 'asc',
};

export const useChunkStore = create<ChunkState>((set, get) => ({
  chunks: [],
  currentDocumentId: null,
  pagination: defaultPagination,
  filters: defaultFilters,
  isLoading: false,
  error: null,
  newChunks: [],

  fetchChunks: async (documentId: string, options?: Partial<ChunkFilterOptions> & { page?: number }) => {
    set({ isLoading: true, error: null, currentDocumentId: documentId });

    const state = get();
    const filters = options?.level !== undefined || options?.sortBy !== undefined
      ? { ...state.filters, ...options }
      : state.filters;
    const page = options?.page ?? state.pagination.page;

    try {
      const params = new URLSearchParams();
      if (filters.level) params.set('level', filters.level);
      params.set('page', String(page));
      params.set('pageSize', String(state.pagination.pageSize));
      if (filters.sortBy) params.set('sortBy', filters.sortBy);
      if (filters.sortOrder) params.set('sortOrder', filters.sortOrder);
      if (filters.minQuality !== undefined) params.set('minQuality', String(filters.minQuality));
      if (filters.maxQuality !== undefined) params.set('maxQuality', String(filters.maxQuality));

      const response = await fetch(`/api/documents/${documentId}/chunks?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch chunks');
      }

      const data = await response.json();
      set({
        chunks: data.chunks,
        pagination: {
          page: data.pagination.page,
          pageSize: data.pagination.pageSize,
          total: data.pagination.total,
          totalPages: data.pagination.totalPages,
        },
        filters,
        isLoading: false,
      });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  handleChunkCreated: (chunk: ChunkCreatedEvent, documentId: string) => {
    const state = get();
    // Only handle chunks for current document
    if (state.currentDocumentId !== documentId) return;

    const newChunk: ChunkItem = {
      id: chunk.id,
      level: chunk.level,
      contentPreview: chunk.contentPreview,
      tokenCount: chunk.tokenCount,
      qualityScore: chunk.qualityScore,
      position: chunk.position,
      sourceDocumentId: documentId,
      metadata: chunk.metadata,
    };

    set({ newChunks: [...state.newChunks, newChunk] });
  },

  setFilters: (filters: ChunkFilterOptions) => {
    set({ filters: { ...get().filters, ...filters } });
    // Refetch if we have a current document
    const state = get();
    if (state.currentDocumentId) {
      get().fetchChunks(state.currentDocumentId, { page: 1 });
    }
  },

  setPage: (page: number) => {
    const state = get();
    if (state.currentDocumentId) {
      get().fetchChunks(state.currentDocumentId, { page });
    }
  },

  clearNewChunks: () => {
    set({ newChunks: [] });
  },

  reset: () => {
    set({
      chunks: [],
      currentDocumentId: null,
      pagination: defaultPagination,
      filters: defaultFilters,
      isLoading: false,
      error: null,
      newChunks: [],
    });
  },
}));