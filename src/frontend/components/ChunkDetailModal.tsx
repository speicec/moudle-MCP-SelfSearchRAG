import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ChunkItem } from '../store';

interface ChunkDetailModalProps {
  chunk: ChunkItem | null;
  onClose: () => void;
}

/**
 * ChunkDetailModal component
 * Shows full chunk information in a modal dialog
 */
const ChunkDetailModal: React.FC<ChunkDetailModalProps> = ({ chunk, onClose }) => {
  if (!chunk) return null;

  return (
    <AnimatePresence>
      {chunk && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 flex items-center justify-center p-4 z-50"
          >
            <div className="max-w-2xl w-full max-h-[90vh] bg-white dark:bg-gray-800 rounded-lg shadow-xl overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <span className={`text-sm font-medium px-2 py-1 rounded ${
                  chunk.level === 'parent'
                    ? 'bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}>
                  {chunk.level === 'parent' ? 'Parent Chunk' : 'Small Chunk'}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                  {chunk.id.slice(0, 8)}...
                </span>
              </div>
              <button
                onClick={onClose}
                className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="p-4 max-h-[70vh] overflow-y-auto space-y-4">
              {/* Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900">
                  <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Token用量</span>
                  <span className="text-lg font-semibold text-gray-900 dark:text-white">{chunk.tokenCount}</span>
                </div>
                <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900">
                  <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Quality Score</span>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-semibold text-gray-900 dark:text-white">
                      {(chunk.qualityScore * 100).toFixed(0)}%
                    </span>
                    <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full">
                      <div
                        className={`h-full rounded-full ${
                          chunk.qualityScore >= 0.8 ? 'bg-green-500' : chunk.qualityScore >= 0.5 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${chunk.qualityScore * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900">
                  <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Position</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {chunk.position.start} - {chunk.position.end}
                  </span>
                </div>
              </div>

              {/* Document info */}
              <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900">
                <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Source Document</span>
                <span className="text-sm font-mono text-gray-900 dark:text-white">{chunk.sourceDocumentId}</span>
              </div>

              {/* Parent/Children relations */}
              {chunk.level === 'small' && chunk.parentId && (
                <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700">
                  <span className="text-xs text-blue-600 dark:text-blue-400 block mb-1">Parent Chunk</span>
                  <span className="text-sm font-mono text-blue-900 dark:text-blue-100">{chunk.parentId}</span>
                </div>
              )}
              {chunk.level === 'parent' && chunk.childIds && chunk.childIds.length > 0 && (
                <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700">
                  <span className="text-xs text-blue-600 dark:text-blue-400 block mb-1">
                    Child Chunks ({chunk.childIds.length})
                  </span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {chunk.childIds.slice(0, 5).map((id) => (
                      <span key={id} className="text-xs font-mono bg-white dark:bg-gray-800 px-1.5 py-0.5 rounded">
                        {id.slice(0, 8)}...
                      </span>
                    ))}
                    {chunk.childIds.length > 5 && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        +{chunk.childIds.length - 5} more
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Full content */}
              <div>
                <span className="text-sm font-medium text-gray-900 dark:text-white block mb-2">Content</span>
                <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                  <pre className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap break-words font-sans">
                    {chunk.contentPreview}
                  </pre>
                </div>
              </div>

              {/* Metadata */}
              {chunk.metadata && Object.keys(chunk.metadata).length > 0 && (
                <div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white block mb-2">Metadata</span>
                  <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                    <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                      {JSON.stringify(chunk.metadata, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                Close
              </button>
            </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ChunkDetailModal;