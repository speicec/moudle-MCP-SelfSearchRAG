import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ChatWindow from './ChatWindow';
import DocumentManager from './DocumentManager';
import PipelineTimeline from './PipelineTimeline';
import ChunkExplorer from './ChunkExplorer';
import RetrievalFlow from './RetrievalFlow';
import StatsDashboard from './StatsDashboard';
import RetrievalResultPanel from './RetrievalResultPanel';
import ConnectionIndicator from './common/ConnectionIndicator';
import DocumentSelector from './common/DocumentSelector';
import { useAppStore } from '../store';
import { useWebSocketConnection } from '../hooks/useWebSocket';
import { Card } from './ui/card';

type MainTab = 'documents' | 'chat' | 'timeline' | 'chunks' | 'retrieval' | 'stats';

const mainTabs: Array<{ id: MainTab; label: string }> = [
  { id: 'documents', label: '文档管理' },
  { id: 'chat', label: '智能问答' },
  { id: 'timeline', label: '处理进度' },
  { id: 'chunks', label: '分块结构' },
  { id: 'retrieval', label: '检索过程' },
  { id: 'stats', label: '系统统计' },
];

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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-bold text-foreground">
            RAG Pipeline 可视化
          </h1>
          <ConnectionIndicator />
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Tabs */}
        <Card className="mb-4">
          <div className="border-b">
            <nav className="flex -mb-px" role="tablist" aria-label="主导航">
              {mainTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  aria-controls={`tabpanel-${tab.id}`}
                  tabIndex={activeTab === tab.id ? 0 : -1}
                  className={`px-4 py-3 font-medium text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
                    activeTab === tab.id
                      ? 'text-primary border-b-2 border-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </Card>

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
              <Card className="p-4">
                <DocumentManager onNavigateToChunks={(docId) => setActiveTab('chunks')} />
              </Card>
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
              <Card className="p-4">
                <PipelineTimeline />
              </Card>
            )}

            {/* Chunks Tab - Split View: Document list left, Chunks right */}
            {activeTab === 'chunks' && (
              <div className="grid grid-cols-12 gap-6">
                <div className="col-span-4">
                  <DocumentSelector onNavigateToDocuments={() => setActiveTab('documents')} />
                </div>
                <div className="col-span-8">
                  <Card className="p-4">
                    <ChunkExplorer documentId={selectedDocumentId ?? undefined} />
                  </Card>
                </div>
              </div>
            )}

            {/* Retrieval Tab - full width */}
            {activeTab === 'retrieval' && (
              <Card className="p-4">
                <RetrievalFlow />
              </Card>
            )}

            {/* Stats Tab - full width */}
            {activeTab === 'stats' && (
              <Card className="p-4">
                <StatsDashboard />
              </Card>
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
};

export default VisualApp;