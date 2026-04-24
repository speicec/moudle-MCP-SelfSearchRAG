import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  ChevronDown,
  Activity,
  ShieldCheck,
  AlertCircle,
  Hash,
  Copy,
  Check,
  Globe,
  Flag,
  Building,
  Clock,
} from 'lucide-react';

/**
 * Literature types for GRADE evaluation
 */
type LiteratureType = 'rct' | 'meta_analysis' | 'guideline' | 'observational' | 'case_report' | 'expert_opinion';

/**
 * Source authority levels
 */
type SourceAuthorityLevel = 'international' | 'national' | 'local';

/**
 * Evidence Quality Levels - Clinical lab result style
 */
type EvidenceQuality = 'A' | 'B' | 'C' | 'D';

/**
 * GRADE Evidence Evaluation (from backend)
 */
interface EvidenceEvaluation {
  literatureType: LiteratureType;
  grade: EvidenceQuality;
  isCurrent: boolean;
  year?: number;
  sourceGuideline?: string;
  expirationWarning?: string;
  sourceAuthority?: SourceAuthorityLevel;
  authorityWeight?: number;
  timeWeight?: number;
  consistencyScore?: number;
  compositeScore?: number;
}

interface EvidenceResult {
  smallChunkId: string;
  parentChunkId?: string;
  parentChunkContent: string;
  similarityScore: number;
  sourceDocumentId?: string;
  confidenceLevel?: 'high' | 'medium' | 'low';
  metadata?: {
    pageNumber?: number;
    section?: string;
    documentType?: string;
    // Document-level metadata from chunk
    documentTitle?: string;  // Human-readable document title
    documentYear?: number;   // Publication year
  };
  // GRADE evidence evaluation (new)
  evidenceEvaluation?: EvidenceEvaluation;
}

/**
 * Literature type labels
 */
const LITERATURE_TYPE_LABELS: Record<LiteratureType, string> = {
  rct: 'RCT 研究',
  meta_analysis: 'Meta 分析',
  guideline: '临床指南',
  observational: '观察研究',
  case_report: '病例报告',
  expert_opinion: '专家意见',
};

/**
 * Authority level labels and icons
 */
const AUTHORITY_CONFIG: Record<SourceAuthorityLevel, { label: string; icon: React.ElementType }> = {
  international: { label: '国际', icon: Globe },
  national: { label: '国家', icon: Flag },
  local: { label: '本地', icon: Building },
};

/**
 * Calculate evidence quality grade based on similarity
 * A: ≥85% (High confidence, guideline level)
 * B: ≥70% (Moderate confidence, study level)
 * C: ≥50% (Low confidence, case report level)
 * D: <50% (Very low, anecdotal level)
 */
function getEvidenceQuality(score: number): EvidenceQuality {
  if (score >= 0.85) return 'A';
  if (score >= 0.70) return 'B';
  if (score >= 0.50) return 'C';
  return 'D';
}

/**
 * Get grade from backend GRADE evaluation, fallback to similarityScore
 * Priority: backend GRADE > similarityScore threshold
 */
function getGradeFromEvaluation(result: EvidenceResult): EvidenceQuality {
  // If backend GRADE is available, use it
  if (result.evidenceEvaluation?.grade) {
    return result.evidenceEvaluation.grade;
  }
  // Fallback to similarityScore threshold
  return getEvidenceQuality(result.similarityScore);
}

/**
 * Check if result has GRADE evaluation data
 */
function hasGradeEvaluation(result: EvidenceResult): boolean {
  return result.evidenceEvaluation !== undefined;
}

/**
 * Check if result has time decay warning
 */
function hasTimeDecayWarning(result: EvidenceResult): boolean {
  const evaluation = result.evidenceEvaluation;
  if (!evaluation) return false;
  // Time weight below 0.7 or has expiration warning
  return (evaluation.timeWeight !== undefined && evaluation.timeWeight < 0.7) || evaluation.expirationWarning !== undefined;
}

function getQualityConfig(quality: EvidenceQuality) {
  const configs = {
    A: {
      label: '高质量证据',
      description: '指南级别，可直接引用',
      color: 'success',
      icon: ShieldCheck,
    },
    B: {
      label: '中等质量',
      description: '研究级别，需结合其他证据',
      color: 'primary',
      icon: Activity,
    },
    C: {
      label: '低质量',
      description: '案例级别，谨慎引用',
      color: 'warning',
      icon: AlertCircle,
    },
    D: {
      label: '极低质量',
      description: '仅供参考',
      color: 'muted',
      icon: AlertCircle,
    },
  };
  return configs[quality];
}

