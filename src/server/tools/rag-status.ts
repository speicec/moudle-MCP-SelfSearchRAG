/**
 * @spec tools.md#rag_status
 * @layer 6
 * @description 系统状态Tool实现
 */

import type {
  RagStatusInput,
  RagStatusOutput,
  ToolDefinition,
  ToolHandler
} from './interface';
import type { IVectorStore, IMetadataStore } from '../../storage/interface';
import type { IEmbedder } from '../../embedding/interface';

export const ragStatusDefinition: ToolDefinition = {
  name: 'rag_status',
  description: '查询系统状态',
  inputSchema: {
    type: 'object',
    properties: {}
  }
};

export function createRagStatusHandler(
  vectorStore: IVectorStore,
  metadataStore: IMetadataStore,
  embedder: IEmbedder,
  config: Record<string, unknown>
): ToolHandler<RagStatusInput, RagStatusOutput> {
  return async (_input: RagStatusInput): Promise<RagStatusOutput> => {
    // 获取存储统计
    const stats = await metadataStore.getStats();

    // 检查存储健康状态
    const milvusHealthy = vectorStore.isConnected();
    const sqliteHealthy = true; // SQLite 连接由 metadataStore 管理

    // 获取 Embedder 信息
    const modelInfo = embedder.getModelInfo();

    return {
      indexed_docs: stats.documentCount,
      indexed_chunks: stats.chunkCount,
      storage_health: {
        milvus: milvusHealthy ? 'healthy' : 'unhealthy',
        sqlite: sqliteHealthy ? 'healthy' : 'unhealthy'
      },
      embedding_service: {
        status: 'available',
        model: modelInfo.name
      },
      config
    };
  };
}