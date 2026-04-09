import React from 'react';
import { usePipelineStore } from '../store';

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
  chunk: 'Creating semantic chunks',
  embed: 'Generating embeddings',
  index: 'Building search index',
};

const PipelineVisualizer: React.FC = () => {
  const { stages, isRunning, currentDocumentId } = usePipelineStore();

  const completedCount = stages.filter((s) => s.status === 'completed').length;
  const totalProgress = Math.round(
    stages.reduce((sum, s) => sum + s.progress, 0) / stages.length
  );

  return (
    <div className="space-y-6">
      {/* Overall progress */}
      <div>
        <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
          <span>Overall Progress</span>
          <span>{totalProgress}%</span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${
              isRunning ? 'bg-blue-600' : 'bg-green-600'
            }`}
            style={{ width: `${totalProgress}%` }}
          />
        </div>
        {currentDocumentId && (
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Document: {currentDocumentId.slice(0, 8)}...
          </div>
        )}
      </div>

      {/* Stage nodes */}
      <div className="relative">
        {/* Connection line */}
        <div className="absolute top-6 left-6 right-6 h-0.5 bg-gray-200 dark:bg-gray-700" />

        <div className="flex justify-between relative">
          {stages.map((stage, index) => (
            <div key={stage.name} className="flex flex-col items-center">
              {/* Node */}
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                  stage.status === 'completed'
                    ? 'bg-green-100 dark:bg-green-900 border-green-500 text-green-600 dark:text-green-400'
                    : stage.status === 'running'
                    ? 'bg-blue-100 dark:bg-blue-900 border-blue-500 text-blue-600 dark:text-blue-400 animate-pulse'
                    : stage.status === 'error'
                    ? 'bg-red-100 dark:bg-red-900 border-red-500 text-red-600 dark:text-red-400'
                    : 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-400'
                }`}
              >
                {stage.status === 'completed' ? (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : stage.status === 'error' ? (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : stage.status === 'running' ? (
                  <span className="text-xs font-bold">{stage.progress}%</span>
                ) : (
                  <span className="text-xs font-bold">{index + 1}</span>
                )}
              </div>

              {/* Label */}
              <div className="mt-2 text-center">
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  {stageLabels[stage.name]}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {stage.status === 'running'
                    ? stageDescriptions[stage.name]
                    : stage.status === 'completed'
                    ? 'Done'
                    : stage.status === 'error'
                    ? stage.message || 'Error'
                    : 'Waiting'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Stats */}
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

export default PipelineVisualizer;