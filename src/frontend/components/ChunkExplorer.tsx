import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChunkStore, type ChunkItem } from '../store';
import ChunkDetailModal from './ChunkDetailModal';
import { ChevronRight, ChevronDown, Grid, List, ArrowUp, ArrowDown, ChevronLeft } from 'lucide-react';
import Skeleton, { SkeletonGroup } from './ui/Skeleton';
import { Button } from './ui/button';
import ChunkCard from './chunks/ChunkCard';
import TreeNode from './chunks/TreeNode';

type ViewMode = 'tree' | 'grid';
type SortBy = 'position' | 'qualityScore' | 'tokenCount';
type SortOrder = 'asc' | 'desc';
type LevelFilter = 'all' | 'small' | 'parent';

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

  // Empty state - no document selected
  if (!documentId) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="mb-4">请在左侧选择一个文档查看分块结构</p>
        <p className="text-sm">如果左侧列表为空，请先在「文档管理」Tab上传文档</p>
      </div>
    );
  }

  // Empty state - document selected but no chunks
  if (chunks.length === 0 && !isLoading) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="mb-4">该文档暂无分块数据</p>
        <p className="text-sm">文档可能正在处理中，请稍后刷新</p>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-4">
        {/* Toolbar skeleton */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-20" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-8" />
          </div>
        </div>
        {/* Stats skeleton */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-32" />
        </div>
        {/* Grid skeleton */}
        <SkeletonGroup type="chunk-grid" count={8} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        {/* View mode toggle */}
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('grid')}
          >
            <Grid className="w-4 h-4" />
            网格
          </Button>
          <Button
            variant={viewMode === 'tree' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('tree')}
          >
            <List className="w-4 h-4" />
            树状
          </Button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          {/* Level filter */}
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value as LevelFilter)}
            className="px-2 py-1.5 rounded-lg text-sm bg-muted text-foreground"
          >
            <option value="all">全部层级</option>
            <option value="small">小块</option>
            <option value="parent">父块</option>
          </select>

          {/* Sort by */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className="px-2 py-1.5 rounded-lg text-sm bg-muted text-foreground"
          >
            <option value="position">位置</option>
            <option value="qualityScore">质量</option>
            <option value="tokenCount">词数</option>
          </select>

          {/* Sort order */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
          >
            {sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>共 {pagination.total} 个分块</span>
        <span>第 {pagination.page} 页，共 {pagination.totalPages} 页</span>
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
            {chunks.map((chunk, index) => (
              <motion.div
                key={chunk.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05, duration: 0.2 }}
              >
                <ChunkCard
                  chunk={chunk}
                  onViewDetails={handleViewDetails}
                  isNew={newChunks.some(c => c.id === chunk.id)}
                />
              </motion.div>
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
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setPage(pagination.page - 1)}
          disabled={pagination.page <= 1}
        >
          <ChevronLeft className="w-4 h-4" />
          上一页
        </Button>
        <span className="text-sm text-foreground">
          {pagination.page} / {pagination.totalPages}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setPage(pagination.page + 1)}
          disabled={pagination.page >= pagination.totalPages}
        >
          下一页
          <ChevronRight className="w-4 h-4" />
        </Button>
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