/**
 * EvidenceCard - Single retrieval result as lab evidence report
 *
 * Design: Clinical lab report aesthetic
 * - Evidence quality grading (A/B/C/D)
 * - GRADE literature type badge
 * - Authority level indicator
 * - Time decay warning
 * - Sample ID style numbering
 * - Confidence bar visualization
 * - Source document tracking
 */
const EvidenceCard: React.FC<{
  result: EvidenceResult;
  index: number;
  showQualityBadge?: boolean;
}> = ({
  result,
  index,
  showQualityBadge = true,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  // Use GRADE evaluation if available, fallback to similarity
  const quality = useMemo(
    () => getGradeFromEvaluation(result),
    [result]
  );
  const qualityConfig = getQualityConfig(quality);
  const QualityIcon = qualityConfig.icon;

  // GRADE-specific data
  const hasGRADE = hasGradeEvaluation(result);
  const literatureTypeLabel = result.evidenceEvaluation?.literatureType
    ? LITERATURE_TYPE_LABELS[result.evidenceEvaluation.literatureType]
    : null;
  const authorityConfig = result.evidenceEvaluation?.sourceAuthority
    ? AUTHORITY_CONFIG[result.evidenceEvaluation.sourceAuthority]
    : null;
  const AuthorityIcon = authorityConfig?.icon;
  const hasTimeWarning = hasTimeDecayWarning(result);

  // Generate sample-style ID
  const sampleId = `EV-${String(index + 1).padStart(3, '0')}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(result.parentChunkContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      className="clinical-evidence-card"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      layout
    >
      {/* Header - Sample identification */}
      <div className="clinical-evidence-header">
        <div className="clinical-evidence-id-section">
          <div className="clinical-evidence-sample-id">
            <Hash className="w-3 h-3" />
            <span>{sampleId}</span>
          </div>
          {(result.metadata?.documentTitle || result.sourceDocumentId) && (
            <div className="clinical-evidence-source-doc">
              <FileText className="w-3 h-3" />
              <span>
                {result.metadata?.documentTitle
                  ? (result.metadata.documentTitle.length > 25
                    ? result.metadata.documentTitle.slice(0, 25) + '...'
                    : result.metadata.documentTitle)
                  : (result.sourceDocumentId?.slice(0, 20) ?? 'Unknown')}
              </span>
              {result.metadata?.documentYear && (
                <span className="clinical-evidence-year">
                  ({result.metadata.documentYear})
                </span>
              )}
            </div>
          )}
        </div>

        <div className="clinical-evidence-quality-section">
          {/* Confidence bar */}
          <div className="clinical-evidence-confidence-bar">
            <motion.div
              className="clinical-evidence-confidence-fill"
              initial={{ width: 0 }}
              animate={{ width: `${result.similarityScore * 100}%` }}
              transition={{ duration: 0.5, delay: 0.2 }}
              data-quality={quality}
            />
            <span className="clinical-evidence-confidence-value">
              {Math.round(result.similarityScore * 100)}%
            </span>
          </div>

          {/* Quality badge with GRADE type */}
          {showQualityBadge && (
            <div className="clinical-evidence-quality-badge-container">
              <div className={`clinical-evidence-quality-badge ${qualityConfig.color}`}>
                <QualityIcon className="w-3 h-3" />
                <span className="clinical-evidence-quality-grade">{quality}</span>
              </div>
              {/* GRADE literature type badge */}
              {hasGRADE && literatureTypeLabel && (
                <div className="clinical-evidence-grade-type-badge">
                  <span>{literatureTypeLabel}</span>
                </div>
              )}
              {/* Authority indicator */}
              {hasGRADE && authorityConfig && AuthorityIcon && (
                <div className={`clinical-evidence-authority-badge ${result.evidenceEvaluation?.sourceAuthority}`}>
                  <AuthorityIcon className="w-3 h-3" />
                  <span>{authorityConfig.label}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Time decay warning */}
      {hasTimeWarning && (
        <div className="clinical-evidence-time-warning">
          <Clock className="w-3 h-3" />
          <span>
            {result.evidenceEvaluation?.expirationWarning ?? '证据时效性降低'}
            {result.evidenceEvaluation?.timeWeight && (
              <span className="clinical-evidence-time-weight">
                (时效权重: {result.evidenceEvaluation.timeWeight.toFixed(2)})
              </span>
            )}
          </span>
        </div>
      )}

      {/* Toggle button */}
      <button
        className="clinical-evidence-toggle"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="clinical-evidence-toggle-left">
          <span className="clinical-evidence-toggle-label">
            {qualityConfig.label}
          </span>
          {result.metadata?.pageNumber && (
            <span className="clinical-evidence-page">
              · P.{result.metadata.pageNumber}
            </span>
          )}
        </div>
        <motion.div
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="w-4 h-4" />
        </motion.div>
      </button>

      {/* Expandable content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            className="clinical-evidence-content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* Metadata row */}
            <div className="clinical-evidence-metadata">
              {result.metadata?.section && (
                <div className="clinical-evidence-meta-item">
                  <span className="clinical-evidence-meta-label">章节</span>
                  <span className="clinical-evidence-meta-value">
                    {result.metadata.section}
                  </span>
                </div>
              )}
              <div className="clinical-evidence-meta-item">
                <span className="clinical-evidence-meta-label">质量评级</span>
                <span className="clinical-evidence-meta-value">
                  {quality} - {qualityConfig.description}
                  {hasGRADE && <span className="clinical-evidence-grade-source"> (GRADE)</span>}
                </span>
              </div>
              <div className="clinical-evidence-meta-item">
                <span className="clinical-evidence-meta-label">检索得分</span>
                <span className="clinical-evidence-meta-value">
                  {(result.similarityScore * 100).toFixed(1)}%
                </span>
              </div>
              {/* GRADE-specific metadata */}
              {hasGRADE && (
                <>
                  <div className="clinical-evidence-meta-item">
                    <span className="clinical-evidence-meta-label">文献类型</span>
                    <span className="clinical-evidence-meta-value">
                      {literatureTypeLabel ?? '未知'}
                    </span>
                  </div>
                  {result.evidenceEvaluation?.sourceAuthority && (
                    <div className="clinical-evidence-meta-item">
                      <span className="clinical-evidence-meta-label">权威级别</span>
                      <span className="clinical-evidence-meta-value">
                        {authorityConfig?.label ?? result.evidenceEvaluation.sourceAuthority}
                        {result.evidenceEvaluation.authorityWeight && (
                          <span className="clinical-evidence-meta-weight">
                            (权重: {result.evidenceEvaluation.authorityWeight.toFixed(2)})
                          </span>
                        )}
                      </span>
                    </div>
                  )}
                  {result.evidenceEvaluation?.compositeScore !== undefined && (
                    <div className="clinical-evidence-meta-item">
                      <span className="clinical-evidence-meta-label">综合评分</span>
                      <span className="clinical-evidence-meta-value">
                        {(result.evidenceEvaluation.compositeScore * 100).toFixed(1)}%
                      </span>
                    </div>
                  )}
                  {result.evidenceEvaluation?.timeWeight !== undefined && (
                    <div className="clinical-evidence-meta-item">
                      <span className="clinical-evidence-meta-label">时效权重</span>
                      <span className="clinical-evidence-meta-value">
                        {(result.evidenceEvaluation.timeWeight * 100).toFixed(1)}%
                      </span>
                    </div>
                  )}
                  {result.evidenceEvaluation?.consistencyScore !== undefined && (
                    <div className="clinical-evidence-meta-item">
                      <span className="clinical-evidence-meta-label">一致性评分</span>
                      <span className="clinical-evidence-meta-value">
                        {(result.evidenceEvaluation.consistencyScore * 100).toFixed(1)}%
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Content preview */}
            <div className="clinical-evidence-text">
              <div className="clinical-evidence-text-content">
                {result.parentChunkContent}
              </div>
            </div>

            {/* Actions */}
            <div className="clinical-evidence-actions">
              <button
                className="clinical-evidence-action-btn"
                onClick={handleCopy}
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3" />
                    <span>已复制</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>复制内容</span>
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Preview snippet when collapsed */}
      {!expanded && (
        <div className="clinical-evidence-preview">
          {result.parentChunkContent.slice(0, 120)}
          {result.parentChunkContent.length > 120 && '...'}
        </div>
      )}
    </motion.div>
  );
};
/**
 * EvidencePanel - Container for multiple evidence cards
 *
 * Features:
 * - Summary statistics
 * - Quality distribution chart
 * - Sort/filter options
 */
const EvidencePanel: React.FC<{
  results: EvidenceResult[];
  title?: string;
  isLoading?: boolean;
}> = ({
  results,
  title = '证据来源',
  isLoading = false,
}) => {
  const [sortBy, setSortBy] = useState<'quality' | 'score'>('score');

  // Calculate statistics - use GRADE when available
  const stats = useMemo(() => {
    const qualityCounts = { A: 0, B: 0, C: 0, D: 0 };
    results.forEach(r => {
      // Use GRADE evaluation if available, fallback to similarity
      qualityCounts[getGradeFromEvaluation(r)]++;
    });
    const avgScore = results.length > 0
      ? results.reduce((sum, r) => sum + r.similarityScore, 0) / results.length
      : 0;

    // Calculate average compositeScore from GRADE data
    const gradeResults = results.filter(r => r.evidenceEvaluation?.compositeScore !== undefined);
    const avgCompositeScore = gradeResults.length > 0
      ? gradeResults.reduce((sum, r) => sum + (r.evidenceEvaluation?.compositeScore ?? 0), 0) / gradeResults.length
      : null;

    // Check if any results have GRADE data
    const hasGradeData = results.some(r => hasGradeEvaluation(r));

    return { qualityCounts, avgScore, avgCompositeScore, hasGradeData };
  }, [results]);

  // Sort results - use GRADE when available
  const sortedResults = useMemo(() => {
    return [...results].sort((a, b) => {
      if (sortBy === 'score') {
        return b.similarityScore - a.similarityScore;
      }
      return getGradeFromEvaluation(b).localeCompare(
        getGradeFromEvaluation(a)
      );
    });
  }, [results, sortBy]);

  if (results.length === 0 && !isLoading) {
    return (
      <div className="clinical-evidence-panel-empty">
        <div className="clinical-evidence-empty-icon">
          <Activity className="w-8 h-8 opacity-30" />
        </div>
        <p className="clinical-evidence-empty-title">暂无证据来源</p>
        <p className="clinical-evidence-empty-desc">
          发送问题后将显示检索到的相关证据
        </p>
      </div>
    );
  }

  return (
    <div className="clinical-evidence-panel">
      {/* Header */}
      <div className="clinical-evidence-panel-header">
        <div className="clinical-evidence-panel-title-section">
          <h3 className="clinical-evidence-panel-title">{title}</h3>
          <span className="clinical-evidence-panel-count">
            {results.length} 条证据
          </span>
        </div>

        {/* Average score indicator */}
        {results.length > 0 && (
          <div className="clinical-evidence-panel-stats">
            <div className="clinical-evidence-stat-item">
              <span className="clinical-evidence-stat-label">平均匹配度</span>
              <span className="clinical-evidence-stat-value">
                {Math.round(stats.avgScore * 100)}%
              </span>
            </div>
            {/* Average compositeScore from GRADE */}
            {stats.avgCompositeScore !== null && (
              <div className="clinical-evidence-stat-item">
                <span className="clinical-evidence-stat-label">平均综合评分</span>
                <span className="clinical-evidence-stat-value">
                  {Math.round(stats.avgCompositeScore * 100)}%
                </span>
              </div>
            )}
            {/* GRADE indicator */}
            {stats.hasGradeData && (
              <div className="clinical-evidence-grade-indicator">
                <ShieldCheck className="w-3 h-3" />
                <span>GRADE</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Quality distribution */}
      {results.length > 0 && (
        <div className="clinical-evidence-quality-distribution">
          <div className="clinical-evidence-quality-bar">
            {(['A', 'B', 'C', 'D'] as EvidenceQuality[]).map(q => {
              const count = stats.qualityCounts[q];
              const width = results.length > 0
                ? (count / results.length) * 100
                : 0;
              return (
                <motion.div
                  key={q}
                  className={`clinical-evidence-quality-segment ${q}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${width}%` }}
                  transition={{ duration: 0.5 }}
                />
              );
            })}
          </div>
          <div className="clinical-evidence-quality-labels">
            {(['A', 'B', 'C', 'D'] as EvidenceQuality[]).map(q => (
              <div key={q} className="clinical-evidence-quality-label">
                <span className="clinical-evidence-quality-label-grade">{q}</span>
                <span className="clinical-evidence-quality-label-count">
                  {stats.qualityCounts[q]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sort control */}
      <div className="clinical-evidence-panel-controls">
        <div className="clinical-evidence-sort-control">
          <span className="clinical-evidence-sort-label">排序方式</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'quality' | 'score')}
            className="clinical-evidence-sort-select"
          >
            <option value="score">匹配度优先</option>
            <option value="quality">质量评级优先</option>
          </select>
        </div>
      </div>

      {/* Evidence list */}
      <div className="clinical-evidence-list">
        {isLoading ? (
          <div className="clinical-evidence-loading">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            >
              <Activity className="w-6 h-6" />
            </motion.div>
            <span>正在检索证据...</span>
          </div>
        ) : (
          sortedResults.map((result, index) => (
            <EvidenceCard
              key={result.smallChunkId}
              result={result}
              index={index}
            />
          ))
        )}
      </div>
    </div>
  );
};

export { EvidenceCard, EvidencePanel };
export default EvidencePanel;