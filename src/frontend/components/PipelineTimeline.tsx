import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTimelineStore, type StageMetrics } from '../store';
import { StageCard, AnimatedFlowLine, GlobalLogPanel } from './timeline';

const stageLabels: Record<string, string> = {
  ingest: 'Ingest',
  parse: 'Parse',
  chunk: 'Chunk',
  embed: 'Embed',
  index: 'Index',
};

const stageDescriptions: Record<string, string> = {
  ingest: 'Reading document content',
  parse: 'Extracting text and structure',
  chunk: 'Creating content chunks',
  embed: 'Generating embeddings',
  index: 'Building search index',
};

const stageColors: Record<string, { bg: string; border: string; text: string }> = {
  ingest: { bg: 'bg-amber-100 dark:bg-amber-900', border: 'border-amber-500', text: 'text-amber-600 dark:text-amber-400' },
  parse: { bg: 'bg-violet-100 dark:bg-violet-900', border: 'border-violet-500', text: 'text-violet-600 dark:text-violet-400' },
  chunk: { bg: 'bg-cyan-100 dark:bg-cyan-900', border: 'border-cyan-500', text: 'text-cyan-600 dark:text-cyan-400' },
  embed: { bg: 'bg-blue-100 dark:bg-blue-900', border: 'border-blue-500', text: 'text-blue-600 dark:text-blue-400' },
  index: { bg: 'bg-green-100 dark:bg-green-900', border: 'border-green-500', text: 'text-green-600 dark:text-green-400' },
};

/**
 * PipelineTimeline component
 * Shows detailed timeline visualization with time axis, stage metrics, and logs
 */
const PipelineTimeline: React.FC = () => {
  const { stages, isRunning, currentDocumentId, totalDuration, startTime, stageLogs, globalLogs } = useTimelineStore();

  const completedCount = stages.filter((s) => s.status === 'completed').length;
  const totalProgress = Math.round(
    stages.reduce((sum, s) => sum + s.progress, 0) / stages.length
  );

  return (
    <div className="space-y-6">
      {/* Gradient Container Header */}
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 dark:from-gray-800 dark:to-gray-900 rounded-lg p-4 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">
              Processing Timeline
            </h2>
            {currentDocumentId && (
              <p className="text-sm text-gray-400">
                Document: {currentDocumentId.slice(0, 8)}...
              </p>
            )}
          </div>
          <div className="flex items-center gap-4">
            {startTime && (
              <span className="text-sm text-gray-400">
                Started: {new Date(startTime).toLocaleTimeString()}
              </span>
            )}
            {totalDuration > 0 && (
              <span className="text-sm font-medium">
                Total: {(totalDuration / 1000).toFixed(2)}s
              </span>
            )}
          </div>
        </div>

        {/* Overall progress bar with pulse animation */}
        <div className="flex items-center gap-4 mt-4">
          <div className="flex-1">
            <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
              <motion.div
                className={`h-2 rounded-full ${isRunning ? 'bg-gradient-to-r from-blue-600 to-blue-400' : 'bg-confidence-high'}`}
                animate={{ width: `${totalProgress}%` }}
                transition={{ duration: 0.3 }}
              />
              {isRunning && (
                <motion.div
                  className="absolute h-2 w-8 bg-gradient-to-r from-transparent via-blue-300 to-transparent rounded-full"
                  animate={{ x: ['-100%', '200%'] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                  style={{ top: 0, left: 0 }}
                />
              )}
            </div>
          </div>
          <span className="text-sm font-medium">
            {totalProgress}%
          </span>
        </div>
      </div>

      {/* Stage cards with flow lines */}
      <div className="flex flex-wrap justify-center gap-2 items-start">
        {stages.map((stage, index) => {
          // Get logs for this stage
          const logs = stageLogs.get(stage.name) || [];

          // Determine flow line state
          const prevStage = index > 0 ? stages[index - 1] : null;
          const isFlowActive = prevStage?.status === 'running' && stage.status === 'pending';
          const isFlowCompleted = prevStage?.status === 'completed';

          return (
            <React.Fragment key={stage.name}>
              {/* Flow line between stages */}
              {index > 0 && (
                <div className="flex items-center h-full pt-4">
                  <AnimatedFlowLine isActive={isFlowActive} isCompleted={isFlowCompleted} />
                </div>
              )}

              {/* Stage card */}
              <div className="min-w-[150px] max-w-[200px]">
                <StageCard stage={stage} logs={logs} index={index} />
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* Footer stats */}
      <div className="flex items-center justify-between text-sm text-muted-foreground pt-4 border-t">
        <span>
          {completedCount}/{stages.length} stages completed
        </span>
        <span className={isRunning ? 'text-status-processing' : completedCount === stages.length ? 'text-confidence-high' : 'text-muted-foreground'}>
          {isRunning ? 'Processing...' : completedCount === stages.length ? 'Complete' : 'Idle'}
        </span>
      </div>

      {/* Global log panel */}
      <GlobalLogPanel logs={globalLogs} />
    </div>
  );
};

export default PipelineTimeline;