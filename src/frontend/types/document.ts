/**
 * Document Types - Shared document interface definitions
 *
 * Centralizes document-related types to avoid duplication across components
 */

/**
 * Document processing status
 */
export type DocumentStatus = 'processed' | 'processing' | 'error' | 'pending';

/**
 * Document interface - Unified definition for all document components
 */
export interface Document {
  id: string;
  filename: string;
  size: number;
  uploadTime: number;
  status: DocumentStatus;
  chunkCount?: number;
  fileType: string;
}

/**
 * Status configuration for document display
 */
export const documentStatusConfig = {
  processed: {
    label: '已入库',
    color: 'success',
  },
  processing: {
    label: '处理中',
    color: 'primary',
  },
  error: {
    label: '异常',
    color: 'critical',
  },
  pending: {
    label: '待处理',
    color: 'warning',
  },
} as const;

/**
 * Format file size to human-readable string
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Format timestamp to localized date string
 */
export function formatUploadTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}