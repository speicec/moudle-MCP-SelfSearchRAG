import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ChatWindow from './ChatWindow';
import DocumentManager from './DocumentManager';
import PipelineTimeline from './PipelineTimeline';
import ChunkExplorer from './ChunkExplorer';
import RetrievalFlow from './RetrievalFlow';
import StatsDashboard from './StatsDashboard';
import RetrievalResultPanel from './RetrievalResultPanel';
import { useConnectionStore, useAppStore } from '../store';
import { useWebSocketConnection } from '../hooks/useWebSocket';

type MainTab = 'documents' | 'chat' | 'timeline' | 'chunks' | 'retrieval' | 'stats';

const mainTabs: Array<{ id: MainTab; label: string }> = [
  { id: 'documents', label: '文档管理' },
  { id: 'chat', label: '智能问答' },
  { id: 'timeline', label: '处理进度' },
  { id: 'chunks', label: '分块结构' },
  { id: 'retrieval', label: '检索过程' },
  { id: 'stats', label: '系统统计' },
];

// Document type for selector
interface Document {
  id: string;
  filename: string;
  status: 'pending' | 'processing' | 'indexed' | 'error';
}

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
 * Document selector component for Chunks tab
 */
const DocumentSelector: React.FC<{
  onNavigateToDocuments: () => void;
}> = ({ onNavigateToDocuments }) => {
  const { selectedDocumentId, setSelectedDocumentId } = useAppStore();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadDocuments = async () => {
      try {
        const response = await fetch('/api/documents');
        const docs: Document[] = await response.json();
        setDocuments(docs);
      } catch {
        // Error handling
      } finally {
        setIsLoading(false);
      }
    };
    loadDocuments();
  }, []);

  const statusLabels = {
    pending: '等待中',
    processing: '处理中',
    indexed: '已索引',
    error: '错误',
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
        选择文档查看分块
      </h3>
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {isLoading ? (
          <div className="text-center py-4 text-gray-500 dark:text-gray-400">
            加载中...
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center py-4 text-gray-500 dark:text-gray-400">
            <p className="mb-2">暂无文档</p>
            <button
              onClick={onNavigateToDocuments}
              className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              前往文档管理上传
            </button>
          </div>
        ) : (
          documents.map((doc) => (
            <button
              key={doc.id}
              onClick={() => setSelectedDocumentId(doc.id)}
              className={`w-full flex items-center justify-between p-2 rounded text-sm transition-colors ${
                selectedDocumentId === doc.id
                  ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                  : 'bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-900 dark:text-white'
              }`}
            >
              <span className="truncate flex-1">{doc.filename}</span>
              <span className={`ml-2 px-1.5 py-0.5 rounded text-xs ${
                doc.status === 'indexed' ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' :
                doc.status === 'processing' ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' :
                doc.status === 'error' ? 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300' :
                'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
              }`}>
                {statusLabels[doc.status]}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
};

/**
 * VisualApp component
 * Main application with tab layout
 */
const VisualApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState<MainTab>(() => {
    // Restore from localStorage, default to 'chat'
    const saved = localStorage.getItem('visualApp:activeTab');
    return (saved as MainTab) ?? 'chat';
  });

  const selectedDocumentId = useAppStore((state) => state.selectedDocumentId);

  // Connect WebSocket
  useWebSocketConnection();

  // Persist tab state
  useEffect(() => {
    localStorage.setItem('visualApp:activeTab', activeTab);
  }, [activeTab]);

  // Tab animation variants
  const tabVariants = {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
  };

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
            <nav className="flex -mb-px" role="tablist" aria-label="主导航">
              {mainTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  aria-controls={`tabpanel-${tab.id}`}
                  tabIndex={activeTab === tab.id ? 0 : -1}
                  className={`px-4 py-3 font-medium text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
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

        {/* Tab content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            id={`tabpanel-${activeTab}`}
            role="tabpanel"
            aria-labelledby={activeTab}
            initial="initial"
            animate="animate"
            exit="exit"
            variants={tabVariants}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            {/* Documents Tab - full width */}
            {activeTab === 'documents' && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                <DocumentManager onNavigateToChunks={(docId) => setActiveTab('chunks')} />
              </div>
            )}

            {/* Chat Tab - Split View: Chat left, Retrieval results right */}
            {activeTab === 'chat' && (
              <div className="grid grid-cols-12 gap-6">
                <div className="col-span-8">
                  <ChatWindow />
                </div>
                <div className="col-span-4">
                  <RetrievalResultPanel />
                </div>
              </div>
            )}

            {/* Timeline Tab - full width */}
            {activeTab === 'timeline' && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                <PipelineTimeline />
              </div>
            )}

            {/* Chunks Tab - Split View: Document list left, Chunks right */}
            {activeTab === 'chunks' && (
              <div className="grid grid-cols-12 gap-6">
                <div className="col-span-4">
                  <DocumentSelector onNavigateToDocuments={() => setActiveTab('documents')} />
                </div>
                <div className="col-span-8">
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                    <ChunkExplorer documentId={selectedDocumentId ?? undefined} />
                  </div>
                </div>
              </div>
            )}

            {/* Retrieval Tab - full width */}
            {activeTab === 'retrieval' && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                <RetrievalFlow />
              </div>
            )}

            {/* Stats Tab - full width */}
            {activeTab === 'stats' && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                <StatsDashboard />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
};

export default VisualApp;