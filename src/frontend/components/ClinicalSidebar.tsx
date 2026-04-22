import React from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  Brain,
  BookOpen,
  Clock,
  BarChart3,
  Search,
  FileText,
  Layers,
  ChevronLeft,
  ChevronRight,
  Cpu,
} from 'lucide-react';

/**
 * Navigation tab types
 */
export type MainTab = 'documents' | 'chat' | 'timeline' | 'chunks' | 'retrieval' | 'stats';

/**
 * Navigation item configuration
 */
export interface NavItem {
  id: MainTab;
  label: string;
  icon: React.ReactNode;
  section: 'primary' | 'analysis' | 'system';
}

/**
 * Navigation items configuration
 */
export const navItems: NavItem[] = [
  { id: 'chat', label: '智能诊断', icon: <Brain className="clinical-nav-icon" />, section: 'primary' },
  { id: 'documents', label: '文档病历', icon: <FileText className="clinical-nav-icon" />, section: 'primary' },
  { id: 'chunks', label: '组织切片', icon: <Layers className="clinical-nav-icon" />, section: 'primary' },
  { id: 'timeline', label: '处理监测', icon: <Clock className="clinical-nav-icon" />, section: 'analysis' },
  { id: 'retrieval', label: '检索分析', icon: <Search className="clinical-nav-icon" />, section: 'analysis' },
  { id: 'stats', label: '系统体征', icon: <BarChart3 className="clinical-nav-icon" />, section: 'system' },
];

/**
 * Agent state interface for sidebar display
 */
export interface AgentState {
  status: 'idle' | 'thinking' | 'retrieving' | 'generating';
  entities: number;
  iterations: number;
  tokens: number;
  confidence: number;
}

/**
 * ClinicalSidebar - Medical workstation navigation panel
 *
 * Design: Clinical workstation sidebar aesthetic
 * - Logo with medical branding
 * - Section-based navigation (诊断工具, 分析监测, 系统状态)
 * - Collapsible for compact view
 * - Agent state mini display
 */
interface ClinicalSidebarProps {
  activeTab: MainTab;
  onTabChange: (tab: MainTab) => void;
  collapsed: boolean;
  onCollapseChange: (collapsed: boolean) => void;
  agentState: AgentState;
}

const ClinicalSidebar: React.FC<ClinicalSidebarProps> = ({
  activeTab,
  onTabChange,
  collapsed,
  onCollapseChange,
  agentState,
}) => {
  const primaryItems = navItems.filter(item => item.section === 'primary');
  const analysisItems = navItems.filter(item => item.section === 'analysis');
  const systemItems = navItems.filter(item => item.section === 'system');

  const statusLabels = {
    idle: '待机',
    thinking: '思考中',
    retrieving: '检索中',
    generating: '生成中',
  };

  return (
    <aside className={`clinical-sidebar ${collapsed ? 'collapsed' : ''}`}>
      {/* Logo */}
      <div className="clinical-sidebar-header">
        <div className="clinical-logo">
          <div className="clinical-logo-icon">
            <Activity className="w-5 h-5" />
          </div>
          {!collapsed && (
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
        <NavSection
          title="诊断工具"
          items={primaryItems}
          activeTab={activeTab}
          onTabChange={onTabChange}
          collapsed={collapsed}
        />

        {/* Analysis Section */}
        <NavSection
          title="分析监测"
          items={analysisItems}
          activeTab={activeTab}
          onTabChange={onTabChange}
          collapsed={collapsed}
        />

        {/* System Section */}
        <NavSection
          title="系统状态"
          items={systemItems}
          activeTab={activeTab}
          onTabChange={onTabChange}
          collapsed={collapsed}
        />
      </nav>

      {/* Sidebar Footer - Agent State Mini */}
      <div className="clinical-sidebar-footer">
        {!collapsed ? (
          <div className="agent-state-display" style={{ padding: '12px' }}>
            <div className={`agent-state-status ${agentState.status}`}>
              <div className="agent-state-indicator" />
              <span>{statusLabels[agentState.status]}</span>
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
        onClick={() => onCollapseChange(!collapsed)}
        style={{ marginTop: 'auto', borderTop: '1px solid var(--clinical-border-light)' }}
        role="button"
        tabIndex={0}
      >
        {collapsed ? (
          <ChevronRight className="w-5 h-5" />
        ) : (
          <>
            <ChevronLeft className="w-5 h-5" />
            <span>收起侧栏</span>
          </>
        )}
      </div>
    </aside>
  );
};

/**
 * NavSection - Navigation section with items
 */
const NavSection: React.FC<{
  title: string;
  items: NavItem[];
  activeTab: MainTab;
  onTabChange: (tab: MainTab) => void;
  collapsed: boolean;
}> = ({
  title,
  items,
  activeTab,
  onTabChange,
  collapsed,
}) => (
  <div className="clinical-nav-section">
    {!collapsed && (
      <div className="clinical-nav-section-title">{title}</div>
    )}
    {items.map((item) => (
      <div
        key={item.id}
        className={`clinical-nav-item ${activeTab === item.id ? 'active' : ''}`}
        onClick={() => onTabChange(item.id)}
        role="button"
        tabIndex={0}
      >
        {item.icon}
        {!collapsed && <span>{item.label}</span>}
        {activeTab === item.id && !collapsed && (
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
);

export default ClinicalSidebar;