import React, { useEffect, useState, useRef } from 'react';
import { useDocumentStore, type Document } from '../store';
import { useAppStore } from '../store';
import { Upload, Trash2, CheckCircle, Clock, AlertCircle, Loader2, Layers } from 'lucide-react';
import Skeleton, { SkeletonGroup } from './ui/Skeleton';

interface DocumentManagerProps {
  onNavigateToChunks?: (documentId: string) => void;
}

const DocumentManager: React.FC<DocumentManagerProps> = ({ onNavigateToChunks }) => {
  const { documents, isLoading, error, fetchDocuments, uploadDocument, deleteDocument } =
    useDocumentStore();
  const setSelectedDocumentId = useAppStore((state) => state.setSelectedDocumentId);
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
    return new Date(timestamp).toLocaleString('zh-CN');
  };

  const statusConfig = {
    pending: { label: '等待中', icon: Clock, className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
    processing: { label: '处理中', icon: Loader2, className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
    indexed: { label: '已索引', icon: CheckCircle, className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
    error: { label: '错误', icon: AlertCircle, className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
  };

  const getStatusBadge = (status: Document['status']) => {
    const config = statusConfig[status];
    const Icon = config.icon;
    return (
      <span className={`flex items-center gap-1 px-2 py-1 text-xs rounded-full ${config.className}`}>
        {status === 'processing' ? <Icon className="w-3 h-3 animate-spin" /> : <Icon className="w-3 h-3" />}
        {config.label}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* Upload section */}
      <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6">
        <div className="text-center">
          <label className="cursor-pointer">
            <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" aria-hidden="true" />
            <span className="text-gray-600 dark:text-gray-400">
              点击上传或拖拽文件
            </span>
            <br />
            <span className="text-sm text-gray-500 dark:text-gray-500">
              支持 PDF、TXT、MD 文件（最大 50MB）
            </span>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.txt,.md"
              onChange={handleFileSelect}
              aria-label="文件上传"
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
                {uploadProgress < 100 ? '上传中...' : '上传完成！'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded">
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

              <div className="flex items-center gap-2 ml-4">
                {/* View chunks button - only for indexed documents */}
                {doc.status === 'indexed' && onNavigateToChunks && (
                  <button
                    onClick={() => {
                      setSelectedDocumentId(doc.id);
                      onNavigateToChunks(doc.id);
                    }}
                    aria-label={`查看 ${doc.filename} 的分块结构`}
                    className="flex items-center gap-1 px-3 py-1 text-sm rounded text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <Layers className="w-4 h-4" aria-hidden="true" />
                    查看分块
                  </button>
                )}

                <button
                  onClick={() => handleDelete(doc.id)}
                  aria-label={deleteConfirm === doc.id ? `确认删除 ${doc.filename}` : `删除 ${doc.filename}`}
                  aria-pressed={deleteConfirm === doc.id}
                  className={`flex items-center gap-1 px-3 py-1 text-sm rounded focus:outline-none focus:ring-2 ${
                    deleteConfirm === doc.id
                      ? 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500'
                      : 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 focus:ring-red-500'
                  }`}
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                  {deleteConfirm === doc.id ? '确认删除？' : '删除'}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : !isLoading ? (
        <div className="text-center py-8 text-gray-600 dark:text-gray-400">
          暂无已上传的文档
        </div>
      ) : null}
    </div>
  );
};

export default DocumentManager;