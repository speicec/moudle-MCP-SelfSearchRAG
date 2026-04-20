import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Startup progress stage
 */
type StartupStage = 'checking' | 'loading_text' | 'loading_multimodal' | 'ready';

/**
 * Startup progress state
 */
interface StartupProgressState {
  stage: StartupStage;
  progress: number;
  message: string;
  model?: string;
  isReady: boolean;
  hasError: boolean;
  errorMessage?: string;
}

/**
 * Stage labels for display
 */
const stageLabels: Record<StartupStage, string> = {
  checking: 'Checking',
  loading_text: 'Loading Text Model',
  loading_multimodal: 'Loading Multimodal Model',
  ready: 'Ready',
};

/**
 * Stage descriptions
 */
const stageDescriptions: Record<StartupStage, string> = {
  checking: 'Checking model cache...',
  loading_text: 'Loading embedding model into memory...',
  loading_multimodal: 'Loading CLIP model for image search...',
  ready: 'Server is ready for document processing',
};

/**
 * Startup progress component
 * Displays model loading progress during server startup
 */
export const StartupProgress: React.FC<{
  onComplete?: () => void;
}> = ({ onComplete }) => {
  const [state, setState] = useState<StartupProgressState>({
    stage: 'checking',
    progress: 0,
    message: 'Connecting to server...',
    isReady: false,
    hasError: false,
  });

  useEffect(() => {
    // Connect to WebSocket for startup progress
    const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setState(prev => ({ ...prev, message: 'Waiting for startup progress...' }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'startup:progress') {
          setState({
            stage: data.stage as StartupStage,
            progress: data.progress,
            message: data.message,
            model: data.model,
            isReady: false,
            hasError: false,
          });
        } else if (data.type === 'startup:ready') {
          setState(prev => ({
            ...prev,
            stage: 'ready',
            progress: 100,
            message: data.message,
            isReady: true,
          }));
          onComplete?.();
        } else if (data.type === 'startup:error') {
          setState(prev => ({
            ...prev,
            isReady: false,
            hasError: true,
            errorMessage: data.message,
          }));
        }
      } catch (e) {
        console.error('Failed to parse WebSocket message:', e);
      }
    };

    ws.onerror = () => {
      setState(prev => ({
        ...prev,
        hasError: true,
        errorMessage: 'WebSocket connection failed',
      }));
    };

    // Cleanup on unmount
    return () => {
      ws.close();
    };
  }, [onComplete]);

  // Progress bar width calculation
  const progressWidth = `${state.progress}%`;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 to-gray-800"
    >
      <div className="w-full max-w-md p-8 rounded-2xl bg-gray-800/50 backdrop-blur border border-gray-700">
        {/* Header */}
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-white mb-2">Starting RAG Server</h2>
          <p className="text-gray-400 text-sm">
            Loading embedding models for document processing
          </p>
        </div>

        {/* Progress Section */}
        <AnimatePresence mode="wait">
          {!state.isReady && !state.hasError && (
            <motion.div
              key="progress"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {/* Current Stage */}
              <div className="flex items-center gap-3">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full"
                />
                <div className="flex-1">
                  <p className="text-white font-medium">
                    {stageLabels[state.stage]}
                    {state.model && <span className="text-gray-400 ml-2">({state.model})</span>}
                  </p>
                  <p className="text-gray-500 text-sm">
                    {state.message || stageDescriptions[state.stage]}
                  </p>
                </div>
                <span className="text-blue-400 font-mono">
                  {state.progress}%
                </span>
              </div>

              {/* Progress Bar */}
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: progressWidth }}
                  className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full"
                />
              </div>

              {/* Model Info */}
              {state.model && (
                <div className="text-xs text-gray-500 text-center">
                  Model: <span className="text-gray-300">{state.model}</span>
                </div>
              )}
            </motion.div>
          )}

          {/* Ready State */}
          {state.isReady && (
            <motion.div
              key="ready"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-6"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200 }}
                className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center"
              >
                <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </motion.div>
              <p className="text-green-400 font-medium text-lg">Ready!</p>
              <p className="text-gray-500 text-sm mt-1">{state.message}</p>
            </motion.div>
          )}

          {/* Error State */}
          {state.hasError && (
            <motion.div
              key="error"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-6"
            >
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
                <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <p className="text-red-400 font-medium text-lg">Startup Error</p>
              <p className="text-gray-500 text-sm mt-1">{state.errorMessage}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white text-sm transition-colors"
              >
                Retry
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-gray-700 text-center">
          <p className="text-gray-500 text-xs">
            First-time startup may take several minutes to download models
          </p>
        </div>
      </div>
    </motion.div>
  );
};

/**
 * Hook for startup progress state
 */
export function useStartupProgress() {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'startup:ready') {
          setIsReady(true);
        } else if (data.type === 'startup:error') {
          setError(data.message);
        }
      } catch {}
    };

    ws.onerror = () => {
      setError('WebSocket connection failed');
    };

    return () => ws.close();
  }, []);

  return { isReady, error };
}