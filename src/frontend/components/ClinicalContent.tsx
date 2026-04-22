import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ChatWindow from './ChatWindow';
import ClinicalDocumentManagerWrapper from './ClinicalDocumentManagerWrapper';
import PipelineTimeline from './PipelineTimeline';
import ChunkExplorer from './ChunkExplorer';
import RetrievalFlow from './RetrievalFlow';
import StatsDashboard from './StatsDashboard';
import RetrievalResultPanel from './RetrievalResultPanel';
import DocumentSelector from './common/DocumentSelector';
import { useAppStore } from '../store';
import { Brain, BookOpen, Clock, FileText, Layers, Search, BarChart3 } from 'lucide-react';
import type { MainTab } from './ClinicalSidebar';

/**
 * ClinicalContent - Tab-based content routing
 *
 * Design: Clinical panel-based content layout
 * - Animated tab transitions
 * - Split layout for chat tab
 * - Panel-based layout for other tabs
 */

interface ClinicalContentProps {
  activeTab: MainTab;
  onNavigateToChunks?: (docId: string) => void;
  onNavigateToDocuments?: () => void;
}

const ClinicalContent: React.FC<ClinicalContentProps> = ({
  activeTab,
  onNavigateToChunks,
  onNavigateToDocuments,
}) => {
  const selectedDocumentId = useAppStore((state) => state.selectedDocumentId);

  return (
    <div className="clinical-content">
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="clinical-fade-in"
        >
          {renderTabContent(activeTab, selectedDocumentId, onNavigateToChunks, onNavigateToDocuments)}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

/**
 * Render content for specific tab
 */
function renderTabContent(
  tab: MainTab,
  selectedDocumentId: string | null,
  onNavigateToChunks?: (docId: string) => void,
  onNavigateToDocuments?: () => void
) {
  switch (tab) {
    case 'documents':
      return (
        <ClinicalDocumentManagerWrapper
          onNavigateToChunks={onNavigateToChunks}
        />
      );

    case 'chat':
      return (
        <div className="clinical-grid-chat">
          <ClinicalPanel
            title="诊断对话"
            icon={<Brain className="clinical-panel-icon" />}
            badge="实时"
          >
            <ChatWindow />
          </ClinicalPanel>
          <ClinicalPanel
            title="检索依据"
            icon={<BookOpen className="clinical-panel-icon" />}
          >
            <RetrievalResultPanel />
          </ClinicalPanel>
        </div>
      );

    case 'timeline':
      return (
        <ClinicalPanel
          title="处理时间线"
          icon={<Clock className="clinical-panel-icon" />}
          badge="监测"
        >
          <PipelineTimeline />
        </ClinicalPanel>
      );

    case 'chunks':
      return (
        <div className="clinical-grid-2">
          <ClinicalPanel
            title="文档列表"
            icon={<FileText className="clinical-panel-icon" />}
          >
            <DocumentSelector onNavigateToDocuments={onNavigateToDocuments} />
          </ClinicalPanel>
          <ClinicalPanel
            title="分块结构"
            icon={<Layers className="clinical-panel-icon" />}
          >
            <ChunkExplorer documentId={selectedDocumentId ?? undefined} />
          </ClinicalPanel>
        </div>
      );

    case 'retrieval':
      return (
        <ClinicalPanel
          title="检索流程"
          icon={<Search className="clinical-panel-icon" />}
          badge="分析"
        >
          <RetrievalFlow />
        </ClinicalPanel>
      );

    case 'stats':
      return (
        <ClinicalPanel
          title="系统指标"
          icon={<BarChart3 className="clinical-panel-icon" />}
        >
          <StatsDashboard />
        </ClinicalPanel>
      );

    default:
      return null;
  }
}

/**
 * ClinicalPanel - Standard clinical panel wrapper
 */
const ClinicalPanel: React.FC<{
  title: string;
  icon: React.ReactNode;
  badge?: string;
  children: React.ReactNode;
}> = ({
  title,
  icon,
  badge,
  children,
}) => (
  <div className="clinical-panel">
    <div className="clinical-panel-header">
      <div className="clinical-panel-title">
        {icon}
        {title}
      </div>
      {badge && <span className="clinical-panel-badge">{badge}</span>}
    </div>
    <div className="clinical-panel-body">
      {children}
    </div>
  </div>
);

export default ClinicalContent;