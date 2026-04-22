import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Clock,
  HardDrive,
  Hash,
  MoreVertical,
  Trash2,
  Download,
  Eye,
  CheckCircle2,
  AlertCircle,
  Activity,
  Archive,
} from 'lucide-react';
import type { Document, DocumentStatus } from '../../types/document';
import { formatFileSize, formatUploadTime } from '../../types/document';

/**
 * ClinicalDocumentList - Document archive with clinical specimen tracking style
 *
 * Design: Medical records archive aesthetic
 * - Each document as specimen record card
 * - Status indicators (processed, processing, error)
 * - Size and timestamp as metadata
 * - Actions dropdown with clinical styling
 */

interface ClinicalDocumentListProps {
  documents: Document[];
  onDelete?: (id: string) => void;
  onView?: (id: string) => void;
  onDownload?: (id: string) => void;
  selectedIds?: string[];
  onSelect?: (id: string) => void;
}

const statusConfig: Record<DocumentStatus, { icon: typeof CheckCircle2; label: string; color: string }> = {
  processed: {
    icon: CheckCircle2,
    label: '已入库',
    color: 'success',
  },
  processing: {
    icon: Activity,
    label: '处理中',
    color: 'primary',
  },
  error: {
    icon: AlertCircle,
    label: '异常',
    color: 'critical',
  },
  pending: {
    icon: Clock,
    label: '待处理',
    color: 'warning',
  },
};

/**
 * DocumentCard - Single document as specimen record
 */
const DocumentCard: React.FC<{
  document: Document;
  index: number;
  onDelete?: (id: string) => void;
  onView?: (id: string) => void;
  onDownload?: (id: string) => void;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
}> = ({
  document,
  index,
  onDelete,
  onView,
  onDownload,
  isSelected,
  onSelect,
}) => {
  const [showActions, setShowActions] = useState(false);

  const status = statusConfig[document.status];
  const StatusIcon = status.icon;

  // Generate specimen-style ID
  const specimenId = `DOC-${String(index + 1).padStart(4, '0')}`;

  const handleAction = (action: () => void) => {
    action();
    setShowActions(false);
  };

  return (
    <motion.div
      className={`clinical-document-card ${isSelected ? 'selected' : ''}`}
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25, delay: index * 0.03 }}
      layout
    >
      {/* Selection checkbox */}
      {onSelect && (
        <div className="clinical-document-select">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onSelect(document.id)}
            className="clinical-document-checkbox"
          />
        </div>
      )}

      {/* Main content */}
      <div className="clinical-document-main">
        {/* Header row */}
        <div className="clinical-document-header">
          <div className="clinical-document-id">
            <Archive className="w-3 h-3" />
            <span>{specimenId}</span>
          </div>
          <div className={`clinical-document-status ${status.color}`}>
            <StatusIcon className="w-3 h-3" />
            <span>{status.label}</span>
          </div>
        </div>

        {/* Filename */}
        <div className="clinical-document-filename">
          <FileText className="w-4 h-4" />
          <span className="clinical-document-name-text">
            {document.filename}
          </span>
          <span className="clinical-document-type">
            {document.fileType.toUpperCase()}
          </span>
        </div>

        {/* Metadata row */}
        <div className="clinical-document-meta">
          <div className="clinical-document-meta-item">
            <HardDrive className="w-3 h-3" />
            <span>{formatFileSize(document.size)}</span>
          </div>
          <div className="clinical-document-meta-item">
            <Clock className="w-3 h-3" />
            <span>{formatUploadTime(document.uploadTime)}</span>
          </div>
          {document.chunkCount && (
            <div className="clinical-document-meta-item">
              <Hash className="w-3 h-3" />
              <span>{document.chunkCount} chunks</span>
            </div>
          )}
        </div>
      </div>

      {/* Actions dropdown */}
      <div className="clinical-document-actions">
        <button
          className="clinical-document-actions-toggle"
          onClick={() => setShowActions(!showActions)}
        >
          <MoreVertical className="w-4 h-4" />
        </button>

        <AnimatePresence>
          {showActions && (
            <motion.div
              className="clinical-document-actions-menu"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
            >
              {onView && (
                <button
                  className="clinical-document-action-item"
                  onClick={() => handleAction(() => onView(document.id))}
                >
                  <Eye className="w-3 h-3" />
                  <span>查看详情</span>
                </button>
              )}
              {onDownload && (
                <button
                  className="clinical-document-action-item"
                  onClick={() => handleAction(() => onDownload(document.id))}
                >
                  <Download className="w-3 h-3" />
                  <span>下载原文</span>
                </button>
              )}
              {onDelete && (
                <button
                  className="clinical-document-action-item critical"
                  onClick={() => handleAction(() => onDelete(document.id))}
                >
                  <Trash2 className="w-3 h-3" />
                  <span>删除记录</span>
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

/**
 * ClinicalDocumentList - Container for document cards
 */
const ClinicalDocumentList: React.FC<ClinicalDocumentListProps> = ({
  documents,
  onDelete,
  onView,
  onDownload,
  selectedIds = [],
  onSelect,
}) => {
  if (documents.length === 0) {
    return (
      <div className="clinical-document-empty">
        <div className="clinical-document-empty-icon">
          <Archive className="w-8 h-8 opacity-30" />
        </div>
        <p className="clinical-document-empty-title">样本库为空</p>
        <p className="clinical-document-empty-desc">
          上传医学文档以建立知识样本库
        </p>
      </div>
    );
  }

  // Calculate statistics
  const stats = {
    total: documents.length,
    processed: documents.filter(d => d.status === 'processed').length,
    processing: documents.filter(d => d.status === 'processing').length,
    error: documents.filter(d => d.status === 'error').length,
    totalSize: documents.reduce((sum, d) => sum + d.size, 0),
  };

  return (
    <div className="clinical-document-list">
      {/* Header */}
      <div className="clinical-document-list-header">
        <div className="clinical-document-list-title">
          <Archive className="w-4 h-4" />
          <span>样本档案库</span>
        </div>
        <div className="clinical-document-list-stats">
          <span className="clinical-document-stat">
            {stats.total} 条记录
          </span>
          <span className="clinical-document-stat">
            {formatFileSize(stats.totalSize)}
          </span>
        </div>
      </div>

      {/* Status summary */}
      <div className="clinical-document-status-bar">
        <div className="clinical-document-status-segments">
          {stats.processed > 0 && (
            <div className="clinical-document-status-segment success">
              <CheckCircle2 className="w-3 h-3" />
              <span>{stats.processed}</span>
            </div>
          )}
          {stats.processing > 0 && (
            <div className="clinical-document-status-segment primary">
              <Activity className="w-3 h-3" />
              <span>{stats.processing}</span>
            </div>
          )}
          {stats.error > 0 && (
            <div className="clinical-document-status-segment critical">
              <AlertCircle className="w-3 h-3" />
              <span>{stats.error}</span>
            </div>
          )}
        </div>
      </div>

      {/* Document cards */}
      <div className="clinical-document-cards">
        {documents.map((doc, index) => (
          <DocumentCard
            key={doc.id}
            document={doc}
            index={index}
            onDelete={onDelete}
            onView={onView}
            onDownload={onDownload}
            isSelected={selectedIds.includes(doc.id)}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
};

export default ClinicalDocumentList;