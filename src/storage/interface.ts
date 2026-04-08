/**
 * @spec architecture.md#存储层
 * @layer 1
 * @description 存储层接口定义
 */

// 重新导出需要的类型
export type { Chunk, ChunkWithEmbedding, Document, SearchResult } from '../types';

import type { Chunk, ChunkWithEmbedding, Document, SearchResult } from '../types';

// 向量存储接口
export interface IVectorStore {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  createCollection(dimension: number): Promise<void>;
  dropCollection(): Promise<void>;

  insert(chunk: ChunkWithEmbedding): Promise<void>;
  insertBatch(chunks: ChunkWithEmbedding[]): Promise<void>;
  delete(chunkId: string): Promise<void>;
  deleteByDocId(docId: string): Promise<void>;

  search(vector: number[], topK: number, filter?: object): Promise<SearchResult[]>;
}

// 元数据存储接口
export interface IMetadataStore {
  connect(): Promise<void>;
  disconnect(): Promise<void>;

  saveDocument(doc: Document): Promise<void>;
  getDocument(docId: string): Promise<Document | null>;
  deleteDocument(docId: string): Promise<void>;
  listDocuments(filter?: object): Promise<Document[]>;

  saveChunk(chunk: Chunk): Promise<void>;
  getChunk(chunkId: string): Promise<Chunk | null>;
  getChunksByDocId(docId: string): Promise<Chunk[]>;
  deleteChunksByDocId(docId: string): Promise<void>;

  getStats(): Promise<StorageStats>;
}

// 全文索引接口
export interface IFullTextStore {
  index(chunk: Chunk): Promise<void>;
  indexBatch(chunks: Chunk[]): Promise<void>;
  delete(chunkId: string): Promise<void>;

  search(query: string, topK: number): Promise<SearchResult[]>;
}

// 缓存存储接口
export interface ICacheStore {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;

  getStats(): Promise<CacheStats>;
}

// 存储状态
export interface StorageStats {
  documentCount: number;
  chunkCount: number;
  totalSize: number;
  lastIndexTime?: Date;
}

export interface CacheStats {
  size: number;
  maxSize: number;
  hitRate: number;
  missRate: number;
}