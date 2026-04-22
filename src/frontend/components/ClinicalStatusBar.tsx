import React from 'react';
import { Wifi, Database, Cpu, Zap } from 'lucide-react';

/**
 * ClinicalStatusBar - Medical workstation status footer
 *
 * Design: Clinical status bar aesthetic
 * - WebSocket connection status
 * - Vector index status
 * - LLM model info
 * - Agent mode and version
 */
interface ClinicalStatusBarProps {
  agentMode?: string;
  version?: string;
  llmModel?: string;
}

const ClinicalStatusBar: React.FC<ClinicalStatusBarProps> = ({
  agentMode = 'ReAct/PlanAndExecute',
  version = 'v1.0.0',
  llmModel = 'glm-5',
}) => {
  return (
    <footer className="clinical-statusbar">
      {/* Left section - System status */}
      <div className="clinical-statusbar-section">
        <StatusBarItem
          dotClass="connected"
          label="WebSocket 已连接"
        />
        <StatusBarItem
          icon={<Database className="w-4 h-4" />}
          label="向量索引: 就绪"
        />
        <StatusBarItem
          icon={<Cpu className="w-4 h-4" />}
          label={`LLM: ${llmModel}`}
        />
      </div>

      {/* Right section - Agent info */}
      <div className="clinical-statusbar-section">
        <StatusBarItem
          icon={<Zap className="w-4 h-4" />}
          label={`Agent 模式: ${agentMode}`}
        />
        <StatusBarItem
          icon={<Wifi className="w-4 h-4" />}
          label={version}
        />
      </div>
    </footer>
  );
};

/**
 * StatusBarItem - Single status bar item
 */
const StatusBarItem: React.FC<{
  dotClass?: string;
  icon?: React.ReactNode;
  label: string;
}> = ({
  dotClass,
  icon,
  label,
}) => (
  <div className="clinical-statusbar-item">
    {dotClass && <div className={`clinical-statusbar-dot ${dotClass}`} />}
    {icon}
    <span>{label}</span>
  </div>
);

export default ClinicalStatusBar;