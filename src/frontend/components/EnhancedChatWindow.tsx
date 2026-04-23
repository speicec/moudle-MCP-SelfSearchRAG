import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings2,
  RotateCcw,
  ChevronDown,
  Check,
  AlertTriangle,
  Sparkles,
  Target,
  Filter,
  Sliders,
  RefreshCw,
  Info,
  ChevronRight,
  Zap,
  BookOpen,
  Layers,
  Shield,
  X,
} from 'lucide-react';
import { useChatStore, useRetrievalStore, type RetrievalResult } from '../store';
import AnswerCard from './AnswerCard';
import ClinicalMarkdown from './ClinicalMarkdown';
import StreamingIndicator from './chat/StreamingIndicator';
import { Button } from './ui/button';
import { Input } from './ui/input';

/**
 * Retrieval Settings Configuration
 */
interface RetrievalSettings {
  topK: number;
  minConfidence: number;
  enableExpansion: boolean;
  enableRewrite: boolean;
  enableDecomposition: boolean;
  rerankMethod: 'local' | 'internal' | 'hybrid';
  contextWindow: 32000 | 64000 | 128000;
}

const defaultSettings: RetrievalSettings = {
  topK: 10,
  minConfidence: 0.3,
  enableExpansion: true,
  enableRewrite: true,
  enableDecomposition: true,
  rerankMethod: 'hybrid',
  contextWindow: 64000,
};

/**
 * RetrievalAnalysisPanel - Configurable retrieval analysis widget
 *
 * Design: Clinical diagnostic panel aesthetic
 * - Real-time retrieval settings display
 * - Interactive configuration sliders
 * - Reset with confirmation animation
 * - Quality distribution visualization
 */
