import React from 'react';
import { motion } from 'framer-motion';
import ClinicalMarkdown from './ClinicalMarkdown';
import { EvidenceCard } from './EvidencePanel';
import {
  Brain,
  Clock,
  Activity,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  BookOpen,
  CheckCircle2,
  XCircle,
  Sparkles,
  Hash,
} from 'lucide-react';

interface Source {
  smallChunkId?: string;
  parentChunkId?: string;
  parentChunkContent?: string;
  similarityScore?: number;
  sourceDocumentId?: string;
  metadata?: {
    pageNumber?: number;
    section?: string;
    documentTitle?: string;  // Human-readable document title
    documentYear?: number;   // Publication year
  };
}

interface AnswerCardProps {
  content: string;
  thinking?: string;
  sources?: Source[];
  confidence?: number;
  iterationCount?: number;
  timestamp?: number;
  streaming?: boolean;
  isUser?: boolean;
}

/**
 * AnswerCard - Clinical-style answer display
 *
 * Features:
 * - Medical entity highlighting (drugs, dosages, indicators)
 * - Markdown rendering with clinical typography
 * - Collapsible thinking chain
 * - Source citations with similarity scores
 * - Confidence indicator
 */
const AnswerCard: React.FC<AnswerCardProps> = ({
  content,
  thinking,
  sources,
  confidence,
  iterationCount,
  timestamp,
  streaming = false,
  isUser = false,
}) => {
  const [thinkingExpanded, setThinkingExpanded] = React.useState(false);
  const [sourcesExpanded, setSourcesExpanded] = React.useState(false);

  if (isUser) {
    return (
      <motion.div
        className="clinical-message user"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="clinical-message-avatar">U</div>
        <div className="clinical-message-bubble clinical-message-user-bubble">
          <div className="clinical-message-content">{content}</div>
          {timestamp && (
            <div className="clinical-message-time">
              {new Date(timestamp).toLocaleTimeString()}
            </div>
          )}
        </div>
      </motion.div>
    );
  }

  // Confidence level determination
  const confidenceLevel = confidence
    ? confidence >= 0.85 ? 'high'
    : confidence >= 0.65 ? 'medium'
    : 'low'
    : 'unknown';

  const confidenceConfig = {
    high: { icon: CheckCircle2, color: 'success', label: '高置信度' },
    medium: { icon: Sparkles, color: 'warning', label: '中置信度' },
    low: { icon: AlertTriangle, color: 'critical', label: '低置信度' },
    unknown: { icon: Activity, color: 'muted', label: '置信度未知' },
  };

  const confConfig = confidenceConfig[confidenceLevel];
  const ConfidenceIcon = confConfig.icon;

  return (
    <motion.div
      className="clinical-answer-card"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      {/* Header */}
      <div className="clinical-answer-header">
        <div className="clinical-answer-title">
          <Brain className="w-4 h-4 text-clinical-primary" />
          <span>诊断结论</span>
          {streaming && (
            <motion.span
              className="clinical-answer-badge success"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              实时生成
            </motion.span>
          )}
        </div>
        <div className="clinical-answer-badge-wrapper">
          {confidence !== undefined && (
            <div className={`clinical-answer-badge ${confConfig.color}`}>
              <ConfidenceIcon className="w-3 h-3 mr-1" />
              {Math.round(confidence * 100)}%
            </div>
          )}
        </div>
      </div>

      {/* Thinking Chain (collapsible) */}
      {thinking && (
        <div className="clinical-thinking-section">
          <button
            className="clinical-thinking-toggle"
            onClick={() => setThinkingExpanded(!thinkingExpanded)}
          >
            <Brain className="w-4 h-4" />
            <span>推理过程</span>
            {thinkingExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
          {thinkingExpanded && (
            <motion.div
              className="clinical-thinking-content"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              <pre className="clinical-thinking-text">{thinking}</pre>
            </motion.div>
          )}
        </div>
      )}

      {/* Answer Body */}
      <div className="clinical-answer-body">
        <ClinicalMarkdown
          content={content}
          streaming={streaming}
        />
      </div>

      {/* Sources Section - Evidence Cards */}
      {sources && sources.length > 0 && (
        <div className="clinical-sources-section">
          <button
            className="clinical-sources-toggle"
            onClick={() => setSourcesExpanded(!sourcesExpanded)}
          >
            <BookOpen className="w-4 h-4" />
            <span>证据来源</span>
            <span className="clinical-sources-count">{sources.length} 条</span>
            {sourcesExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
          {sourcesExpanded && (
            <motion.div
              className="clinical-sources-list"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              {sources.map((source, idx) => (
                <EvidenceCard
                  key={source.smallChunkId ?? idx}
                  result={{
                    smallChunkId: source.smallChunkId ?? `src-${idx}`,
                    parentChunkId: source.parentChunkId,
                    parentChunkContent: source.parentChunkContent ?? '',
                    similarityScore: source.similarityScore ?? 0,
                    sourceDocumentId: source.sourceDocumentId,
                    metadata: source.metadata,
                  }}
                  index={idx}
                />
              ))}
            </motion.div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="clinical-answer-footer">
        <div className="clinical-answer-meta">
          {iterationCount !== undefined && (
            <div className="clinical-answer-meta-item">
              <Activity className="w-3 h-3" />
              <span>{iterationCount} 次迭代</span>
            </div>
          )}
          {sources?.length !== undefined && (
            <div className="clinical-answer-meta-item">
              <BookOpen className="w-3 h-3" />
              <span>{sources.length} 条来源</span>
            </div>
          )}
        </div>
        {timestamp && (
          <div className="clinical-answer-meta-item">
            <Clock className="w-3 h-3" />
            <span>{new Date(timestamp).toLocaleTimeString()}</span>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default AnswerCard;