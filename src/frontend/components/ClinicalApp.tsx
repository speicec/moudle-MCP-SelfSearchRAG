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
import {
  Activity,
  Brain,
  BookOpen,
  Clock,
  BarChart3,
  Search,
  FileText,
  Layers,
  Settings,
  ChevronLeft,
  ChevronRight,
  Wifi,
  Cpu,
  Database,
  Zap,
} from 'lucide-react';

type MainTab = 'documents' | 'chat' | 'timeline' | 'chunks' | 'retrieval' | 'stats';

interface NavItem {
  id: MainTab;
  label: string;
  icon: React.ReactNode;
  section: 'primary' | 'analysis' | 'system';
}

const navItems: NavItem[] = [
  { id: 'chat', label: '智能诊断', icon: <Brain className="clinical-nav-icon" />, section: 'primary' },
  { id: 'documents', label: '文档病历', icon: <FileText className="clinical-nav-icon" />, section: 'primary' },
  { id: 'chunks', label: '组织切片', icon: <Layers className="clinical-nav-icon" />, section: 'primary' },
  { id: 'timeline', label: '处理监测', icon: <Clock className="clinical-nav-icon" />, section: 'analysis' },
  { id: 'retrieval', label: '检索分析', icon: <Search className="clinical-nav-icon" />, section: 'analysis' },
  { id: 'stats', label: '系统体征', icon: <BarChart3 className="clinical-nav-icon" />, section: 'system' },
];

/**
 * ClinicalApp - Medical workstation-style interface
 *
 * Design: Clinical Dashboard aesthetic
 * - Sidebar navigation (workstation style)
 * - Vital signs monitoring for agent state
 * - Status bar with connection/system info
 * - Clean panels with medical-grade typography
 */
const ClinicalApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState<MainTab>(() => {
    const saved = localStorage.getItem('visualApp:activeTab');
    return (saved as MainTab) ?? 'chat';
  });

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const selectedDocumentId = useAppStore((state) => state.selectedDocumentId);

  // Agent state simulation (would be real data from store)
  const [agentState, setAgentState] = useState({
    status: 'idle' as 'idle' | 'thinking' | 'retrieving' | 'generating',
    entities: 0,
    iterations: 0,
    tokens: 0,
    confidence: 0,
  });

  useWebSocketConnection();

  useEffect(() => {
    localStorage.setItem('visualApp:activeTab', activeTab);
  }, [activeTab]);

  // Simulate agent state changes (connect to real store later)
  useEffect(() => {
    const interval = setInterval(() => {
      // This would be replaced with real agent state from store
      if (Math.random() > 0.95) {
        const states = ['idle', 'thinking', 'retrieving', 'generating'] as const;
        setAgentState(prev => ({
          ...prev,
          status: states[Math.floor(Math.random() * states.length)],
          entities: Math.floor(Math.random() * 5),
          iterations: Math.floor(Math.random() * 3),
          tokens: Math.floor(Math.random() * 1000),
          confidence: Math.random(),
        }));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const currentNavItem = navItems.find(item => item.id === activeTab);
  const primaryItems = navItems.filter(item => item.section === 'primary');
  const analysisItems = navItems.filter(item => item.section === 'analysis');
  const systemItems = navItems.filter(item => item.section === 'system');

  return (
    <div className="clinical-app">
      {/* Body: Sidebar + Main */}
      <div className="clinical-body">
        {/* Sidebar */}
        <aside className={`clinical-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
          {/* Logo */}
          <div className="clinical-sidebar-header">
            <div className="clinical-logo">
              <div className="clinical-logo-icon">
                <Activity className="w-5 h-5" />
              </div>
              {!sidebarCollapsed && (
                <div>
                  <div className="clinical-logo-text">Medical Agent</div>
                  <div className="clinical-logo-sub">Clinical Intelligence</div>
                </div>
              )}
            </div>
          </div>

          {/* Navigation */}
          <nav className="clinical-nav">
            {/* Primary Section */}
            <div className="clinical-nav-section">
              {!sidebarCollapsed && (
                <div className="clinical-nav-section-title">诊断工具</div>
              )}
              {primaryItems.map((item) => (
                <div
                  key={item.id}
                  className={`clinical-nav-item ${activeTab === item.id ? 'active' : ''}`}
                  onClick={() => setActiveTab(item.id)}
                  role="button"
                  tabIndex={0}
                >
                  {item.icon}
                  {!sidebarCollapsed && <span>{item.label}</span>}
                  {activeTab === item.id && !sidebarCollapsed && (
                    <motion.div
                      layoutId="activeIndicator"
                      className="clinical-nav-badge"
                      initial={false}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    >
                      ●
                    </motion.div>
                  )}
                </div>
              ))}
            </div>

            {/* Analysis Section */}
            <div className="clinical-nav-section">
              {!sidebarCollapsed && (
                <div className="clinical-nav-section-title">分析监测</div>
              )}
              {analysisItems.map((item) => (
                <div
                  key={item.id}
                  className={`clinical-nav-item ${activeTab === item.id ? 'active' : ''}`}
                  onClick={() => setActiveTab(item.id)}
                  role="button"
                  tabIndex={0}
                >
                  {item.icon}
                  {!sidebarCollapsed && <span>{item.label}</span>}
                </div>
              ))}
            </div>

            {/* System Section */}
            <div className="clinical-nav-section">
              {!sidebarCollapsed && (
                <div className="clinical-nav-section-title">系统状态</div>
              )}
              {systemItems.map((item) => (
                <div
                  key={item.id}
                  className={`clinical-nav-item ${activeTab === item.id ? 'active' : ''}`}
                  onClick={() => setActiveTab(item.id)}
                  role="button"
                  tabIndex={0}
                >
                  {item.icon}
                  {!sidebarCollapsed && <span>{item.label}</span>}
                </div>
              ))}
            </div>
          </nav>

          {/* Sidebar Footer - Agent State Mini */}
          <div className="clinical-sidebar-footer">
            {!sidebarCollapsed ? (
              <div className="agent-state-display" style={{ padding: '12px' }}>
                <div className="agent-state-status idle">
                  <div className="agent-state-indicator" />
                  <span>
                    {agentState.status === 'idle' ? '待机' :
                     agentState.status === 'thinking' ? '思考中' :
                     agentState.status === 'retrieving' ? '检索中' : '生成中'}
                  </span>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center' }}>
                <Cpu className="w-5 h-5 text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Collapse Toggle */}
          <div
            className="clinical-nav-item"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            style={{ marginTop: 'auto', borderTop: '1px solid var(--clinical-border-light)' }}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="w-5 h-5" />
            ) : (
              <>
                <ChevronLeft className="w-5 h-5" />
                <span>收起侧栏</span>
              </>
            )}
          </div>
        </aside>

        {/* Main Content */}
        <main className="clinical-main">
          {/* Header */}
          <header className="clinical-header">
            <div className="clinical-header-title">
              {currentNavItem?.icon}
              <h2>{currentNavItem?.label}</h2>
              <span className="clinical-header-subtitle">
                {activeTab === 'chat' && 'AI驱动的医学知识检索与诊断'}
                {activeTab === 'documents' && '文档上传与管理'}
                {activeTab === 'timeline' && '实时处理流程监测'}
                {activeTab === 'chunks' && '文档结构化分块视图'}
                {activeTab === 'retrieval' && '检索策略与结果分析'}
                {activeTab === 'stats' && '系统运行状态指标'}
              </span>
            </div>
            <div className="clinical-header-actions">
              {/* Vital Stats Mini */}
              {activeTab === 'chat' && (
                <div className="vital-monitor" style={{ display: 'flex', gap: '16px', padding: 0 }}>
                  <div className="vital-card" style={{ padding: '8px 16px', '--vital-color': 'var(--clinical-accent)' } as React.CSSProperties}>
                    <div className="vital-card-label">实体</div>
                    <div className="vital-card-value" style={{ fontSize: '18px' }}>{agentState.entities}</div>
                  </div>
                  <div className="vital-card" style={{ padding: '8px 16px', '--vital-color': 'var(--clinical-primary)' } as React.CSSProperties}>
                    <div className="vital-card-label">迭代</div>
                    <div className="vital-card-value" style={{ fontSize: '18px' }}>{agentState.iterations}</div>
                  </div>
                  <div className="vital-card" style={{ padding: '8px 16px', '--vital-color': 'var(--clinical-success)' } as React.CSSProperties}>
                    <div className="vital-card-label">置信</div>
                    <div className="vital-card-value" style={{ fontSize: '18px' }}>
                      {agentState.confidence > 0 ? `${Math.round(agentState.confidence * 100)}%` : '--'}
                    </div>
                  </div>
                </div>
              )}
              <ConnectionIndicator />
            </div>
          </header>

          {/* Content Area */}
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
                {/* Documents Tab */}
                {activeTab === 'documents' && (
                  <div className="clinical-panel">
                    <div className="clinical-panel-body">
                      <DocumentManager onNavigateToChunks={(docId) => setActiveTab('chunks')} />
                    </div>
                  </div>
                )}

                {/* Chat Tab - Split Layout */}
                {activeTab === 'chat' && (
                  <div className="clinical-grid-chat">
                    <div className="clinical-panel">
                      <div className="clinical-panel-header">
                        <div className="clinical-panel-title">
                          <Brain className="clinical-panel-icon" />
                          诊断对话
                        </div>
                        <span className="clinical-panel-badge">实时</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100% - 60px)' }}>
                        <ChatWindow />
                      </div>
                    </div>
                    <div className="clinical-panel">
                      <div className="clinical-panel-header">
                        <div className="clinical-panel-title">
                          <BookOpen className="clinical-panel-icon" />
                          检索依据
                        </div>
                      </div>
                      <div className="clinical-panel-body">
                        <RetrievalResultPanel />
                      </div>
                    </div>
                  </div>
                )}

                {/* Timeline Tab */}
                {activeTab === 'timeline' && (
                  <div className="clinical-panel">
                    <div className="clinical-panel-header">
                      <div className="clinical-panel-title">
                        <Clock className="clinical-panel-icon" />
                        处理时间线
                      </div>
                      <span className="clinical-panel-badge">监测</span>
                    </div>
                    <div className="clinical-panel-body">
                      <PipelineTimeline />
                    </div>
                  </div>
                )}

                {/* Chunks Tab */}
                {activeTab === 'chunks' && (
                  <div className="clinical-grid-2">
                    <div className="clinical-panel">
                      <div className="clinical-panel-header">
                        <div className="clinical-panel-title">
                          <FileText className="clinical-panel-icon" />
                          文档列表
                        </div>
                      </div>
                      <div className="clinical-panel-body">
                        <DocumentSelector onNavigateToDocuments={() => setActiveTab('documents')} />
                      </div>
                    </div>
                    <div className="clinical-panel">
                      <div className="clinical-panel-header">
                        <div className="clinical-panel-title">
                          <Layers className="clinical-panel-icon" />
                          分块结构
                        </div>
                      </div>
                      <div className="clinical-panel-body">
                        <ChunkExplorer documentId={selectedDocumentId ?? undefined} />
                      </div>
                    </div>
                  </div>
                )}

                {/* Retrieval Tab */}
                {activeTab === 'retrieval' && (
                  <div className="clinical-panel">
                    <div className="clinical-panel-header">
                      <div className="clinical-panel-title">
                        <Search className="clinical-panel-icon" />
                        检索流程
                      </div>
                      <span className="clinical-panel-badge">分析</span>
                    </div>
                    <div className="clinical-panel-body">
                      <RetrievalFlow />
                    </div>
                  </div>
                )}

                {/* Stats Tab */}
                {activeTab === 'stats' && (
                  <div className="clinical-panel">
                    <div className="clinical-panel-header">
                      <div className="clinical-panel-title">
                        <BarChart3 className="clinical-panel-icon" />
                        系统指标
                      </div>
                    </div>
                    <div className="clinical-panel-body">
                      <StatsDashboard />
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* Status Bar */}
      <footer className="clinical-statusbar">
        <div className="clinical-statusbar-section">
          <div className="clinical-statusbar-item">
            <div className="clinical-statusbar-dot connected" />
            <span>WebSocket 已连接</span>
          </div>
          <div className="clinical-statusbar-item">
            <Database className="w-4 h-4" />
            <span>向量索引: 就绪</span>
          </div>
          <div className="clinical-statusbar-item">
            <Cpu className="w-4 h-4" />
            <span>LLM: glm-5</span>
          </div>
        </div>
        <div className="clinical-statusbar-section">
          <div className="clinical-statusbar-item">
            <Zap className="w-4 h-4" />
            <span>Agent 模式: ReAct/PlanAndExecute</span>
          </div>
          <div className="clinical-statusbar-item">
            <Wifi className="w-4 h-4" />
            <span>v1.0.0</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default ClinicalApp;