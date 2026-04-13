import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTimelineStore, type StageMetrics } from '../store';

const stageLabels: Record<string, string> = {
  ingest: 'Ingest',
  parse: 'Parse',
  embed: 'Embed',
  index: 'Index',
};

const stageDescriptions: Record<string, string> = {
  ingest: 'Reading document content',
  parse: 'Extracting text and structure',
  embed: 'Generating embeddings',
  index: 'Building search index',
};

const stageColors: Record<string, { bg: string; border: string; text: string }> = {
  ingest: { bg: 'bg-amber-100 dark:bg-amber-900', border: 'border-amber-500', text: 'text-amber-600 dark:text-amber-400' },
  parse: { bg: 'bg-violet-100 dark:bg-violet-900', border: 'border-violet-500', text: 'text-violet-600 dark:text-violet-400' },
  embed: { bg: 'bg-blue-100 dark:bg-blue-900', border: 'border-blue-500', text: 'text-blue-600 dark:text-blue-400' },
  index: { bg: 'bg-green-100 dark:bg-green-900', border: 'border-green-500', text: 'text-green-600 dark:text-green-400' },
};

/**
 * Format metrics for display
 */
function formatMetrics(metrics: StageMetrics | undefined, stageName: string): React.ReactNode {
  if (!metrics) return null;

  const items: Array<{ label: string; value: string }> = [];

  if (metrics.fileSizeBytes) {
    items.push({ label: 'File Size', value: `${(metrics.fileSizeBytes / 1024).toFixed(1)} KB` });
  }
  if (metrics.pagesExtracted) {
    items.push({ label: 'Pages', value: String(metrics.pagesExtracted) });
  }
  if (metrics.tokensExtracted) {
    items.push({ label: 'Tokens', value: String(metrics.tokensExtracted) });
  }
  if (metrics.embeddingDimension) {
    items.push({ label: 'Embed Dim', value: String(metrics.embeddingDimension) });
  }
  if (metrics.chunksCreated) {
    items.push({ label: 'Chunks', value: String(metrics.chunksCreated) });
  }
  if (metrics.processingTimeMs) {
    items.push({ label: 'Time', value: `${metrics.processingTimeMs}ms` });
  }
  if (metrics.throughput) {
    items.push({ label: 'Speed', value: `${metrics.throughput.toFixed(1)}/s` });
  }

  if (items.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-2 text-xs">
      {items.map((item, index) => (
        <div key={index} className="flex flex-col">
          <span className="text-gray-500 dark:text-gray-400">{item.label}</span>
          <span className="font-medium text-gray-900 dark:text-white">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Stage card component with animation
 */
const StageCard: React.FC<{
  stage: { name: string; status: string; progress: number; duration?: number; metrics?: StageMetrics };
  index: number;
  isLast: boolean;
}> = ({ stage, index, isLast }) => {
  const colors = stageColors[stage.name] ?? stageColors.ingest;
  const isRunning = stage.status === 'running';
  const isCompleted = stage.status === 'completed';
  const isError = stage.status === 'error';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="relative"
    >
      {/* Connection line */}
      {!isLast && (
        <div className="absolute top-12 left-1/2 w-full h-0.5 -translate-y-1/2">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: isCompleted || isRunning ? '100%' : '0%' }}
            transition={{ duration: 0.5 }}
            className={`h-full ${isCompleted ? 'bg-green-500' : isRunning ? 'bg-blue-500' : 'bg-gray-200 dark:bg-gray-700'}`}
          />
        </div>
      )}

      {/* Stage card */}
      <div className={`relative p-4 rounded-lg border-2 ${colors.border} ${colors.bg}`}>
        {/* Status indicator */}
        <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center bg-white dark:bg-gray-800 border-2">
          {isCompleted && (
            <motion.svg
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-4 h-4 text-green-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </motion.svg>
          )}
          {isError && (
            <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
          {isRunning && (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full"
            />
          )}
        </div>

        {/* Stage header */}
        <div className="flex items-center justify-between mb-2">
          <h3 className={`text-lg font-semibold ${colors.text}`}>
            {stageLabels[stage.name]}
          </h3>
          {stage.duration && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {stage.duration}ms
            </span>
          )}
        </div>

        {/* Description */}
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
          {isRunning ? stageDescriptions[stage.name] : isCompleted ? 'Completed' : isError ? 'Error' : 'Waiting'}
        </p>

        {/* Progress bar (for running stage) */}
        <AnimatePresence>
          {isRunning && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mb-3"
            >
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                <motion.div
                  className="h-1.5 rounded-full bg-blue-500"
                  animate={{ width: `${stage.progress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Metrics card */}
        <AnimatePresence>
          {isCompleted && stage.metrics && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="mt-3 p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-600"
            >
              {formatMetrics(stage.metrics, stage.name)}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

/**
 * PipelineTimeline component
 * Shows detailed timeline visualization with time axis and stage metrics
 */
const PipelineTimeline: React.FC = () => {
  const { stages, isRunning, currentDocumentId, totalDuration, startTime } = useTimelineStore();

  const completedCount = stages.filter((s) => s.status === 'completed').length;
  const totalProgress = Math.round(
    stages.reduce((sum, s) => sum + s.progress, 0) / stages.length
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Processing Timeline
          </h2>
          {currentDocumentId && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Document: {currentDocumentId.slice(0, 8)}...
            </p>
          )}
        </div>
        <div className="flex items-center gap-4">
          {startTime && (
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Started: {new Date(startTime).toLocaleTimeString()}
            </span>
          )}
          {totalDuration > 0 && (
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              Total: {(totalDuration / 1000).toFixed(2)}s
            </span>
          )}
        </div>
      </div>

      {/* Overall progress */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <motion.div
              className={`h-2 rounded-full ${isRunning ? 'bg-blue-600' : 'bg-green-600'}`}
              animate={{ width: `${totalProgress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
        <span className="text-sm font-medium text-gray-900 dark:text-white">
          {totalProgress}%
        </span>
      </div>

      {/* Time axis */}
      <div className="relative px-4">
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-2">
          <span>0s</span>
          <span>{((totalDuration || 0) / 1000).toFixed(1)}s</span>
        </div>
        <div className="w-full h-1 bg-gray-200 dark:bg-gray-700 rounded relative">
          {/* Stage markers */}
          {stages.map((stage, index) => {
            if (!stage.startTime || !totalDuration) return null;
            const position = ((stage.startTime - (startTime || 0)) / totalDuration) * 100;
            return (
              <motion.div
                key={stage.name}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{ left: `${position}%` }}
                className={`absolute top-0 w-2 h-2 rounded-full -translate-y-1/2 ${stageColors[stage.name]?.border ?? 'border-gray-500'} border-2 bg-white dark:bg-gray-800`}
              />
            );
          })}
        </div>
      </div>

      {/* Stage cards */}
      <div className="grid grid-cols-4 gap-4">
        {stages.map((stage, index) => (
          <StageCard
            key={stage.name}
            stage={stage}
            index={index}
            isLast={index === stages.length - 1}
          />
        ))}
      </div>

      {/* Footer stats */}
      <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 pt-4 border-t border-gray-200 dark:border-gray-700">
        <span>
          {completedCount}/{stages.length} stages completed
        </span>
        <span className={isRunning ? 'text-blue-600 dark:text-blue-400' : 'text-green-600 dark:text-green-400'}>
          {isRunning ? 'Processing...' : completedCount === stages.length ? 'Complete' : 'Idle'}
        </span>
      </div>
    </div>
  );
};

export default PipelineTimeline;