import React, { useState, useEffect } from 'react';
import DocumentManager from './components/DocumentManager';
import ChatWindow from './components/ChatWindow';
import PipelineVisualizer from './components/PipelineVisualizer';
import { useConnectionStore } from './store';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'documents' | 'chat'>('documents');
  const { status, connect, disconnect } = useConnectionStore();

  useEffect(() => {
    // Connect WebSocket on mount
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            RAG Pipeline Dashboard
          </h1>
          <div className="flex items-center gap-4">
            {/* Connection status indicator */}
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  status === 'connected'
                    ? 'bg-green-500'
                    : status === 'reconnecting'
                    ? 'bg-yellow-500 animate-pulse'
                    : 'bg-red-500'
                }`}
              />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {status === 'connected'
                  ? 'Connected'
                  : status === 'reconnecting'
                  ? 'Reconnecting...'
                  : 'Disconnected'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-12 gap-6">
          {/* Left panel - Pipeline visualizer */}
          <div className="col-span-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Pipeline Progress
              </h2>
              <PipelineVisualizer />
            </div>
          </div>

          {/* Right panel - Documents/Chat */}
          <div className="col-span-8">
            {/* Tabs */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
              <div className="border-b border-gray-200 dark:border-gray-700">
                <nav className="flex -mb-px">
                  <button
                    onClick={() => setActiveTab('documents')}
                    className={`px-4 py-2 font-medium ${
                      activeTab === 'documents'
                        ? 'text-blue-600 border-b-2 border-blue-600 dark:text-blue-400 dark:border-blue-400'
                        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                    }`}
                  >
                    Documents
                  </button>
                  <button
                    onClick={() => setActiveTab('chat')}
                    className={`px-4 py-2 font-medium ${
                      activeTab === 'chat'
                        ? 'text-blue-600 border-b-2 border-blue-600 dark:text-blue-400 dark:border-blue-400'
                        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                    }`}
                  >
                    Chat Query
                  </button>
                </nav>
              </div>

              {/* Content */}
              <div className="p-4">
                {activeTab === 'documents' ? <DocumentManager /> : <ChatWindow />}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;