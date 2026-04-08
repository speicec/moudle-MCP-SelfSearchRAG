/**
 * @spec tools.md#rag_search
 * @layer 6
 * @description 搜索文档Tool实现
 */

import type {
  RagSearchInput,
  RagSearchOutput,
  ToolDefinition,
  ToolHandler
} from './interface';
import type { IVectorStore, IFullTextStore, SearchResult } from '../../storage/interface';
import type { IEmbedder } from '../../embedding/interface';
import { resultFusion } from '../../retrieval/fusion/index';
import type { RecallResult } from '../../retrieval/interface';

export const ragSearchDefinition: ToolDefinition = {
  name: 'rag_search',
  description: '混合检索文档',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: '检索查询文本' },
      top_k: { type: 'integer', default: 10, description: '返回结果数量' },
      mode: { type: 'string', enum: ['vector', 'fulltext', 'hybrid', 'code'], default: 'hybrid', description: '检索模式' },
      filters: { type: 'object', description: '过滤条件' }
    },
    required: ['query']
  }
};

export function createRagSearchHandler(
  vectorStore: IVectorStore,
  fulltextStore: IFullTextStore,
  embedder: IEmbedder
): ToolHandler<RagSearchInput, RagSearchOutput> {
  return async (input: RagSearchInput): Promise<RagSearchOutput> => {
    const startTime = Date.now();
    const topK = input.top_k ?? 10;
    const mode = input.mode ?? 'hybrid';

    const results: Array<{
      chunk_id: string;
      doc_id: string;
      content: string;
      score: number;
      source: string;
      metadata: Record<string, unknown>;
    }> = [];

    try {
      let searchResults: SearchResult[] = [];

      switch (mode) {
        case 'vector': {
          const queryEmbedding = await embedder.embed(input.query);
          searchResults = await vectorStore.search(queryEmbedding.embedding, topK);
          break;
        }

        case 'fulltext': {
          searchResults = await fulltextStore.search(input.query, topK);
          break;
        }

        case 'hybrid': {
          const [queryEmbedding, fulltextResults] = await Promise.all([
            embedder.embed(input.query),
            fulltextStore.search(input.query, topK)
          ]);

          const vectorResults = await vectorStore.search(queryEmbedding.embedding, topK);

          // RRF融合
          const multiResults = new Map<string, RecallResult[]>();
          multiResults.set('vector', vectorResults.map(r => ({
            ...r,
            recallPath: 'vector' as const
          })));
          multiResults.set('fulltext', fulltextResults.map(r => ({
            ...r,
            recallPath: 'fulltext' as const
          })));

          const fused = await resultFusion.fuse(multiResults, 'rrf');
          searchResults = fused.slice(0, topK);
          break;
        }

        case 'code': {
          const queryEmbedding = await embedder.embed(input.query);
          searchResults = await vectorStore.search(queryEmbedding.embedding, topK * 2);
          // 过滤代码类型
          searchResults = searchResults.filter(r => r.metadata?.type === 'code').slice(0, topK);
          break;
        }
      }

      for (const result of searchResults) {
        results.push({
          chunk_id: result.chunkId,
          doc_id: result.docId,
          content: result.content,
          score: result.score,
          source: result.source,
          metadata: { ...result.metadata } as Record<string, unknown>
        });
      }
    } catch (err) {
      console.error('Search error:', err);
    }

    return {
      results,
      mode,
      duration_ms: Date.now() - startTime
    };
  };
}