/**
 * @spec architecture.md#数据结构
 * @layer 0
 * @description 文档类型定义
 */

export interface Document {
  id: string;
  path: string;
  content: string;
  metadata: DocumentMetadata;
  indexedAt?: Date;
}

export interface DocumentMetadata {
  filename: string;
  extension: string;
  size: number;
  createdAt: Date;
  modifiedAt: Date;
  language?: string;
  mimeType?: string;
}

export interface DocumentFilter {
  extensions?: string[];
  excludePatterns?: string[];
  maxSize?: number;
  minSize?: number;
}