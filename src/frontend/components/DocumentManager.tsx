import React, { useEffect, useState, useRef } from 'react';
import { useDocumentStore, type Document } from '../store';

const DocumentManager: React.FC = () => {
  const { documents, isLoading, error, fetchDocuments, uploadDocument, deleteDocument } =
    useDocumentStore();
  const [uploadProgress, setUploadProgress] = useState(0);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadProgress(0);
    // Simulate progress (real progress would require XMLHttpRequest or fetch with progress)
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
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setTimeout(() => setUploadProgress(0), 1000);
    }
  };

  const handleDelete = async (id: string) => {
    if (deleteConfirm === id) {
      await deleteDocument(id);
      setDeleteConfirm(null);
    } else {
      setDeleteConfirm(id);
      // Auto-cancel after 3 seconds
      setTimeout(() => setDeleteConfirm(null), 3000);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString();
  };

  const getStatusBadge = (status: Document['status']) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      processing: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      indexed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      error: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    };
    return (
      <span className={`px-2 py-1 text-xs rounded-full ${styles[status]}`}>{status}</span>
    );
  };

  return (
    <div className="space-y-4">
      {/* Upload section */}
      <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6">
        <div className="text-center">
          <label className="cursor-pointer">
            <span className="text-gray-600 dark:text-gray-400">
              Click to upload or drag and drop
            </span>
            <br />
            <span className="text-sm text-gray-500 dark:text-gray-500">
              PDF, TXT, MD (max 50MB)
            </span>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.txt,.md"
              onChange={handleFileSelect}
            />
          </label>

          {/* Upload progress */}
          {uploadProgress > 0 && (
            <div className="mt-4">
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-200"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <span className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {uploadProgress < 100 ? 'Uploading...' : 'Complete!'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded">
          {error}
        </div>
      )}

      {/* Loading indicator */}
      {isLoading && documents.length === 0 && (
        <div className="text-center py-8 text-gray-600 dark:text-gray-400">
          Loading documents...
        </div>
      )}

      {/* Document list */}
      {documents.length > 0 ? (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900 dark:text-white truncate">
                    {doc.filename}
                  </span>
                  {getStatusBadge(doc.status)}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {formatFileSize(doc.size)} • {formatDate(doc.uploadedAt)}
                </div>
                {doc.errorMessage && (
                  <div className="text-sm text-red-600 dark:text-red-400 mt-1">
                    {doc.errorMessage}
                  </div>
                )}
              </div>

              <button
                onClick={() => handleDelete(doc.id)}
                className={`ml-4 px-3 py-1 text-sm rounded ${
                  deleteConfirm === doc.id
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20'
                }`}
              >
                {deleteConfirm === doc.id ? 'Confirm?' : 'Delete'}
              </button>
            </div>
          ))}
        </div>
      ) : !isLoading ? (
        <div className="text-center py-8 text-gray-600 dark:text-gray-400">
          No documents uploaded yet
        </div>
      ) : null}
    </div>
  );
};

export default DocumentManager;