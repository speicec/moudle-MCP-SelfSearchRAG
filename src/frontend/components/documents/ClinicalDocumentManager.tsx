import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Archive,
  Upload,
  RefreshCw,
  Trash2,
  Layers,
  Activity,
} from 'lucide-react';
import ClinicalUploadArea from './ClinicalUploadArea';
import ClinicalDocumentList from './ClinicalDocumentList';
import type { Document } from '../../types/document';

/**
 * ClinicalDocumentManager - Medical sample archive management interface
 *
 * Design: Clinical specimen tracking dashboard
 * - Upload area as sample collection station
 * - Document list as archive records
 * - Processing status monitoring
 * - Batch operations support
 */

interface ClinicalDocumentManagerProps {
  documents: Document[];
  onUpload: (file: File) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onView?: (id: string) => void;
  onDownload?: (id: string) => void;
  onRefresh?: () => void;
  onBatchDelete?: (ids: string[]) => Promise<void>;
  isUploading?: boolean;
  uploadProgress?: number;
}

const ClinicalDocumentManager: React.FC<ClinicalDocumentManagerProps> = ({
  documents,
  onUpload,
  onDelete,
  onView,
  onDownload,
  onRefresh,
  onBatchDelete,
  isUploading = false,
  uploadProgress = 0,
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [uploadProgressState, setUploadProgressState] = useState(0);

  const handleFileSelect = useCallback(async (file: File) => {
    setUploadProgressState(0);
    try {
      await onUpload(file);
    } catch (error) {
      console.error('Upload failed:', error);
    }
  }, [onUpload]);

  const handleSelect = useCallback((id: string) => {
    setSelectedIds(prev =>
      prev.includes(id)
        ? prev.filter(i => i !== id)
        : [...prev, id]
    );
  }, []);

  const handleRefresh = useCallback(async () => {
    if (onRefresh) {
      setIsRefreshing(true);
      await onRefresh();
      setIsRefreshing(false);
    }
  }, [onRefresh]);

  const handleBatchDelete = useCallback(async () => {
    if (onBatchDelete && selectedIds.length > 0) {
      await onBatchDelete(selectedIds);
      setSelectedIds([]);
    }
  }, [onBatchDelete, selectedIds]);

  // Use external progress if provided, otherwise use internal state
  const currentProgress = uploadProgress ?? uploadProgressState;

  return (
    <motion.div
      className="clinical-document-manager"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      {/* Header */}
      <div className="clinical-document-manager-header">
        <div className="clinical-document-manager-title">
          <Archive className="w-5 h-5" />
          <span>样本档案管理</span>
        </div>
        <div className="clinical-document-manager-actions">
          {onRefresh && (
            <button
              className="clinical-document-manager-btn"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <motion.div
                animate={isRefreshing ? { rotate: 360 } : {}}
                transition={{ duration: 1, repeat: isRefreshing ? Infinity : 0 }}
              >
                <RefreshCw className="w-4 h-4" />
              </motion.div>
              <span>刷新状态</span>
            </button>
          )}
          {selectedIds.length > 0 && onBatchDelete && (
            <button
              className="clinical-document-manager-btn critical"
              onClick={handleBatchDelete}
            >
              <Trash2 className="w-4 h-4" />
              <span>批量删除 ({selectedIds.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* Upload Section */}
      <div className="clinical-document-upload-section">
        <ClinicalUploadArea
          onFileSelect={handleFileSelect}
          uploadProgress={currentProgress}
          isUploading={isUploading}
          acceptedTypes={['.pdf', '.txt', '.md', '.docx']}
          maxFileSize={100}
        />
      </div>

      {/* Processing indicator */}
      <AnimatePresence>
        {documents.some(d => d.status === 'processing') && (
          <motion.div
            className="clinical-document-processing-banner"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <motion.div
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <Activity className="w-4 h-4" />
            </motion.div>
            <span>正在进行样本处理...</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Document List Section */}
      <div className="clinical-document-list-section">
        <ClinicalDocumentList
          documents={documents}
          onDelete={onDelete}
          onView={onView}
          onDownload={onDownload}
          selectedIds={selectedIds}
          onSelect={handleSelect}
        />
      </div>

      {/* Footer stats */}
      {documents.length > 0 && (
        <div className="clinical-document-manager-footer">
          <div className="clinical-document-footer-stat">
            <Layers className="w-3 h-3" />
            <span>{documents.length} 条档案</span>
          </div>
          <div className="clinical-document-footer-stat">
            <Archive className="w-3 h-3" />
            <span>
              {documents.filter(d => d.status === 'processed').length} 已入库
            </span>
          </div>
          {selectedIds.length > 0 && (
            <div className="clinical-document-footer-stat selected">
              <span>{selectedIds.length} 已选中</span>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
};

export default ClinicalDocumentManager;