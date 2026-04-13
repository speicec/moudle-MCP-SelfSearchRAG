import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ChatWindow from './ChatWindow';
import ThinkingChainDisplay, { ThinkingChainIndicator } from './ThinkingChainDisplay';
import PipelineTimeline from './PipelineTimeline';
import ChunkExplorer from './ChunkExplorer';
import RetrievalFlow from './RetrievalFlow';
import StatsDashboard from './StatsDashboard';
import { useConnectionStore, useDocumentStore, useChatStore } from '../store';
import { useWebSocketConnection } from '../hooks/useWebSocket';

type MainTab = 'chat' | 'timeline' | 'chunks' | 'retrieval' | 'stats';

const mainTabs: Array<{ id: MainTab; label: string }> = [
  { id: 'chat', label: 'Chat' },
  { id: 'timeline', label: '处理进度' },
  { id: 'chunks', label: '分块结构' },
  { id: 'retrieval', label: '检索过程' },
  { id: 'stats', label: '系统统计' },
];

/**
 * Connection status indicator
 */
const ConnectionIndicator: React.FC = () => {
  const { status } = useConnectionStore();

  return (
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
          ? '已连接'
          : status === 'reconnecting'
          ? '重连中...'
          : '已断开'}
      </span>
    </div>
  );
};

/**
 * Quick upload component
 */
const QuickUpload: React.FC = () => {
  const { uploadDocument, isLoading } = useDocumentStore();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadDocument(file);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800">
      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        快速上传
      </h3>
      <label className="block">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.txt,.md"
          onChange={handleFileChange}
          disabled={isLoading}
          className="block w-full text-sm text-gray-500 dark:text-gray-400
            file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0
            file:text-xs file:font-medium
            file:bg-blue-50 dark:file:bg-blue-900 file:text-blue-700 dark:file:text-blue-300
            hover:file:bg-blue-100 dark:hover:file:bg-blue-800
            disabled:opacity-50"
        />
      </label>
    </div>
  );
};

/**
 * Document list component (compact)
 */
const DocumentList: React.FC = () => {
  const { documents, fetchDocuments, isLoading } = useDocumentStore();

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  return (
    <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800">
      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        文档列表 ({documents.length})
      </h3>
      <div className="space-y-1 max-h-40 overflow-y-auto">
        {documents.slice(0, 5).map((doc) => (
          <div key={doc.id} className="flex items-center justify-between text-xs p-1.5 rounded bg-white dark:bg-gray-700">
            <span className="text-gray-900 dark:text-white truncate flex-1">
              {doc.filename}
            </span>
            <span className={`ml-2 px-1.5 py-0.5 rounded text-xs ${
              doc.status === 'indexed' ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' :
              doc.status === 'processing' ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' :
              doc.status === 'error' ? 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300' :
              'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
            }`}>
              {doc.status}
            </span>
          </div>
        ))}
        {documents.length === 0 && (
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-2">
            暂无文档
          </p>
        )}
      </div>
    </div>
  );
};

/**
 * VisualApp component
 * Main application with tab layout and left panel
 */
const VisualApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState<MainTab>(() => {
    // Restore from localStorage, default to 'chat'
    const saved = localStorage.getItem('visualApp:activeTab');
    return (saved as MainTab) ?? 'chat';
  });
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);

  // Connect WebSocket
  useWebSocketConnection();

  // Persist tab state
  useEffect(() => {
    localStorage.setItem('visualApp:activeTab', activeTab);
  }, [activeTab]);

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            RAG Pipeline 可视化
          </h1>
          <ConnectionIndicator />
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Tabs */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-4">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="flex -mb-px">
              {mainTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-3 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'text-blue-600 border-b-2 border-blue-600 dark:text-blue-400 dark:border-blue-400'
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Split View layout for Chat tab */}
        {activeTab === 'chat' ? (
          <div className="grid grid-cols-12 gap-6">
            {/* Chat area - left */}
            <div className="col-span-8">
              <ChatWindow />
            </div>
            {/* Analysis area - right */}
            <div className="col-span-4 space-y-4">
              <QuickUpload />
              <DocumentList />
            </div>
          </div>
        ) : (
          /* Other tabs layout */
          <div className="grid grid-cols-12 gap-6">
            {/* Left panel */}
            <div className="col-span-3 space-y-4">
              <QuickUpload />
              <DocumentList />
            </div>

            {/* Right panel - Main tabs */}
            <div className="col-span-9">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                <div className="p-4">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeTab}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                    >
                      {activeTab === 'timeline' && <PipelineTimeline />}
                      {activeTab === 'chunks' && <ChunkExplorer documentId={selectedDocumentId ?? undefined} />}
                      {activeTab === 'retrieval' && <RetrievalFlow />}
                      {activeTab === 'stats' && <StatsDashboard />}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default VisualApp;