import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ClinicalDocumentManager from './documents/ClinicalDocumentManager';
import { useDocumentStore, useAppStore } from '../store';
import { AlertCircle, RefreshCw } from 'lucide-react';
import type { Document } from '../types/document';

/**
 * ClinicalDocumentManagerWrapper - Connects clinical UI to existing stores
 *
 * Bridges the new ClinicalDocumentManager component with:
 * - Document fetching/loading state
 * - Upload handling with progress
 * - Delete with confirmation
 * - Document selection for chunk navigation
 */
interface ClinicalDocumentManagerWrapperProps {
  onNavigateToChunks?: (documentId: string) => void;
}

const ClinicalDocumentManagerWrapper: React.FC<ClinicalDocumentManagerWrapperProps> = ({
  onNavigateToChunks,
}) => {
  const { documents, isLoading, error, fetchDocuments, uploadDocument, deleteDocument } =
    useDocumentStore();
  const setSelectedDocumentId = useAppStore((state) => state.setSelectedDocumentId);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleUpload = useCallback(async (file: File) => {
    setIsUploading(true);
    setUploadProgress(0);
    setUploadError(null);

    // Simulate progress during upload
    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => Math.min(prev + 10, 90));
    }, 100);

    try {
      await uploadDocument(file);
      setUploadProgress(100);
    } catch (uploadErr) {
      setUploadProgress(0);
      setUploadError(uploadErr instanceof Error ? uploadErr.message : '上传失败，请重试');
    } finally {
      clearInterval(progressInterval);
      setTimeout(() => {
        setUploadProgress(0);
        setIsUploading(false);
      }, 1000);
    }
  }, [uploadDocument]);

  const handleDelete = useCallback(async (id: string) => {
    await deleteDocument(id);
  }, [deleteDocument]);

  const handleView = useCallback((id: string) => {
    setSelectedDocumentId(id);
    if (onNavigateToChunks) {
      onNavigateToChunks(id);
    }
  }, [setSelectedDocumentId, onNavigateToChunks]);

  const handleRefresh = useCallback(async () => {
    await fetchDocuments();
  }, [fetchDocuments]);

  const handleBatchDelete = useCallback(async (ids: string[]) => {
    for (const id of ids) {
      await deleteDocument(id);
    }
  }, [deleteDocument]);

  // Transform documents to ClinicalDocument format
  const clinicalDocuments: Document[] = documents.map(doc => ({
    id: doc.id,
    filename: doc.filename,
    size: doc.size ?? 0,
    uploadTime: doc.uploadedAt ?? Date.now(),
    status: doc.status === 'indexed' ? 'processed' :
            doc.status === 'processing' ? 'processing' :
            doc.status === 'error' ? 'error' : 'pending',
    fileType: doc.filename.split('.').pop()?.toLowerCase() ?? 'unknown',
  }));

  return (
    <div className="clinical-document-wrapper">
      {/* Error Banner - Store Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            className="clinical-error-banner"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <AlertCircle className="clinical-error-icon" />
            <span>{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upload Error Banner */}
      <AnimatePresence>
        {uploadError && (
          <motion.div
            className="clinical-error-banner upload-error"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            onClick={() => setUploadError(null)}
          >
            <AlertCircle className="clinical-error-icon" />
            <span>上传错误: {uploadError}</span>
            <button className="clinical-error-dismiss">点击关闭</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Document Manager */}
      <ClinicalDocumentManager
        documents={clinicalDocuments}
        onUpload={handleUpload}
        onDelete={handleDelete}
        onView={handleView}
        onRefresh={handleRefresh}
        onBatchDelete={handleBatchDelete}
        isUploading={isUploading}
        uploadProgress={uploadProgress}
      />
    </div>
  );
};

export default ClinicalDocumentManagerWrapper;