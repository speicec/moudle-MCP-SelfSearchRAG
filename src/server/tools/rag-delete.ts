/**
 * @spec tools.md#rag_delete
 * @layer 6
 * @description 删除文档Tool实现
 */

import type {
  RagDeleteInput,
  RagDeleteOutput,
  ToolDefinition,
  ToolHandler
} from './interface';
import type { IVectorStore, IMetadataStore } from '../../storage/interface';

export const ragDeleteDefinition: ToolDefinition = {
  name: 'rag_delete',
  description: '删除已索引文档',
  inputSchema: {
    type: 'object',
    properties: {
      doc_id: { type: 'string', description: '文档ID' },
      path: { type: 'string', description: '文档路径（可选）' }
    },
    required: []
  }
};

export function createRagDeleteHandler(
  vectorStore: IVectorStore,
  metadataStore: IMetadataStore
): ToolHandler<RagDeleteInput, RagDeleteOutput> {
  return async (input: RagDeleteInput): Promise<RagDeleteOutput> => {
    try {
      let docId = input.doc_id;

      // 如果提供了路径但没有doc_id，需要查找
      if (!docId && input.path) {
        const docs = await metadataStore.listDocuments();
        const doc = docs.find(d => d.path === input.path);
        if (doc) {
          docId = doc.id;
        } else {
          return { deleted: false, chunks_removed: 0 };
        }
      }

      if (!docId) {
        return { deleted: false, chunks_removed: 0 };
      }

      // 获取文档的chunks数量
      const chunks = await metadataStore.getChunksByDocId(docId);
      const chunksRemoved = chunks.length;

      // 从向量库删除
      await vectorStore.deleteByDocId(docId);

      // 从元数据存储删除
      await metadataStore.deleteDocument(docId);

      return { deleted: true, chunks_removed: chunksRemoved };
    } catch (err) {
      console.error('Delete error:', err);
      return { deleted: false, chunks_removed: 0 };
    }
  };
}