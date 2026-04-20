import React, { useEffect, useState } from 'react';
import { useDocumentStore } from '../store';
import { useAppStore } from '../store';
import { AlertCircle } from 'lucide-react';
import Skeleton, { SkeletonGroup } from './ui/Skeleton';
import UploadArea from './documents/UploadArea';
import DocumentList from './documents/DocumentList';

interface DocumentManagerProps {
  onNavigateToChunks?: (documentId: string) => void;
}

const DocumentManager: React.FC<DocumentManagerProps> = ({ onNavigateToChunks }) => {
  const { documents, isLoading, error, fetchDocuments, uploadDocument, deleteDocument } =
    useDocumentStore();
  const setSelectedDocumentId = useAppStore((state) => state.setSelectedDocumentId);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleFileSelect = async (file: File) => {
    setUploadProgress(0);
    // Simulate progress
    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => Math.min(prev + 10, 90));
    }, 100);

    try {
      await uploadDocument(file);
      setUploadProgress(100);
    } catch {
      setUploadProgress(0);
    } finally {
      clearInterval(progressInterval);
      setTimeout(() => setUploadProgress(0), 1000);
    }
  };

  const handleDelete = async (id: string) => {
    if (deleteConfirm === id) {
      await deleteDocument(id);
      setDeleteConfirm(null);
    } else {
      setDeleteConfirm(id);
      setTimeout(() => setDeleteConfirm(null), 3000);
    }
  };

  return (
    <div className="space-y-4">
      {/* Upload section */}
      <UploadArea onFileSelect={handleFileSelect} uploadProgress={uploadProgress} />

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 bg-destructive/20 text-destructive p-3 rounded">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Loading indicator */}
      {isLoading && documents.length === 0 && (
        <SkeletonGroup type="document-list" count={3} />
      )}

      {/* Document list */}
      {documents.length > 0 ? (
        <DocumentList
          documents={documents}
          deleteConfirm={deleteConfirm}
          onDelete={handleDelete}
          onNavigateToChunks={onNavigateToChunks}
          setSelectedDocumentId={setSelectedDocumentId}
        />
      ) : !isLoading ? (
        <div className="text-center py-8 text-muted-foreground">
          暂无已上传的文档
        </div>
      ) : null}
    </div>
  );
};

export default DocumentManager;