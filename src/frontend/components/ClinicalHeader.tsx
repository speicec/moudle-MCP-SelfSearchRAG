import React from 'react';
import { Brain } from 'lucide-react';
import ConnectionIndicator from './common/ConnectionIndicator';
import type { MainTab, NavItem, AgentState } from './ClinicalSidebar';

/**
 * ClinicalHeader - Medical workstation header panel
 *
 * Design: Clinical header with vital monitoring
 * - Current tab title with subtitle
 * - Vital stats mini display for chat tab
 * - Connection indicator
 */

interface ClinicalHeaderProps {
  activeTab: MainTab;
  currentNavItem: NavItem | undefined;
  agentState: AgentState;
}

const ClinicalHeader: React.FC<ClinicalHeaderProps> = ({
  activeTab,
  currentNavItem,
  agentState,
}) => {
  const subtitles: Record<MainTab, string> = {
    chat: 'AI驱动的医学知识检索与诊断',
    documents: '文档上传与管理',
    timeline: '实时处理流程监测',
    chunks: '文档结构化分块视图',
    retrieval: '检索策略与结果分析',
    stats: '系统运行状态指标',
  };

  return (
    <header className="clinical-header">
      <div className="clinical-header-title">
        {currentNavItem?.icon}
        <h2>{currentNavItem?.label}</h2>
        <span className="clinical-header-subtitle">
          {subtitles[activeTab]}
        </span>
      </div>
      <div className="clinical-header-actions">
        {/* Vital Stats Mini */}
        {activeTab === 'chat' && (
          <div className="vital-monitor" style={{ display: 'flex', gap: '16px', padding: 0 }}>
            <VitalCard label="实体" value={agentState.entities} color="var(--clinical-accent)" />
            <VitalCard label="迭代" value={agentState.iterations} color="var(--clinical-primary)" />
            <VitalCard
              label="置信"
              value={agentState.confidence > 0 ? `${Math.round(agentState.confidence * 100)}%` : '--'}
              color="var(--clinical-success)"
            />
          </div>
        )}
        <ConnectionIndicator />
      </div>
    </header>
  );
};

/**
 * VitalCard - Mini vital stats display card
 */
const VitalCard: React.FC<{
  label: string;
  value: string | number;
  color: string;
}> = ({
  label,
  value,
  color,
}) => (
  <div
    className="vital-card"
    style={{ padding: '8px 16px', '--vital-color': color } as React.CSSProperties}
  >
    <div className="vital-card-label">{label}</div>
    <div className="vital-card-value" style={{ fontSize: '18px' }}>{value}</div>
  </div>
);

export default ClinicalHeader;