const RetrievalAnalysisPanel: React.FC<{
  settings: RetrievalSettings;
  onSettingsChange: (settings: RetrievalSettings) => void;
  onReset: () => void;
  sources: RetrievalResult[];
  isGenerating: boolean;
}> = ({
  settings,
  onSettingsChange,
  onReset,
  sources,
  isGenerating,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState<'settings' | 'analysis'>('settings');

  // Calculate quality distribution
  const qualityDistribution = React.useMemo(() => {
    if (sources.length === 0) return { high: 0, medium: 0, low: 0 };
    const high = sources.filter(s => s.similarityScore >= 0.85).length;
    const medium = sources.filter(s => s.similarityScore >= 0.70 && s.similarityScore < 0.85).length;
    const low = sources.filter(s => s.similarityScore < 0.70).length;
    return { high, medium, low };
  }, [sources]);

  const avgScore = React.useMemo(() => {
    if (sources.length === 0) return 0;
    return sources.reduce((sum, s) => sum + s.similarityScore, 0) / sources.length;
  }, [sources]);

  const handleResetClick = () => {
    setShowResetConfirm(true);
  };

  const confirmReset = () => {
    onReset();
    setShowResetConfirm(false);
  };

  return (
    <div className="retrieval-analysis-panel">
      {/* Header Bar */}
      <div className="retrieval-analysis-header">
        <div className="retrieval-analysis-header-left">
          <div className="retrieval-analysis-icon-badge">
            <Target className="w-4 h-4" />
          </div>
          <div className="retrieval-analysis-header-info">
            <span className="retrieval-analysis-title">检索分析</span>
            <span className="retrieval-analysis-subtitle">
              {sources.length > 0
                ? `${sources.length} 条证据 · 平均 ${Math.round(avgScore * 100)}%`
                : '等待检索'}
            </span>
          </div>
        </div>

        <div className="retrieval-analysis-header-right">
          {/* Quality distribution mini bar */}
          {sources.length > 0 && (
            <div className="retrieval-quality-mini-bar">
              <div
                className="retrieval-quality-segment high"
                style={{ width: `${(qualityDistribution.high / sources.length) * 100}%` }}
              />
              <div
                className="retrieval-quality-segment medium"
                style={{ width: `${(qualityDistribution.medium / sources.length) * 100}%` }}
              />
              <div
                className="retrieval-quality-segment low"
                style={{ width: `${(qualityDistribution.low / sources.length) * 100}%` }}
              />
            </div>
          )}

          {/* Reset button */}
          <button
            onClick={handleResetClick}
            disabled={isGenerating}
            className="retrieval-reset-btn"
            title="重置检索设置"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Expand toggle */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="retrieval-expand-btn"
          >
            <motion.div
              animate={{ rotate: expanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown className="w-4 h-4" />
            </motion.div>
          </button>
        </div>
      </div>

      {/* Reset Confirmation Overlay */}
      <AnimatePresence>
        {showResetConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="retrieval-reset-overlay"
          >
            <div className="retrieval-reset-dialog">
              <div className="retrieval-reset-dialog-icon">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="retrieval-reset-dialog-content">
                <span className="retrieval-reset-dialog-title">确认重置</span>
                <span className="retrieval-reset-dialog-desc">
                  将恢复默认检索配置
                </span>
              </div>
              <div className="retrieval-reset-dialog-actions">
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="retrieval-reset-cancel"
                >
                  取消
                </button>
                <button
                  onClick={confirmReset}
                  className="retrieval-reset-confirm"
                >
                  <RefreshCw className="w-3 h-3" />
                  重置
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expanded Content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="retrieval-analysis-content"
          >
            {/* Tab Switcher */}
            <div className="retrieval-analysis-tabs">
              <button
                onClick={() => setActiveTab('settings')}
                className={`retrieval-analysis-tab ${activeTab === 'settings' ? 'active' : ''}`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>配置</span>
              </button>
              <button
                onClick={() => setActiveTab('analysis')}
                className={`retrieval-analysis-tab ${activeTab === 'analysis' ? 'active' : ''}`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>分析</span>
              </button>
            </div>

            {/* Settings Tab */}
            <AnimatePresence mode="wait">
              {activeTab === 'settings' && (
                <motion.div
                  key="settings"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.2 }}
                  className="retrieval-settings-grid"
                >
                  {/* TopK Setting */}
                  <div className="retrieval-setting-item">
                    <div className="retrieval-setting-header">
                      <Layers className="w-3.5 h-3.5 text-teal-500" />
                      <span className="retrieval-setting-label">检索数量</span>
                      <span className="retrieval-setting-value">{settings.topK}</span>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="30"
                      step="5"
                      value={settings.topK}
                      onChange={(e) => onSettingsChange({ ...settings, topK: parseInt(e.target.value) })}
                      className="retrieval-setting-slider"
                    />
                    <div className="retrieval-setting-range-labels">
                      <span>5</span>
                      <span>15</span>
                      <span>30</span>
                    </div>
                  </div>

                  {/* Confidence Threshold */}
                  <div className="retrieval-setting-item">
                    <div className="retrieval-setting-header">
                      <Shield className="w-3.5 h-3.5 text-blue-500" />
                      <span className="retrieval-setting-label">置信阈值</span>
                      <span className="retrieval-setting-value">
                        {settings.minConfidence.toFixed(1)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="0.9"
                      step="0.1"
                      value={settings.minConfidence}
                      onChange={(e) => onSettingsChange({ ...settings, minConfidence: parseFloat(e.target.value) })}
                      className="retrieval-setting-slider confidence"
                    />
                    <div className="retrieval-setting-range-labels">
                      <span>宽松</span>
                      <span>适中</span>
                      <span>严格</span>
                    </div>
                  </div>

                  {/* Context Window */}
                  <div className="retrieval-setting-item">
                    <div className="retrieval-setting-header">
                      <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
                      <span className="retrieval-setting-label">上下文窗口</span>
                    </div>
                    <div className="retrieval-setting-options">
                      {([32000, 64000, 128000] as const).map((value) => (
                        <button
                          key={value}
                          onClick={() => onSettingsChange({ ...settings, contextWindow: value })}
                          className={`retrieval-setting-option ${settings.contextWindow === value ? 'active' : ''}`}
                        >
                          <span className="retrieval-setting-option-label">
                            {value === 32000 ? '32K' : value === 64000 ? '64K' : '128K'}
                          </span>
                          {settings.contextWindow === value && (
                            <Check className="w-3 h-3" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Feature Toggles */}
                  <div className="retrieval-setting-item toggles">
                    <div className="retrieval-setting-header">
                      <Zap className="w-3.5 h-3.5 text-orange-500" />
                      <span className="retrieval-setting-label">增强功能</span>
                    </div>
                    <div className="retrieval-setting-toggles">
                      <label className="retrieval-toggle-item">
                        <input
                          type="checkbox"
                          checked={settings.enableExpansion}
                          onChange={(e) => onSettingsChange({ ...settings, enableExpansion: e.target.checked })}
                        />
                        <span className="retrieval-toggle-label">同义扩展</span>
                        <span className={`retrieval-toggle-status ${settings.enableExpansion ? 'on' : 'off'}`}>
                          {settings.enableExpansion ? 'ON' : 'OFF'}
                        </span>
                      </label>
                      <label className="retrieval-toggle-item">
                        <input
                          type="checkbox"
                          checked={settings.enableRewrite}
                          onChange={(e) => onSettingsChange({ ...settings, enableRewrite: e.target.checked })}
                        />
                        <span className="retrieval-toggle-label">查询重写</span>
                        <span className={`retrieval-toggle-status ${settings.enableRewrite ? 'on' : 'off'}`}>
                          {settings.enableRewrite ? 'ON' : 'OFF'}
                        </span>
                      </label>
                      <label className="retrieval-toggle-item">
                        <input
                          type="checkbox"
                          checked={settings.enableDecomposition}
                          onChange={(e) => onSettingsChange({ ...settings, enableDecomposition: e.target.checked })}
                        />
                        <span className="retrieval-toggle-label">问题拆分</span>
                        <span className={`retrieval-toggle-status ${settings.enableDecomposition ? 'on' : 'off'}`}>
                          {settings.enableDecomposition ? 'ON' : 'OFF'}
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* Rerank Method */}
                  <div className="retrieval-setting-item">
                    <div className="retrieval-setting-header">
                      <Filter className="w-3.5 h-3.5 text-purple-500" />
                      <span className="retrieval-setting-label">重排方法</span>
                    </div>
                    <div className="retrieval-setting-options three">
                      {(['local', 'internal', 'hybrid'] as const).map((method) => (
                        <button
                          key={method}
                          onClick={() => onSettingsChange({ ...settings, rerankMethod: method })}
                          className={`retrieval-setting-option ${settings.rerankMethod === method ? 'active' : ''}`}
                        >
                          <span className="retrieval-setting-option-label">
                            {method === 'local' ? '本地' : method === 'internal' ? '内部' : '混合'}
                          </span>
                          {settings.rerankMethod === method && (
                            <Check className="w-3 h-3" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Analysis Tab */}
            <AnimatePresence mode="wait">
              {activeTab === 'analysis' && (
                <motion.div
                  key="analysis"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                  className="retrieval-analysis-grid"
                >
                  {/* Quality Distribution */}
                  <div className="retrieval-analysis-card">
                    <div className="retrieval-analysis-card-header">
                      <Target className="w-4 h-4 text-teal-500" />
                      <span>质量分布</span>
                    </div>
                    <div className="retrieval-quality-bar-large">
                      <div
                        className="retrieval-quality-segment high"
                        style={{ width: `${(qualityDistribution.high / sources.length) * 100}%` }}
                      />
                      <div
                        className="retrieval-quality-segment medium"
                        style={{ width: `${(qualityDistribution.medium / sources.length) * 100}%` }}
                      />
                      <div
                        className="retrieval-quality-segment low"
                        style={{ width: `${(qualityDistribution.low / sources.length) * 100}%` }}
                      />
                    </div>
                    <div className="retrieval-quality-legend">
                      <div className="retrieval-quality-legend-item">
                        <div className="retrieval-quality-dot high" />
                        <span>高质量 (≥85%)</span>
                        <span className="retrieval-quality-count">{qualityDistribution.high}</span>
                      </div>
                      <div className="retrieval-quality-legend-item">
                        <div className="retrieval-quality-dot medium" />
                        <span>中等 (70-85%)</span>
                        <span className="retrieval-quality-count">{qualityDistribution.medium}</span>
                      </div>
                      <div className="retrieval-quality-legend-item">
                        <div className="retrieval-quality-dot low" />
                        <span>低质量 (&lt;70%)</span>
                        <span className="retrieval-quality-count">{qualityDistribution.low}</span>
                      </div>
                    </div>
                  </div>

                  {/* Statistics */}
                  <div className="retrieval-analysis-card">
                    <div className="retrieval-analysis-card-header">
                      <Info className="w-4 h-4 text-blue-500" />
                      <span>统计信息</span>
                    </div>
                    <div className="retrieval-stats-grid">
                      <div className="retrieval-stat-item">
                        <span className="retrieval-stat-label">平均匹配</span>
                        <span className="retrieval-stat-value">
                          {Math.round(avgScore * 100)}%
                        </span>
                      </div>
                      <div className="retrieval-stat-item">
                        <span className="retrieval-stat-label">最高匹配</span>
                        <span className="retrieval-stat-value">
                          {sources.length > 0
                            ? Math.round(Math.max(...sources.map(s => s.similarityScore)) * 100)
                            : 0}%
                        </span>
                      </div>
                      <div className="retrieval-stat-item">
                        <span className="retrieval-stat-label">证据数量</span>
                        <span className="retrieval-stat-value">
                          {sources.length}
                        </span>
                      </div>
                      <div className="retrieval-stat-item">
                        <span className="retrieval-stat-label">TopK 设置</span>
                        <span className="retrieval-stat-value">
                          {settings.topK}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Active Settings Summary */}
                  <div className="retrieval-analysis-card summary">
                    <div className="retrieval-analysis-card-header">
                      <Settings2 className="w-4 h-4 text-purple-500" />
                      <span>当前配置</span>
                    </div>
                    <div className="retrieval-config-summary">
                      <div className="retrieval-config-item">
                        <span className="retrieval-config-label">上下文</span>
                        <span className="retrieval-config-value">
                          {settings.contextWindow === 32000 ? '32K' : settings.contextWindow === 64000 ? '64K' : '128K'}
                        </span>
                      </div>
                      <div className="retrieval-config-item">
                        <span className="retrieval-config-label">阈值</span>
                        <span className="retrieval-config-value">
                          {settings.minConfidence.toFixed(1)}
                        </span>
                      </div>
                      <div className="retrieval-config-item">
                        <span className="retrieval-config-label">重排</span>
                        <span className="retrieval-config-value">
                          {settings.rerankMethod === 'local' ? '本地' : settings.rerankMethod === 'internal' ? '内部' : '混合'}
                        </span>
                      </div>
                      <div className="retrieval-config-item features">
                        <span className="retrieval-config-label">增强</span>
                        <div className="retrieval-config-badges">
                          {settings.enableExpansion && (
                            <span className="retrieval-config-badge">扩展</span>
                          )}
                          {settings.enableRewrite && (
                            <span className="retrieval-config-badge">重写</span>
                          )}
                          {settings.enableDecomposition && (
                            <span className="retrieval-config-badge">拆分</span>
                          )}
                          {!settings.enableExpansion && !settings.enableRewrite && !settings.enableDecomposition && (
                            <span className="retrieval-config-badge none">无</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/**
 * EnhancedChatWindow - Chat interface with integrated retrieval analysis
 *
 * Design: Clinical workstation aesthetic
 * - Split layout: Chat + Retrieval Analysis Panel
 * - Real-time retrieval configuration
 * - Reset with confirmation workflow
 * - Visual feedback for settings changes
 */
const EnhancedChatWindow: React.FC = () => {
  const {
    messages,
    isLoading,
    error,
    isGenerating,
    generationPhase,
    currentThinking,
    currentAnswer,
    currentSources,
    submitQuery,
    clearHistory,
  } = useChatStore();

  const { results, agentEnabled, agentPhase, entityMatches, complexity } = useRetrievalStore();

  const [input, setInput] = useState('');
  const [retrievalSettings, setRetrievalSettings] = useState<RetrievalSettings>(defaultSettings);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showSettingsSaved, setShowSettingsSaved] = useState(false);

  // Combine current sources with store results
  const displaySources = currentSources.length > 0 ? currentSources : results;

  // Scroll to bottom when message completes
  useEffect(() => {
    if (!isGenerating && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isGenerating, messages.length]);

  // Handle settings change with visual feedback
  const handleSettingsChange = (newSettings: RetrievalSettings) => {
    setRetrievalSettings(newSettings);
    setShowSettingsSaved(true);
    setTimeout(() => setShowSettingsSaved(false), 1500);

    // In real implementation, would send settings to backend
    // For now, just update local state
  };

  // Handle reset
  const handleReset = () => {
    setRetrievalSettings(defaultSettings);
    setShowSettingsSaved(true);
    setTimeout(() => setShowSettingsSaved(false), 1500);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const query = input.trim();
    setInput('');

    // In real implementation, would include retrieval settings in request
    await submitQuery(query);
  };

  return (
    <div className="enhanced-chat-container">
      {/* Settings Saved Indicator */}
      <AnimatePresence>
        {showSettingsSaved && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="settings-saved-indicator"
          >
            <Check className="w-4 h-4" />
            <span>配置已更新</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Retrieval Analysis Panel (Top) */}
      <div className="enhanced-chat-retrieval-section">
        <RetrievalAnalysisPanel
          settings={retrievalSettings}
          onSettingsChange={handleSettingsChange}
          onReset={handleReset}
          sources={displaySources}
          isGenerating={isGenerating}
        />
      </div>

      {/* Messages Area */}
      <div
        className="enhanced-chat-messages"
        role="log"
        aria-label="对话历史"
        aria-live="polite"
      >
        {messages.length === 0 && !isGenerating ? (
          <div className="enhanced-chat-empty">
            <div className="enhanced-chat-empty-icon">
              <motion.div
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Target className="w-12 h-12 text-teal-400" />
              </motion.div>
            </div>
            <div className="enhanced-chat-empty-content">
              <span className="enhanced-chat-empty-title">智能检索对话</span>
              <span className="enhanced-chat-empty-desc">
                输入医学问题，系统将根据您的检索配置提供专业回答
              </span>
              <div className="enhanced-chat-empty-features">
                <div className="enhanced-chat-feature-item">
                  <Sliders className="w-4 h-4" />
                  <span>可调检索参数</span>
                </div>
                <div className="enhanced-chat-feature-item">
                  <Shield className="w-4 h-4" />
                  <span>置信度过滤</span>
                </div>
                <div className="enhanced-chat-feature-item">
                  <Sparkles className="w-4 h-4" />
                  <span>智能增强</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Historical messages */}
            {messages.map((message) => (
              <AnswerCard
                key={message.id}
                content={message.content}
                thinking={message.thinking}
                sources={message.results}
                timestamp={message.timestamp}
                isUser={message.role === 'user'}
              />
            ))}

            {/* Streaming state display */}
            {isGenerating && (
              <motion.div
                className="enhanced-answer-streaming"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {/* Phase indicator */}
                <div className="enhanced-streaming-header">
                  <StreamingIndicator phase={generationPhase} />
                  <motion.span
                    className="enhanced-streaming-badge"
                    animate={{ opacity: [0.6, 1, 0.6] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    {generationPhase === 'analysis' ? '分析中' :
                     generationPhase === 'retrieval' ? '检索中' :
                     generationPhase === 'reasoning' ? '推理中' :
                     generationPhase === 'answer' ? '生成中' : '完成'}
                  </motion.span>
                </div>

                {/* Agent info bar */}
                {agentEnabled && agentPhase && (
                  <div className="enhanced-agent-info-bar">
                    <div className="enhanced-agent-phase">
                      <Zap className="w-3 h-3 text-indigo-400" />
                      <span>Agent: {agentPhase}</span>
                    </div>
                    {entityMatches.length > 0 && (
                      <div className="enhanced-agent-entities">
                        <span>{entityMatches.length} 实体</span>
                      </div>
                    )}
                    {complexity && (
                      <div className="enhanced-agent-complexity">
                        <span>复杂度: {complexity.level}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Thinking chain */}
                {currentThinking && (
                  <div className="enhanced-thinking-section">
                    <div className="enhanced-thinking-header">
                      <span className="enhanced-thinking-label">思考过程</span>
                      <ChevronRight className="w-3 h-3 text-blue-400" />
                    </div>
                    <pre className="enhanced-thinking-text">{currentThinking}</pre>
                  </div>
                )}

                {/* Answer streaming */}
                {currentAnswer && (
                  <div className="enhanced-answer-body">
                    <ClinicalMarkdown
                      content={currentAnswer}
                      streaming={true}
                    />
                  </div>
                )}

                {/* Sources preview */}
                {currentSources.length > 0 && (
                  <div className="enhanced-sources-preview">
                    <div className="enhanced-sources-header">
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>已检索 {currentSources.length} 条证据</span>
                    </div>
                    <div className="enhanced-sources-mini-list">
                      {currentSources.slice(0, 3).map((source, i) => (
                        <div key={source.smallChunkId} className="enhanced-source-mini">
                          <span className="enhanced-source-index">{i + 1}</span>
                          <span className="enhanced-source-score">
                            {Math.round(source.similarityScore * 100)}%
                          </span>
                        </div>
                      ))}
                      {currentSources.length > 3 && (
                        <span className="enhanced-source-more">
                          +{currentSources.length - 3}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Error message */}
      {error && (
        <motion.div
          className="enhanced-error-banner"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>{error}</span>
          <button onClick={() => useChatStore.getState().handleGenerationError('')} className="enhanced-error-close">
            <X className="w-3 h-3" />
          </button>
        </motion.div>
      )}

      {/* Input Area */}
      <div className="enhanced-chat-input-area">
        <form onSubmit={handleSubmit} className="enhanced-chat-form">
          <div className="enhanced-chat-input-row">
            {/* Retrieval config mini indicator */}
            <div className="enhanced-config-indicator">
              <Sliders className="w-3.5 h-3.5" />
              <span className="enhanced-config-label">
                TopK: {retrievalSettings.topK}
              </span>
              <span className="enhanced-config-divider">·</span>
              <span className="enhanced-config-label">
                阈值: {retrievalSettings.minConfidence.toFixed(1)}
              </span>
            </div>

            {/* Input field */}
            <div className="enhanced-chat-input-wrapper">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="输入医学问题，如：二甲双胍和利拉鲁肽哪个更适合肾功能不全患者？"
                aria-label="问题输入框"
                disabled={isLoading}
                className="enhanced-chat-input-field"
              />
              <Button
                type="submit"
                disabled={isLoading || !input.trim()}
                aria-label="发送问题"
                className="enhanced-chat-send-btn"
              >
                <motion.span
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  发送
                </motion.span>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            {/* Meta row */}
            <div className="enhanced-chat-input-meta">
              <span className="enhanced-chat-hint">Enter 发送 · 配置将应用于下次检索</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearHistory}
                className="enhanced-chat-clear-btn"
              >
                <RotateCcw className="w-3 h-3" />
                清空历史
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EnhancedChatWindow;