/**
 * @spec architecture.md#Milvus
 * @layer 1
 * @description Milvus 向量存储实现
 */

import { MilvusClient } from '@zilliz/milvus2-sdk-node';
import type { IVectorStore, SearchResult, ChunkWithEmbedding } from '../interface';

export class MilvusVectorStore implements IVectorStore {
  private client: MilvusClient | null = null;
  private collectionName: string;
  private dimension: number = 1536;
  private connected: boolean = false;

  constructor(config: { host: string; port: number; collection: string }) {
    this.collectionName = config.collection;
  }

  async connect(): Promise<void> {
    this.client = new MilvusClient({
      address: `${this.collectionName}`, // 使用环境变量或配置
      timeout: 10000
    });
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.closeConnection();
      this.client = null;
      this.connected = false;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  async createCollection(dimension: number): Promise<void> {
    if (!this.client) throw new Error('Not connected');
    this.dimension = dimension;

    const hasCollection = await this.client.hasCollection({
      collection_name: this.collectionName
    });

    if (hasCollection.value) {
      await this.client.loadCollectionSync({
        collection_name: this.collectionName
      });
      return;
    }

    await this.client.createCollection({
      collection_name: this.collectionName,
      fields: [
        { name: 'id', description: 'Chunk ID', data_type: 'VarChar', max_length: 64, is_primary_key: true },
        { name: 'doc_id', description: 'Document ID', data_type: 'VarChar', max_length: 64 },
        { name: 'embedding', description: 'Vector embedding', data_type: 'FloatVector', dim: dimension },
        { name: 'content', description: 'Chunk content', data_type: 'VarChar', max_length: 8192 },
        { name: 'source', description: 'File path', data_type: 'VarChar', max_length: 512 },
        { name: 'type', description: 'Chunk type', data_type: 'VarChar', max_length: 32 }
      ]
    });

    await this.client.createIndex({
      collection_name: this.collectionName,
      field_name: 'embedding',
      index_type: 'IVF_FLAT',
      metric_type: 'COSINE',
      params: { nlist: 128 }
    });

    await this.client.loadCollectionSync({
      collection_name: this.collectionName
    });
  }

  async dropCollection(): Promise<void> {
    if (!this.client) throw new Error('Not connected');
    await this.client.dropCollection({ collection_name: this.collectionName });
  }

  async insert(chunk: ChunkWithEmbedding): Promise<void> {
    await this.insertBatch([chunk]);
  }

  async insertBatch(chunks: ChunkWithEmbedding[]): Promise<void> {
    if (!this.client) throw new Error('Not connected');

    const data = chunks.map(chunk => ({
      id: chunk.id,
      doc_id: chunk.docId,
      embedding: chunk.embedding,
      content: chunk.content.slice(0, 8191),
      source: chunk.metadata?.section || '',
      type: chunk.metadata?.type || 'text'
    }));

    await this.client.insert({
      collection_name: this.collectionName,
      data
    });
  }

  async delete(chunkId: string): Promise<void> {
    if (!this.client) throw new Error('Not connected');
    await this.client.deleteEntities({
      collection_name: this.collectionName,
      expr: `id == "${chunkId}"`
    });
  }

  async deleteByDocId(docId: string): Promise<void> {
    if (!this.client) throw new Error('Not connected');
    await this.client.deleteEntities({
      collection_name: this.collectionName,
      expr: `doc_id == "${docId}"`
    });
  }

  async search(vector: number[], topK: number, _filter?: object): Promise<SearchResult[]> {
    if (!this.client) throw new Error('Not connected');

    const searchResult = await this.client.search({
      collection_name: this.collectionName,
      vectors: [vector],
      top_k: topK,
      metric_type: 'COSINE',
      params: { nprobe: 16 },
      output_fields: ['id', 'doc_id', 'content', 'source', 'type']
    });

    if (!searchResult.results || searchResult.results.length === 0) {
      return [];
    }

    return searchResult.results[0].map((result: Record<string, unknown>) => {
      const typeVal = result.type as string;
      const validType = (typeVal === 'text' || typeVal === 'code' || typeVal === 'mixed') ? typeVal : 'text';
      return {
        chunkId: result.id as string,
        docId: result.doc_id as string,
        content: result.content as string,
        score: result.score as number,
        source: result.source as string,
        metadata: { type: validType as 'text' | 'code' | 'mixed' }
      };
    });
  }
}