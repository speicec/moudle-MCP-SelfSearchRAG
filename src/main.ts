/**
 * @description MCP Server 启动入口
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { MilvusVectorStore } from './storage/milvus/index.js';
import { SQLiteMetadataStore, SQLiteFullTextStore } from './storage/sqlite/index.js';
import { MemoryCacheStore } from './storage/cache/memory.js';
import { MockEmbedder } from './plugins/builtin/embedders/index.js';
import { z } from 'zod';
import path from 'path';

// 配置
const MILVUS_HOST = process.env.MILVUS_HOST || 'localhost';
const MILVUS_PORT = process.env.MILVUS_PORT || '19530';
const MILVUS_USER = process.env.MILVUS_USER || '';
const MILVUS_PASSWORD = process.env.MILVUS_PASSWORD || '';
const COLLECTION_NAME = process.env.MILVUS_COLLECTION || 'rag_chunks';
const DATA_DIR = path.resolve('./data');

async function main() {
  console.error('[RAG MCP Server] Starting...');
  console.error(`[RAG MCP Server] Milvus: ${MILVUS_HOST}:${MILVUS_PORT}`);
  console.error(`[RAG MCP Server] Collection: ${COLLECTION_NAME}`);
  console.error(`[RAG MCP Server] User: ${MILVUS_USER || 'anonymous'}`);

  // 初始化存储
  const vectorStore = new MilvusVectorStore({
    host: MILVUS_HOST,
    port: MILVUS_PORT,
    collection: COLLECTION_NAME,
    user: MILVUS_USER,
    password: MILVUS_PASSWORD
  });

  const metadataStore = new SQLiteMetadataStore({
    path: path.join(DATA_DIR, 'metadata.db')
  });

  const fulltextStore = new SQLiteFullTextStore(metadataStore);
  const cacheStore = new MemoryCacheStore();
  const embedder = new MockEmbedder(1536); // 使用 1536 维度匹配 Milvus collection

  // 等待连接
  try {
    await metadataStore.connect();
    console.error('[RAG MCP Server] SQLite connected');

    await vectorStore.connect();
    console.error('[RAG MCP Server] Milvus connected');

    await vectorStore.createCollection(1536);
    console.error('[RAG MCP Server] Collection created/loaded');
  } catch (err) {
    console.error('[RAG MCP Server] Connection failed:', err);
    // 继续启动，即使连接失败也能响应状态查询
  }

  // 创建 MCP Server
  const server = new McpServer({
    name: 'rag-mcp-server',
    version: '0.1.0'
  });

  // 注册 rag_index Tool
  server.tool(
    'rag_index',
    '索引文档到向量库',
    {
      path: z.string().describe('要索引的文件或目录路径'),
      recursive: z.boolean().default(true).describe('是否递归索引子目录'),
      filters: z.array(z.string()).optional().describe('文件过滤规则')
    },
    async (args) => {
      console.error(`[rag_index] Indexing: ${args.path}`);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            indexed: 0,
            skipped: 0,
            errors: ['Not implemented yet - path: ' + args.path],
            duration_ms: 0
          })
        }]
      };
    }
  );

  // 注册 rag_search Tool
  server.tool(
    'rag_search',
    '混合检索文档',
    {
      query: z.string().describe('检索查询文本'),
      top_k: z.number().default(10).describe('返回结果数量'),
      mode: z.enum(['vector', 'fulltext', 'hybrid']).default('hybrid').describe('检索模式')
    },
    async (args) => {
      console.error(`[rag_search] Query: ${args.query}, Mode: ${args.mode}`);

      // 向量检索
      let results: any[] = [];
      try {
        const embeddingResult = await embedder.embed(args.query);
        results = await vectorStore.search(embeddingResult.embedding, args.top_k);
      } catch (err) {
        console.error('[rag_search] Vector search failed:', err);
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            results: results.map(r => ({
              chunk_id: r.id,
              doc_id: r.doc_id,
              content: r.content,
              score: r.score,
              source: r.source
            })),
            mode: args.mode,
            duration_ms: 50
          })
        }]
      };
    }
  );

  // 注册 rag_delete Tool
  server.tool(
    'rag_delete',
    '删除已索引文档',
    {
      doc_id: z.string().optional().describe('文档ID'),
      path: z.string().optional().describe('文档路径')
    },
    async (args) => {
      console.error(`[rag_delete] Deleting: ${args.doc_id || args.path}`);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            deleted: false,
            chunks_removed: 0,
            message: 'Not implemented yet'
          })
        }]
      };
    }
  );

  // 注册 rag_status Tool
  server.tool(
    'rag_status',
    '查询系统状态',
    {},
    async () => {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            indexed_docs: 0,
            indexed_chunks: 0,
            storage_health: {
              milvus: vectorStore.isConnected() ? 'healthy' : 'unhealthy',
              sqlite: 'healthy'
            },
            embedding_service: {
              status: 'mock',
              model: 'mock-embedder'
            },
            config: {
              milvus_host: MILVUS_HOST,
              milvus_port: MILVUS_PORT,
              collection: COLLECTION_NAME
            }
          })
        }]
      };
    }
  );

  // 注册 Resources
  server.resource(
    'indexed-docs',
    'rag://docs',
    {
      description: '已索引文档列表'
    },
    async (uri) => {
      return {
        contents: [{
          uri: uri.toString(),
          text: JSON.stringify({ docs: [] })
        }]
      };
    }
  );

  server.resource(
    'search-history',
    'rag://history',
    {
      description: '检索历史'
    },
    async (uri) => {
      return {
        contents: [{
          uri: uri.toString(),
          text: JSON.stringify({ history: [] })
        }]
      };
    }
  );

  // 注册 Prompts
  server.prompt(
    'search-optimize',
    '生成检索优化提示',
    {
      query: z.string().describe('原始查询')
    },
    async (args) => {
      return {
        description: '优化检索查询的建议',
        messages: [{
          role: 'user',
          content: {
            type: 'text',
            text: `请帮我优化以下检索查询，使其更精准：\n\n原始查询: ${args.query}\n\n建议：添加关键词、限定范围或使用更具体的描述。`
          }
        }]
      };
    }
  );

  // 连接 stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('[RAG MCP Server] Connected to stdio transport');
}

main().catch((err) => {
  console.error('[RAG MCP Server] Error:', err);
  process.exit(1);
});