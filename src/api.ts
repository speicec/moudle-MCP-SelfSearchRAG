/**
 * @description HTTP API Server for RAG MCP
 */

import express from 'express';
import cors from 'cors';
import { MilvusVectorStore } from './storage/milvus/index.js';
import { SQLiteMetadataStore, SQLiteFullTextStore } from './storage/sqlite/index.js';
import { MockEmbedder } from './plugins/builtin/embedders/index.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 配置
const MILVUS_HOST = process.env.MILVUS_HOST || 'localhost';
const MILVUS_PORT = process.env.MILVUS_PORT || '19530';
const MILVUS_USER = process.env.MILVUS_USER || '';
const MILVUS_PASSWORD = process.env.MILVUS_PASSWORD || '';
const COLLECTION_NAME = process.env.MILVUS_COLLECTION || 'rag_chunks';
const DATA_DIR = path.resolve('./data');
const PORT = process.env.PORT || 3000;

// 初始化存储
let vectorStore: MilvusVectorStore;
let metadataStore: SQLiteMetadataStore;
let fulltextStore: SQLiteFullTextStore;
let embedder: MockEmbedder;

async function initStorage() {
  console.log('[RAG API] Initializing storage...');
  console.log(`[RAG API] Milvus: ${MILVUS_HOST}:${MILVUS_PORT}`);

  vectorStore = new MilvusVectorStore({
    host: MILVUS_HOST,
    port: MILVUS_PORT,
    collection: COLLECTION_NAME,
    user: MILVUS_USER,
    password: MILVUS_PASSWORD
  });

  metadataStore = new SQLiteMetadataStore({
    path: path.join(DATA_DIR, 'metadata.db')
  });

  fulltextStore = new SQLiteFullTextStore(metadataStore);
  embedder = new MockEmbedder(1536);

  try {
    await metadataStore.connect();
    console.log('[RAG API] SQLite connected');

    await vectorStore.connect();
    console.log('[RAG API] Milvus connected');

    await vectorStore.createCollection(1536);
    console.log('[RAG API] Collection ready');
  } catch (err) {
    console.error('[RAG API] Storage init failed:', err);
  }
}

// Express app
const app = express();
app.use(cors());
app.use(express.json());

// 静态文件服务
app.use(express.static(path.join(__dirname, '../public')));

// API Routes

// 状态检查
app.get('/api/status', async (req, res) => {
  try {
    const stats = await metadataStore.getStats();
    res.json({
      success: true,
      data: {
        indexed_docs: stats.documentCount,
        indexed_chunks: stats.chunkCount,
        milvus_connected: vectorStore.isConnected(),
        config: {
          milvus_host: MILVUS_HOST,
          milvus_port: MILVUS_PORT,
          collection: COLLECTION_NAME
        }
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

// 搜索
app.post('/api/search', async (req, res) => {
  try {
    const { query, top_k = 10, mode = 'hybrid' } = req.body;

    if (!query) {
      return res.status(400).json({ success: false, error: 'query is required' });
    }

    console.log(`[API] Search: "${query}", mode: ${mode}, top_k: ${top_k}`);

    const startTime = Date.now();
    let results: any[] = [];

    // 向量检索
    if (mode === 'vector' || mode === 'hybrid') {
      const embeddingResult = await embedder.embed(query);
      results = await vectorStore.search(embeddingResult.embedding, top_k);
    }

    // 全文检索
    if (mode === 'fulltext' || mode === 'hybrid') {
      const ftsResults = await fulltextStore.search(query, top_k);
      // 简单合并
      if (mode === 'hybrid' && results.length > 0) {
        // RRF 融合
        const seen = new Set(results.map(r => r.chunkId));
        for (const r of ftsResults) {
          if (!seen.has(r.chunkId)) {
            results.push(r);
          }
        }
      } else {
        results = ftsResults;
      }
    }

    res.json({
      success: true,
      data: {
        results: results.slice(0, top_k).map(r => ({
          chunk_id: r.chunkId,
          doc_id: r.docId,
          content: r.content,
          score: r.score,
          source: r.source,
          metadata: r.metadata
        })),
        mode,
        duration_ms: Date.now() - startTime
      }
    });
  } catch (err) {
    console.error('[API] Search error:', err);
    res.status(500).json({ success: false, error: String(err) });
  }
});

// 索引文档
app.post('/api/index', async (req, res) => {
  try {
    const { path: docPath, content, metadata } = req.body;

    if (!docPath || !content) {
      return res.status(400).json({ success: false, error: 'path and content are required' });
    }

    console.log(`[API] Index: "${docPath}"`);

    // 创建文档
    const docId = `doc-${Date.now()}`;
    const doc = {
      id: docId,
      path: docPath,
      content,
      metadata: {
        filename: docPath.split('/').pop() || docPath,
        extension: docPath.split('.').pop() || 'txt',
        size: content.length,
        createdAt: new Date(),
        modifiedAt: new Date()
      },
      indexedAt: new Date()
    };

    await metadataStore.saveDocument(doc);

    // 分块并嵌入
    const chunkSize = 500;
    const chunks = [];
    for (let i = 0; i < content.length; i += chunkSize) {
      const chunkContent = content.slice(i, i + chunkSize);
      const chunkId = `${docId}-${i}`;
      const embedding = await embedder.embed(chunkContent);

      chunks.push({
        id: chunkId,
        docId,
        content: chunkContent,
        embedding: embedding.embedding,
        position: { start: i, end: Math.min(i + chunkSize, content.length) },
        metadata: { type: 'text' as const }
      });
    }

    // 保存 chunks
    for (const chunk of chunks) {
      await metadataStore.saveChunk({
        id: chunk.id,
        docId: chunk.docId,
        content: chunk.content,
        position: { start: 0, end: chunk.content.length },
        metadata: chunk.metadata
      });
    }

    // 保存向量
    await vectorStore.insertBatch(chunks);

    res.json({
      success: true,
      data: {
        doc_id: docId,
        chunks_indexed: chunks.length,
        message: `Indexed ${chunks.length} chunks`
      }
    });
  } catch (err) {
    console.error('[API] Index error:', err);
    res.status(500).json({ success: false, error: String(err) });
  }
});

// 列出文档
app.get('/api/documents', async (req, res) => {
  try {
    const docs = await metadataStore.listDocuments();
    res.json({
      success: true,
      data: docs.map(d => ({
        id: d.id,
        path: d.path,
        size: d.metadata.size,
        indexed_at: d.indexedAt
      }))
    });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

// 删除文档
app.delete('/api/documents/:docId', async (req, res) => {
  try {
    const { docId } = req.params;
    await metadataStore.deleteDocument(docId);
    await vectorStore.deleteByDocId(docId);
    res.json({ success: true, message: `Deleted document ${docId}` });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

// 启动服务器
async function start() {
  await initStorage();

  app.listen(PORT, () => {
    console.log(`[RAG API] Server running on http://localhost:${PORT}`);
    console.log(`[RAG API] Open http://localhost:${PORT} in browser`);
  });
}

start().catch(err => {
  console.error('[RAG API] Startup error:', err);
  process.exit(1);
});