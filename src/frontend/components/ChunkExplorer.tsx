import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChunkStore, type ChunkItem } from '../store';
import ChunkDetailModal from './ChunkDetailModal';

type ViewMode = 'tree' | 'grid';
type SortBy = 'position' | 'qualityScore' | 'tokenCount';
type SortOrder = 'asc' | 'desc';
type LevelFilter = 'all' | 'small' | 'parent';

/**
 * Chunk card component for grid view
 */
const ChunkCard: React.FC<{
  chunk: ChunkItem;
  onViewDetails: (chunk: ChunkItem) => void;
  isNew?: boolean;
}> = ({ chunk, onViewDetails, isNew }) => {
  return (
    <motion.div
      initial={isNew ? { opacity: 0, scale: 0.9 } : false}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      whileHover={{ scale: 1.02 }}
      className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${
        chunk.level === 'parent'
          ? 'border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/30'
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
      }`}
      onClick={() => onViewDetails(chunk)}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className={`text-xs font-medium px-2 py-0.5 rounded ${
          chunk.level === 'parent'
            ? 'bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
        }`}>
          {chunk.level === 'parent' ? 'Parent' : 'Small'}
        </span>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {chunk.tokenCount} tokens
        </span>
      </div>

      {/* Content preview */}
      <p className="text-sm text-gray-900 dark:text-white line-clamp-3 mb-3">
        {chunk.contentPreview}
      </p>

      {/* Quality score */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500 dark:text-gray-400">
          Quality: {(chunk.qualityScore * 100).toFixed(0)}%
        </span>
        <div className="w-20 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full">
          <div
            className={`h-full rounded-full ${
              chunk.qualityScore >= 0.8 ? 'bg-green-500' : chunk.qualityScore >= 0.5 ? 'bg-yellow-500' : 'bg-red-500'
            }`}
            style={{ width: `${chunk.qualityScore * 100}%` }}
          />
        </div>
      </div>
    </motion.div>
  );
};

/**
 * Tree node component for tree view
 */
const TreeNode: React.FC<{
  chunk: ChunkItem;
  children?: ChunkItem[];
  isExpanded: boolean;
  onToggle: () => void;
  onViewDetails: (chunk: ChunkItem) => void;
}> = ({ chunk, children, isExpanded, onToggle, onViewDetails }) => {
  const hasChildren = children && children.length > 0;

  return (
    <div className="flex flex-col">
      {/* Node */}
      <motion.div
        whileHover={{ backgroundColor: 'rgba(0,0,0,0.05)' }}
        className={`flex items-center gap-2 p-2 rounded cursor-pointer ${
          chunk.level === 'parent' ? 'font-medium' : ''
        }`}
        onClick={() => hasChildren ? onToggle() : onViewDetails(chunk)}
      >
        {/* Expand/collapse icon */}
        {hasChildren && (
          <motion.svg
            animate={{ rotate: isExpanded ? 90 : 0 }}
            className="w-4 h-4 text-gray-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </motion.svg>
        )}
        {!hasChildren && (
          <div className="w-4 h-4 flex items-center justify-center">
            <div className={`w-2 h-2 rounded-full ${
              chunk.level === 'parent' ? 'bg-blue-500' : 'bg-gray-400'
            }`} />
          </div>
        )}

        {/* Level badge */}
        <span className={`text-xs px-1.5 py-0.5 rounded ${
          chunk.level === 'parent'
            ? 'bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
        }`}>
          {chunk.level}
        </span>

        {/* Content preview */}
        <span className="flex-1 text-sm text-gray-900 dark:text-white truncate">
          {chunk.contentPreview.slice(0, 50)}
        </span>

        {/* Quality */}
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {(chunk.qualityScore * 100).toFixed(0)}%
        </span>

        {/* Tokens */}
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {chunk.tokenCount}
        </span>
      </motion.div>

      {/* Children */}
      <AnimatePresence>
        {hasChildren && isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="pl-6 border-l border-gray-200 dark:border-gray-700 ml-2"
          >
            {children.map((child) => (
              <TreeNode
                key={child.id}
                chunk={child}
                isExpanded={false}
                onToggle={() => {}}
                onViewDetails={onViewDetails}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/**
 * ChunkExplorer component
 * Displays chunks in tree or grid view with filtering and sorting
 */
const ChunkExplorer: React.FC<{
  documentId?: string;
}> = ({ documentId }) => {
  const {
    chunks,
    pagination,
    filters,
    isLoading,
    error,
    newChunks,
    fetchChunks,
    setFilters,
    setPage,
    clearNewChunks,
  } = useChunkStore();

  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedChunk, setSelectedChunk] = useState<ChunkItem | null>(null);
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all');
  const [sortBy, setSortBy] = useState<SortBy>('position');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  // Fetch chunks when documentId or filters change
  useEffect(() => {
    if (documentId) {
      fetchChunks(documentId, {
        level: levelFilter === 'all' ? undefined : levelFilter,
        sortBy,
        sortOrder,
      });
    }
  }, [documentId, levelFilter, sortBy, sortOrder, fetchChunks]);

  // Clear new chunks after animation
  useEffect(() => {
    if (newChunks.length > 0) {
      const timer = setTimeout(() => {
        clearNewChunks();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [newChunks, clearNewChunks]);

  // Build tree structure from chunks
  const buildTree = useCallback(() => {
    const parents = chunks.filter(c => c.level === 'parent');
    const smalls = chunks.filter(c => c.level === 'small');

    return parents.map(parent => ({
      parent,
      children: smalls.filter(s => s.parentId === parent.id),
    }));
  }, [chunks]);

  const toggleNode = useCallback((id: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleViewDetails = useCallback((chunk: ChunkItem) => {
    setSelectedChunk(chunk);
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700">
        <p className="text-red-600 dark:text-red-400">{error}</p>
      </div>
    );
  }

  // Empty state
  if (chunks.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        No chunks available. Upload a document to see chunks.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        {/* View mode toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('grid')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
              viewMode === 'grid'
                ? 'bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            Grid
          </button>
          <button
            onClick={() => setViewMode('tree')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
              viewMode === 'tree'
                ? 'bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            Tree
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          {/* Level filter */}
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value as LevelFilter)}
            className="px-2 py-1.5 rounded-lg text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
          >
            <option value="all">All Levels</option>
            <option value="small">Small Only</option>
            <option value="parent">Parent Only</option>
          </select>

          {/* Sort by */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className="px-2 py-1.5 rounded-lg text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
          >
            <option value="position">Position</option>
            <option value="qualityScore">Quality</option>
            <option value="tokenCount">Tokens</option>
          </select>

          {/* Sort order */}
          <button
            onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
            className="px-2 py-1.5 rounded-lg text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
          >
            {sortOrder === 'asc' ? '↑ Asc' : '↓ Desc'}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
        <span>{pagination.total} chunks total</span>
        <span>Page {pagination.page} of {pagination.totalPages}</span>
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {viewMode === 'grid' ? (
          <motion.div
            key="grid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
          >
            {chunks.map((chunk) => (
              <ChunkCard
                key={chunk.id}
                chunk={chunk}
                onViewDetails={handleViewDetails}
                isNew={newChunks.some(c => c.id === chunk.id)}
              />
            ))}
          </motion.div>
        ) : (
          <motion.div
            key="tree"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-1"
          >
            {levelFilter === 'all' ? (
              buildTree().map(({ parent, children }) => (
                <TreeNode
                  key={parent.id}
                  chunk={parent}
                  children={children}
                  isExpanded={expandedNodes.has(parent.id)}
                  onToggle={() => toggleNode(parent.id)}
                  onViewDetails={handleViewDetails}
                />
              ))
            ) : (
              chunks.map((chunk) => (
                <TreeNode
                  key={chunk.id}
                  chunk={chunk}
                  isExpanded={false}
                  onToggle={() => {}}
                  onViewDetails={handleViewDetails}
                />
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pagination */}
      <div className="flex items-center justify-center gap-2">
        <button
          onClick={() => setPage(pagination.page - 1)}
          disabled={pagination.page <= 1}
          className="px-3 py-1.5 rounded-lg text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-50"
        >
          Previous
        </button>
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {pagination.page}
        </span>
        <button
          onClick={() => setPage(pagination.page + 1)}
          disabled={pagination.page >= pagination.totalPages}
          className="px-3 py-1.5 rounded-lg text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-50"
        >
          Next
        </button>
      </div>

      {/* Detail modal */}
      <ChunkDetailModal
        chunk={selectedChunk}
        onClose={() => setSelectedChunk(null)}
      />
    </div>
  );
};

export default ChunkExplorer;