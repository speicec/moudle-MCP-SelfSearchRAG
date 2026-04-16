# Software Design Document: Hybrid Retrieval System

## 1. System Overview

### 1.1 Purpose

将现有单一 Dense 向量检索升级为 Dense + Sparse 双轨 Hybrid Retrieval 系统，提升语义搜索与关键词匹配的综合召回质量。

### 1.2 Scope

| 组件 | 变化 |
|------|------|
| Embedding Service | 支持 bge-m3 Dense + Sparse 双输出 |
| Vector Store | Qdrant Dense + Sparse 双索引 |
| Retrieval Service | 双路搜索 + RRF 融合 |
| transformers.js | V2.17 → V3.x/V4.x API 升级 |

### 1.3 Goals

- 中文关键词召回提升: 0.65 → 0.85+
- 语义召回提升: 0.75 → 0.88+
- 混合召回 F1: 0.70 → 0.90+
- 检索延迟: < 30ms (双路并行)

### 1.4 Non-Goals

- ColBERT Token-level 向量（存储开销过大）
- 多模态 Hybrid（图像仅 Dense）
- 动态权重调整（固定 RRF）

---

## 2. System Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         RAG MCP Server                                       │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Document       │     │  Embedding      │     │  Retrieval      │
│  Processor      │────▶│  Service        │────▶│  Service        │
│                 │     │  (Hybrid)       │     │  (Hybrid)       │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
        │                       │                       │
        ▼                       ▼                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Storage Layer                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────┐     ┌─────────────────────────┐              │
│  │  Qdrant Vector Store    │     │  Hierarchical Store     │              │
│  │                         │     │  (Metadata + Content)   │              │
│  │  text_chunks:            │     │                         │              │
│  │    • Dense (1024)       │     │    chunkId → {          │              │
│  │    • Sparse (terms)     │     │      content,           │              │
│  │                         │     │      parentId,          │              │
│  │  image_chunks:          │     │      qualityScore       │              │
│  │    • Dense (512)        │     │    }                    │              │
│  └─────────────────────────┘     └─────────────────────────┘              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     Embedding Service (Hybrid)                               │
└─────────────────────────────────────────────────────────────────────────────┘

                        Text Input
                            │
                            ▼
                 ┌─────────────────────┐
                 │   HybridEmbedding   │
                 │     Service         │
                 ├─────────────────────┤
                 │                     │
                 │  ┌───────────────┐  │
                 │  │  bge-m3       │  │
                 │  │  Model        │  │
                 │  │ (transformers │  │
                 │  │   .js V3/V4)  │  │
                 │  └───────────────┘  │
                 │         │           │
                 │    ┌────┴────┐      │
                 │    │         │      │
                 │    ▼         ▼      │
                 │ Dense    Sparse    │
                 │ (1024)   (Map)     │
                 └─────────────────────┘
                            │
                            ▼
                  HybridEmbeddingResult
                  {
                    dense: number[1024],
                    sparse: Map<string, number>
                  }


┌─────────────────────────────────────────────────────────────────────────────┐
│                     Retrieval Service (Hybrid)                               │
└─────────────────────────────────────────────────────────────────────────────┘

                        Query Input
                            │
                            ▼
                 ┌─────────────────────┐
                 │  HybridRetriever    │
                 ├─────────────────────┤
                 │                     │
                 │  1. Query Embedding │
                 │     (Dense+Sparse)  │
                 │                     │
                 │  2. Parallel Search │──┐
                 │     ├─ Dense Search │  │ Qdrant
                 │     ├─ Sparse Search│──┘ API
                 │                     │
                 │  3. RRF Fusion      │
                 │     score = Σ       │
                 │       1/(k+rank)    │
                 │                     │
                 │  4. Fetch Content   │── HierarchicalStore
                 │     (by chunkIds)   │
                 └─────────────────────┘
                            │
                            ▼
                  RetrievalResult[]
```

---

## 3. Data Design

### 3.1 Qdrant Collection Schema (三 Collection)

#### text_chunks Collection (Small - Dense + Sparse)

```
Collection: text_chunks
───────────────────────────────────────────────────────────────────────────────

Purpose: Small Chunk 主搜索 (精确匹配单位)

Vector Config:
  Dense Vector:
    size: 1024
    distance: Cosine
    hnsw_config:
      m: 16
      ef_construct: 100
      
  Sparse Vector:
    modifier: "sparse"
    indices: keyword IDs
    values: weights

Payload Schema:
  ┌─────────────────────────────────────────────────────────────────────────┐
  │  {                                                                      │
  │    documentId: string,                                                  │
  │    chunkId: string,             // smallChunkId                         │
  │    parentId: string,            // 关联 Parent (关键!)                  │
  │    level: "small",              // 固定为 small                         │
  │    qualityScore: float,                                                 │
  │    pageNumber: int | null,                                              │
  │    contentType: string,                                                 │
  │    position: { start: int, end: int }                                   │
  │  }                                                                      │
  └─────────────────────────────────────────────────────────────────────────┘

存储估算: 100K small chunks × ~4KB = ~400MB
```

#### parent_chunks Collection (Parent - Sparse Only)

```
Collection: parent_chunks
───────────────────────────────────────────────────────────────────────────────

Purpose: Parent Fallback 搜索 (索引搜索，无遍历)

Vector Config:
  Dense Vector: 无                  // 节省存储，Parent 不做语义搜索
  Sparse Vector:
    modifier: "sparse"
    indices: keyword IDs
    values: weights

Payload Schema:
  ┌─────────────────────────────────────────────────────────────────────────┐
  │  {                                                                      │
  │    documentId: string,                                                  │
  │    chunkId: string,             // parentChunkId                        │
  │    level: "parent",             // 固定为 parent                        │
  │    childIds: string[],          // 子 Small Chunk IDs                   │
  │    qualityScore: float,                                                 │
  │    tokenCount: int,              // Parent token 长度                   │
  │    pageNumber: int | null,                                              │
  │  }                                                                      │
  └─────────────────────────────────────────────────────────────────────────┘

存储估算: 20K parent chunks × ~1KB = ~20MB (Sparse 轻量)
```

#### image_chunks Collection (图像 - Dense Only)

```
Collection: image_chunks
───────────────────────────────────────────────────────────────────────────────

Purpose: 图像语义搜索 (图像不适合 Sparse 关键词)

Vector Config:
  Dense Vector:
    size: 512           // CLIP ViT-B-32
    distance: Cosine
    hnsw_config:
      m: 12
      ef_construct: 80

Payload Schema:
  {
    documentId: string,
    imageId: string,
    blockType: "figure" | "table" | "formula",
    pageNumber: int,
    vlmText: string     // VLM 描述文本
  }

存储估算: 10K images × ~2KB = ~20MB
```

### 3.2 存储对比

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  存储对比 (100K Small + 20K Parent + 10K Image)                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────┬────────────────┬─────────────────────────────────────┐
│  Collection         │  向量类型       │  存储估算                           │
├─────────────────────┼────────────────┼─────────────────────────────────────┤
│  text_chunks        │  Dense+Sparse  │  ~400MB                             │
│  parent_chunks      │  Sparse only   │  ~20MB                              │
│  image_chunks       │  Dense only    │  ~20MB                              │
├─────────────────────┼────────────────┼─────────────────────────────────────┤
│  Qdrant 总计        │  -             │  ~440MB (+20% vs Small-Only)        │
└─────────────────────┴────────────────┴─────────────────────────────────────┘

HierarchicalStore (JSON): ~60MB (Small + Parent Content + Metadata)

系统总内存: Qdrant ~440MB + HierarchicalStore ~60MB + bge-m3 ~500MB = ~1GB
```

### 3.2 Sparse Vector Storage

**方案选择: Qdrant Sparse Index**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Sparse Vector 存储方案对比                                                  │
└─────────────────────────────────────────────────────────────────────────────┘

方案 A: Qdrant Native Sparse Index (推荐)
──────────────────────────────────────────
  优点:
    • 原生支持，无需外部服务
    • 与 Dense 向量同一 Collection
    • 存储效率高
    • Qdrant 1.5+ 内置 sparse 向量类型
  
  实现:
    {
      id: chunkId,
      vector: [1024 floats],       // Dense
      sparse_values: {
        indices: [词ID数组],
        values: [权重数组]
      },
      payload: {...}
    }

方案 B: Payload 存储
─────────────────────
  优点:
    • 兼容旧版 Qdrant
    • 简单易实现
  
  缺点:
    • 无专用索引
    • 搜索效率低
    • Payload 大小限制
  
  实现:
    payload.sparseVector = {
      "优化": 0.85,
      "架构": 0.72
    }

方案 C: 独立 BM25 服务
─────────────────────
  优点:
    • 专业全文搜索
  
  缺点:
    • 新增服务依赖
    • 复杂度增加
  
  选择: 方案 A (Qdrant Native)
```

### 3.3 HierarchicalStore Schema (不变)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  HierarchicalStore (JSON 持久化)                                             │
└─────────────────────────────────────────────────────────────────────────────┘

Schema:
  {
    chunks: Map<chunkId, {
      content: string,          // 完整文本内容
      parentId: string | null,  // 父 chunk ID
      childIds: string[],       // 子 chunk IDs
      qualityScore: float,      // 质量分数
      level: "small" | "parent",
      position: { start, end },
      documentId: string
    }>,
    
    documents: Map<documentId, {
      name: string,
      chunkCount: number,
      processedAt: Date
    }>
  }

注意: 不存储向量，向量全在 Qdrant
```

---

## 4. Interface Design

### 4.1 HybridEmbeddingService

```typescript
// src/embedding/hybrid-embedding-service.ts

export interface HybridEmbeddingResult {
  dense: number[];               // 1024 维向量
  sparse: Map<string, number>;   // 词 → 权重
  modelId: string;
  dimension: number;
}

export interface HybridEmbeddingService {
  // 初始化
  initialize(): Promise<void>;
  isReady(): boolean;
  
  // 单文本嵌入
  embedHybrid(text: string): Promise<HybridEmbeddingResult>;
  
  // 批量嵌入
  embedHybridBatch(texts: string[]): Promise<HybridEmbeddingResult[]>;
  
  // 仅 Dense (兼容旧 API)
  embedDense(text: string): Promise<number[]>;
  
  // 仅 Sparse
  embedSparse(text: string): Promise<Map<string, number>>;
  
  // 配置
  getDenseDimension(): number;
  getSparseConfig(): { minWeight: number; maxTerms: number };
}
```

### 4.2 HybridSmallToBigRetriever

```typescript
// src/retrieval/hybrid-small-to-big-retriever.ts

export interface HybridSearchOptions {
  topK: number;
  threshold?: number;
  filter?: MetadataFilter;
  
  // Hybrid 配置
  denseTopK?: number;     // Small Dense 搜索 topK (默认 50)
  sparseTopK?: number;    // Small Sparse 搜索 topK (默认 50)
  rrfK?: number;          // RRF 参数 (默认 60)
  
  // Parent 配置
  parentScoreStrategy?: 'max' | 'avg' | 'weighted';  // 默认 max
  maxParents?: number;    // 最大 Parent 数 (默认 10)
  
  // Fallback 配置
  fallbackMinResults?: number;  // 触发阈值 (默认 3)
  fallbackSparseTopK?: number;  // Parent Sparse 搜索 topK (默认 20)
}

export interface HybridRetrievalResult {
  parentChunkId: string;
  parentContent: string;
  matchedSmallChunks: SmallChunkMatch[];  // 匹配的 Small Chunks
  score: number;                          // Parent 分数
  source: 'hybrid_small' | 'fallback_parent_sparse';
  qualityScore: number;
}

export interface HybridSmallToBigRetriever {
  // Small Hybrid 搜索 + Parent 扩展
  retrieve(query: string, options?: HybridSearchOptions): Promise<HybridRetrievalResult[]>;
  
  // 仅 Small Hybrid 搜索 (不扩展)
  searchSmallChunks(query: string): Promise<SmallChunkResult[]>;
  
  // Parent Sparse Fallback 搜索
  searchParentFallback(query: string): Promise<HybridRetrievalResult[]>;
}

interface SmallChunkMatch {
  smallChunkId: string;
  smallChunkContent: string;
  score: number;
  sources: ('dense' | 'sparse')[];
}

export interface HybridRetrievalResult {
  results: RetrievalResult[];
  fusionInfo: {
    denseHits: number;
    sparseHits: number;
    overlapHits: number;
    method: 'hybrid' | 'dense_only' | 'sparse_only';
  };
}

export interface HybridRetriever {
  // Hybrid 搜索
  searchHybrid(query: string, options: HybridSearchOptions): Promise<HybridRetrievalResult>;
  
  // 仅 Dense 搜索 (兼容)
  searchDense(query: string, options: SearchOptions): Promise<RetrievalResult[]>;
  
  // 仅 Sparse 搜索
  searchSparse(query: string, options: SearchOptions): Promise<RetrievalResult[]>;
}
```

### 4.3 QdrantAdapter (三 Collection 操作)

```typescript
// src/retrieval/qdrant-adapter.ts

export interface QdrantAdapter extends VectorStoreAdapter {
  // Small Chunk 操作 (Dense + Sparse)
  upsertSmall(points: SmallChunkPoint[]): Promise<void>;
  searchDenseSmall(query: DenseSearchQuery): Promise<SearchResult[]>;
  searchSparseSmall(query: SparseSearchQuery): Promise<SearchResult[]>;
  
  // Parent Chunk 操作 (Sparse Only)
  upsertParent(points: ParentChunkPoint[]): Promise<void>;
  searchSparseParent(query: SparseSearchQuery): Promise<SearchResult[]>;
  
  // Image Chunk 操作 (Dense Only)
  upsertImage(points: ImageChunkPoint[]): Promise<void>;
  searchDenseImage(query: DenseSearchQuery): Promise<SearchResult[]>;
}

export interface SmallChunkPoint {
  id: string;                    // smallChunkId
  denseVector: number[];         // 1024 维
  sparseVector: Map<string, number>;  // 词权重
  payload: {
    parentId: string;            // 关键: Parent 关联
    level: 'small';
    qualityScore: number;
    // ...
  };
}

export interface ParentChunkPoint {
  id: string;                    // parentChunkId
  sparseVector: Map<string, number>;  // 只有 Sparse
  payload: {
    childIds: string[];          // 子 Small IDs
    level: 'parent';
    qualityScore: number;
    // ...
  };
}

export interface ImageChunkPoint {
  id: string;                    // imageId
  denseVector: number[];         // 512 维
  payload: {
    blockType: 'figure' | 'table' | 'formula';
    vlmText: string;
    // ...
  };
}
```

---

## 5. Process Design

### 5.1 Document Processing Flow (三 Collection)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  文档处理流程 (Small + Parent Sparse + Image)                                 │
└─────────────────────────────────────────────────────────────────────────────┘

Step 1: PDF 解析
───────────────
  PDF → TextBlock[] + ImageBlock[] + TableBlock[]
  
Step 2: Chunking (Small + Parent)
─────────────────────────────────
  TextBlock[] → 
    Small Chunks (100-200 tokens) ← 精确匹配单位
    Parent Chunks (500-1500 tokens) ← 上下文单位
  
  建立 parentId ↔ childIds[] 关联

Step 3: Hybrid Embedding (分类型处理)
─────────────────────────────────────
  ┌─────────────────────────────────────────────────────────────────────────┐
  │  // Small Chunks: Dense + Sparse                                        │
  │  for each smallChunk:                                                   │
  │    result = hybridEmbeddingService.embedHybrid(smallChunk.content)     │
  │    smallDense = result.dense      // 1024 维                           │
  │    smallSparse = result.sparse    // 词权重                             │
  │  end                                                                    │
  │                                                                         │
  │  // Parent Chunks: Sparse ONLY (节省存储)                               │
  │  for each parentChunk:                                                  │
  │    parentSparse = hybridEmbeddingService.embedSparseOnly(              │
  │      parentChunk.content                                                │
  │    )                                                                    │
  │    // 无 Dense 向量！                                                   │
  │  end                                                                    │
  │                                                                         │
  │  // Image Blocks: Dense ONLY (CLIP)                                     │
  │  for each imageBlock:                                                   │
  │    imageDense = clipService.embedImage(imageBlock.image)               │
  │    // 无 Sparse（图像不适合关键词）                                      │
  │  end                                                                    │
  └─────────────────────────────────────────────────────────────────────────┘

Step 4: 三 Collection 写入
────────────────────────────────
  ┌─────────────────────────────────────────────────────────────────────────┐
  │  // 1. Small Chunks → text_chunks (Dense + Sparse)                      │
  │  qdrantAdapter.upsertSmall([                                            │
  │    {                                                                    │
  │      id: smallChunkId,                                                  │
  │      denseVector: smallDense,                                           │
  │      sparseVector: smallSparse,                                         │
  │      payload: {                                                         │
  │        parentId: parentChunkId,  // 关键关联!                           │
  │        level: 'small',                                                  │
  │        qualityScore: 0.85,                                              │
  │      }                                                                  │
  │    }                                                                    │
  │  ])                                                                     │
  │                                                                         │
  │  // 2. Parent Chunks → parent_chunks (Sparse ONLY)                      │
  │  qdrantAdapter.upsertParent([                                           │
  │    {                                                                    │
  │      id: parentChunkId,                                                 │
  │      sparseVector: parentSparse,  // 只有 Sparse                        │
  │      payload: {                                                         │
  │        childIds: [smallChunkId1, smallChunkId2],  // 子 chunks          │
  │        level: 'parent',                                                 │
  │        qualityScore: 0.85,                                              │
  │      }                                                                  │
  │    }                                                                    │
  │  ])                                                                     │
  │                                                                         │
  │  // 3. Images → image_chunks (Dense ONLY)                               │
  │  qdrantAdapter.upsertImage([                                            │
  │    {                                                                    │
  │      id: imageId,                                                       │
  │      denseVector: imageDense,                                           │
  │      payload: {                                                         │
  │        blockType: 'figure',                                             │
  │        vlmText: '架构流程图...',                                         │
  │      }                                                                  │
  │    }                                                                    │
  │  ])                                                                     │
  │                                                                         │
  │  // 4. HierarchicalStore (元数据 + Content)                             │
  │  hierarchicalStore.setSmallChunk(smallChunkId, {                        │
  │    content: smallChunk.content,                                         │
  │    parentId: parentChunkId,                                             │
  │    qualityScore: 0.85,                                                  │
  │  })                                                                     │
  │  hierarchicalStore.setParentChunk(parentChunkId, {                      │
  │    content: parentChunk.content,  // 完整上下文                          │
  │    childIds: [smallChunkId1, smallChunkId2],                            │
  │    qualityScore: 0.85,                                                  │
  │  })                                                                     │
  └─────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Retrieval Flow (Small Hybrid + Parent Fallback)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  检索流程 (三阶段)                                                            │
└─────────────────────────────────────────────────────────────────────────────┘

Step 1: Query Embedding
────────────────────────
  query = "性能优化的架构设计方法"
  
  hybridResult = hybridEmbeddingService.embedHybrid(query)
  
  queryDense = hybridResult.dense    // [1024 floats]
  querySparse = hybridResult.sparse  // { "性能": 0.85, "优化": 0.72, ... }

Step 2: Phase 1 - Small Chunk Hybrid Search
──────────────────────────────────────────────
  ┌─────────────────────────────────────────────────────────────────────────┐
  │  // 并行执行 Dense + Sparse 搜索                                         │
  │  const [denseResults, sparseResults] = await Promise.all([              │
  │    qdrantAdapter.searchDenseSmall({                                     │
  │      vector: queryDense,                                                │
  │      topK: 50,                                                          │
  │      filter: { level: 'small' }                                         │
  │    }),                                                                  │
  │                                                                         │
  │    qdrantAdapter.searchSparseSmall({                                    │
  │      sparseVector: querySparse,                                         │
  │      topK: 50,                                                          │
  │      filter: { level: 'small' }                                         │
  │    })                                                                   │
  │  ])                                                                     │
  │                                                                         │
  │  // RRF 融合                                                            │
  │  fusedSmallChunks = rrfFusion(denseResults, sparseResults, k=60)        │
  │                                                                         │
  │  结果: [                                                                 │
  │    { smallChunkId: "s-001", parentId: "p-A", score: 0.85 },            │
  │    { smallChunkId: "s-002", parentId: "p-A", score: 0.82 },            │
  │    { smallChunkId: "s-005", parentId: "p-B", score: 0.78 },            │
  │  ]                                                                      │
  └─────────────────────────────────────────────────────────────────────────┘

Step 3: Phase 2 - Parent Expansion (Small-to-Big)
───────────────────────────────────────────────────
  ┌─────────────────────────────────────────────────────────────────────────┐
  │  // 按 parentId 分组                                                     │
  │  parentGroups = groupByParentId(fusedSmallChunks)                       │
  │                                                                         │
  │  //    p-A: [s-001(0.85), s-002(0.82)]  → matchCount=2                  │
  │  //    p-B: [s-005(0.78)]               → matchCount=1                  │
  │                                                                         │
  │  // Parent Score 计算                                                    │
  │  for each parentGroup:                                                  │
  │    parentScore = max(childScores)  // 或 avg, weighted                  │
  │    // p-A.score = max(0.85, 0.82) = 0.85                                │
  │    // p-B.score = 0.78                                                  │
  │  end                                                                    │
  │                                                                         │
  │  // 从 HierarchicalStore 获取 Parent Content                            │
  │  parentIds = ['p-A', 'p-B']                                             │
  │  parentChunks = hierarchicalStore.getParentChunks(parentIds)            │
  │                                                                         │
  │  结果: [                                                                 │
  │    {                                                                    │
  │      parentChunkId: 'p-A',                                              │
  │      parentContent: '完整 500-1500 tokens 上下文...',                    │
  │      matchedSmallChunks: ['s-001', 's-002'],                            │
  │      score: 0.85,                                                       │
  │      source: 'hybrid_small'                                             │
  │    }                                                                    │
  │  ]                                                                      │
  └─────────────────────────────────────────────────────────────────────────┘

Step 4: Phase 3 - Fallback (Parent Sparse Index Search)
─────────────────────────────────────────────────────────
  ┌─────────────────────────────────────────────────────────────────────────┐
  │  条件: smallResults.length < minResults (如 < 3)                        │
  │                                                                         │
  │  // Parent Sparse 索引搜索 (无遍历!)                                     │
  │  parentResults = await qdrantAdapter.searchSparseParent({               │
  │    sparseVector: querySparse,                                           │
  │    topK: 20,                                                            │
  │    filter: { level: 'parent' }                                          │
  │  })                                                                     │
  │                                                                         │
  │  // 直接返回 Parent IDs                                                  │
  │  parentIds = parentResults.map(r => r.id)                               │
  │  parentChunks = hierarchicalStore.getParentChunks(parentIds)            │
  │                                                                         │
  │  结果: [                                                                 │
  │    {                                                                    │
  │      parentChunkId: 'p-C',                                              │
  │      parentContent: 'Fallback Parent Content...',                       │
  │      score: 0.72,                                                       │
  │      source: 'fallback_parent_sparse'                                   │
  │    }                                                                    │
  │  ]                                                                      │
  └─────────────────────────────────────────────────────────────────────────┘

Step 5: 结果合并
─────────────────────
  if (smallResults.length >= minResults):
    return smallResults with Parent Expansion
  else:
    return fallbackResults (Parent Sparse)

Step 3: RRF Fusion
────────────────────────
  ┌─────────────────────────────────────────────────────────────────────────┐
  │  fusedResults = rrfFusion(denseResults, sparseResults, k=60)            │
  │                                                                         │
  │  // RRF 算法:                                                            │
  │  // score(chunk) = Σ 1/(k + rank)                                       │
  │  // k=60 是经验最优值                                                    │
  │                                                                         │
  │  结果:                                                                   │
  │  [                                                                      │
  │    { chunkId: "chunk-A", score: 0.033, sources: ['dense','sparse'] },  │
  │    { chunkId: "chunk-B", score: 0.025, sources: ['dense'] },           │
  │    { chunkId: "chunk-C", score: 0.020, sources: ['sparse'] },          │
  │    ...                                                                  │
  │  ]                                                                      │
  └─────────────────────────────────────────────────────────────────────────┘

Step 4: Fetch Content
────────────────────────
  chunkIds = fusedResults.slice(0, topK).map(r => r.chunkId)
  
  contents = hierarchicalStore.getChunks(chunkIds)
  
  // Small-to-Big 扩展
  finalResults = smallToBigExpand(contents)

Step 5: Return Results
────────────────────────
  return {
    results: finalResults,
    fusionInfo: {
      denseHits: denseResults.length,
      sparseHits: sparseResults.length,
      overlapHits: countOverlap(denseResults, sparseResults),
      method: 'hybrid'
    }
  }
```

---

## 6. Algorithm Design

### 6.1 RRF Fusion Algorithm

```typescript
/**
 * Reciprocal Rank Fusion
 * 
 * 论文: "Reciprocal Rank Fusion outperforms Condorcet and individual
 *        Rank Learning Methods" (Cormack et al., 2009)
 * 
 * 公式: score(d) = Σ 1/(k + rank_i(d))
 * 
 * 参数 k 的选择:
 *   - k=60 是经验最优值（论文推荐）
 *   - 小 k 值强调高排名结果
 *   - 大 k 值更均衡分布
 */
export function rrfFusion(
  denseResults: SearchResult[],
  sparseResults: SearchResult[],
  k: number = 60
): FusionResult[] {
  const scoreMap = new Map<string, FusionResult>();
  
  // Dense results contribution
  for (let i = 0; i < denseResults.length; i++) {
    const result = denseResults[i];
    const rank = i + 1;
    const contribution = 1 / (k + rank);
    
    const existing = scoreMap.get(result.id);
    if (existing) {
      existing.score += contribution;
      existing.denseRank = rank;
      existing.sources.push('dense');
    } else {
      scoreMap.set(result.id, {
        chunkId: result.id,
        score: contribution,
        denseRank: rank,
        sources: ['dense'],
        payload: result.payload
      });
    }
  }
  
  // Sparse results contribution
  for (let i = 0; i < sparseResults.length; i++) {
    const result = sparseResults[i];
    const rank = i + 1;
    const contribution = 1 / (k + rank);
    
    const existing = scoreMap.get(result.id);
    if (existing) {
      existing.score += contribution;
      existing.sparseRank = rank;
      existing.sources.push('sparse');
    } else {
      scoreMap.set(result.id, {
        chunkId: result.id,
        score: contribution,
        sparseRank: rank,
        sources: ['sparse'],
        payload: result.payload
      });
    }
  }
  
  // Sort by fused score descending
  return Array.from(scoreMap.values())
    .sort((a, b) => b.score - a.score);
}

/**
 * 统计两路结果重叠
 */
export function countOverlap(
  dense: SearchResult[],
  sparse: SearchResult[]
): number {
  const denseIds = new Set(dense.map(r => r.id));
  const sparseIds = new Set(sparse.map(r => r.id));
  
  let overlap = 0;
  for (const id of denseIds) {
    if (sparseIds.has(id)) overlap++;
  }
  
  return overlap;
}
```

### 6.2 Sparse Vector Processing

```typescript
/**
 * Sparse 向量处理
 * 
 * bge-m3 输出的 sparse 向量是词-权重 Map
 * 需要过滤低权重词以提高存储和搜索效率
 */
export function processSparseVector(
  rawSparse: Map<string, number>,
  config: { minWeight: number; maxTerms: number }
): Map<string, number> {
  // 1. 过滤低权重词
  const filtered = new Map<string, number>();
  for (const [term, weight] of rawSparse) {
    if (weight >= config.minWeight) {
      filtered.set(term, weight);
    }
  }
  
  // 2. 按权重排序，保留 top terms
  const sorted = Array.from(filtered.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, config.maxTerms);
  
  // 3. 返回处理后的 Map
  return new Map(sorted);
}

/**
 * Sparse 向量转换为 Qdrant 格式
 * 
 * Qdrant Sparse Index 需要:
 *   indices: 词 ID 数组 (内部词表映射)
 *   values: 权重数组
 */
export function sparseToQdrantFormat(
  sparse: Map<string, number>,
  termToId: Map<string, number>
): { indices: number[]; values: number[] } {
  const indices: number[] = [];
  const values: number[] = [];
  
  for (const [term, weight] of sparse) {
    // 获取词 ID（如果没有则分配新 ID）
    let termId = termToId.get(term);
    if (termId === undefined) {
      termId = termToId.size;
      termToId.set(term, termId);
    }
    
    indices.push(termId);
    values.push(weight);
  }
  
  return { indices, values };
}
```

---

## 7. Error Handling

### 7.1 Error Types

```typescript
// src/embedding/hybrid-embedding-errors.ts

export class HybridEmbeddingError extends Error {
  constructor(
    message: string,
    public code: string,
    public component: 'dense' | 'sparse' | 'model',
    public retryable: boolean
  ) {
    super(message);
    this.name = 'HybridEmbeddingError';
  }
}

export class HybridRetrievalError extends Error {
  constructor(
    message: string,
    public code: string,
    public component: 'dense_search' | 'sparse_search' | 'fusion',
    public retryable: boolean
  ) {
    super(message);
    this.name = 'HybridRetrievalError';
  }
}

// 错误码定义
export const ERROR_CODES = {
  // Embedding 错误
  MODEL_LOAD_FAILED: 'E001',
  DENSE_GENERATION_FAILED: 'E002',
  SPARSE_GENERATION_FAILED: 'E003',
  MODEL_NOT_READY: 'E004',
  
  // Retrieval 错误
  DENSE_SEARCH_FAILED: 'R001',
  SPARSE_SEARCH_FAILED: 'R002',
  FUSION_FAILED: 'R003',
  CONTENT_FETCH_FAILED: 'R004',
};
```

### 7.2 Fallback Strategy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Fallback 策略                                                                │
└─────────────────────────────────────────────────────────────────────────────┘

情况 1: Sparse 生成失败
────────────────────────
  fallback: 仅使用 Dense 向量
  日志: WARN Sparse generation failed, fallback to dense-only

情况 2: Sparse 搜索失败
────────────────────────
  fallback: 仅使用 Dense 搜索结果
  日志: WARN Sparse search failed, using dense results only

情况 3: Dense 搜索失败
────────────────────────
  fallback: 仅使用 Sparse 搜索结果
  日志: WARN Dense search failed, using sparse results only

情况 4: 双路都失败
────────────────────────
  fallback: 返回空结果 + 错误信息
  日志: ERROR Both dense and sparse search failed

情况 5: Fusion 失败
────────────────────────
  fallback: 返回 Dense 结果（按原排序）
  日志: WARN RRF fusion failed, returning dense results
```

---

## 8. Performance Considerations

### 8.1 Memory Estimates

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  存储预估 (100K chunks)                                                       │
└─────────────────────────────────────────────────────────────────────────────┘

Dense 向量:
  1024 维 × 4 bytes × 100,000 = 400 MB

Sparse 向量:
  平均每 chunk 50 个关键词
  50 × (词ID 4 bytes + 权重 4 bytes) × 100,000 = 40 MB
  压缩后: ~20 MB

Payload 元数据:
  ~100 bytes × 100,000 = 10 MB

总计 Qdrant:
  400 + 20 + 10 = ~430 MB (内存索引)
  磁盘存储: ~500 MB (含 HNSW 索引开销)

HierarchicalStore (JSON):
  content 平均 500 chars × 100,000 = 50 MB
  元数据: ~10 MB
  总计: ~60 MB

系统总内存占用:
  Qdrant 索引 + HierarchicalStore + bge-m3 模型
  = 430 + 60 + 500 (模型) = ~1 GB
```

### 8.2 Latency Targets

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  检索延迟分解                                                                 │
└─────────────────────────────────────────────────────────────────────────────┘

Step                    Target      说明
─────────────────────────────────────────────────────────────────────────────
Query Embedding         ~10ms       bge-m3 Dense + Sparse 生成
Dense Search            ~8ms        HNSW 索引搜索 (100K vectors)
Sparse Search           ~5ms        Sparse 索引搜索
RRF Fusion              <1ms        内存计算
Content Fetch           ~5ms        HierarchicalStore lookup
─────────────────────────────────────────────────────────────────────────────
Total                   <30ms       并行搜索优化后

优化策略:
  1. Dense + Sparse 搜索并行执行 (Promise.all)
  2. HierarchicalStore 预热热点内容
  3. Qdrant ef 参数动态调整
```

---

## 9. Testing Strategy

### 9.1 Unit Tests

```typescript
// tests/embedding/hybrid-embedding.test.ts

describe('HybridEmbeddingService', () => {
  test('生成 Dense 1024 维向量', async () => {
    const result = await service.embedHybrid('测试文本');
    expect(result.dense.length).toBe(1024);
  });
  
  test('生成 Sparse 词权重 Map', async () => {
    const result = await service.embedHybrid('性能优化架构');
    expect(result.sparse.size).toBeGreaterThan(0);
    expect(result.sparse.get('性能')).toBeGreaterThan(0);
  });
  
  test('Sparse 权重范围验证', async () => {
    const result = await service.embedHybrid('测试');
    for (const [term, weight] of result.sparse) {
      expect(weight).toBeGreaterThan(0);
      expect(weight).toBeLessThan(1);
    }
  });
  
  test('低权重词过滤', async () => {
    const raw = new Map([['测试', 0.8], ['低权', 0.001]]);
    const filtered = processSparseVector(raw, { minWeight: 0.01, maxTerms: 100 });
    expect(filtered.has('低权')).toBe(false);
  });
});

// tests/retrieval/hybrid-retrieval.test.ts

describe('HybridRetriever', () => {
  test('RRF 融合正确性', () => {
    const dense = [{ id: 'A', score: 0.9 }, { id: 'B', score: 0.8 }];
    const sparse = [{ id: 'C', score: 0.9 }, { id: 'A', score: 0.7 }];
    
    const fused = rrfFusion(dense, sparse, 60);
    
    // A 在两路都出现，应该排名最高
    expect(fused[0].chunkId).toBe('A');
    expect(fused[0].sources).toContain('dense');
    expect(fused[0].sources).toContain('sparse');
  });
  
  test('并行搜索执行', async () => {
    const result = await retriever.searchHybrid('查询', { topK: 10 });
    expect(result.fusionInfo.denseHits).toBeGreaterThan(0);
    expect(result.fusionInfo.sparseHits).toBeGreaterThan(0);
  });
  
  test('Sparse fallback', async () => {
    // Mock sparse search failure
    mockQdrantSparseSearchFailure();
    
    const result = await retriever.searchHybrid('查询', { topK: 10 });
    expect(result.fusionInfo.method).toBe('dense_only');
  });
});
```

### 9.2 Integration Tests

```typescript
// tests/integration/hybrid-flow.test.ts

describe('Hybrid Retrieval Flow', () => {
  test('文档处理 + Hybrid 存储', async () => {
    // 上传文档
    const docId = await uploadDocument('test.pdf');
    
    // 验证 Qdrant 存储
    const stats = await qdrant.getStats('text_chunks');
    expect(stats.vectorCount).toBeGreaterThan(0);
    
    // 验证 Sparse 向量存在
    const point = await qdrant.retrieve('text_chunks', chunkId);
    expect(point.sparse_values).toBeDefined();
  });
  
  test('中文关键词召回提升', async () => {
    // 准备包含 "性能优化" 的文档
    await uploadDocument('性能优化指南.pdf');
    
    // 使用关键词查询
    const hybridResult = await retriever.searchHybrid('性能优化', { topK: 10 });
    const denseResult = await retriever.searchDense('性能优化', { topK: 10 });
    
    // Hybrid 应比纯 Dense 召回更多相关结果
    const hybridRecall = calculateRecall(hybridResult, groundTruth);
    const denseRecall = calculateRecall(denseResult, groundTruth);
    
    expect(hybridRecall).toBeGreaterThan(denseRecall);
  });
});
```

### 9.3 Performance Tests

```typescript
// tests/performance/hybrid-perf.test.ts

describe('Hybrid Retrieval Performance', () => {
  test('检索延迟 < 30ms', async () => {
    const start = Date.now();
    await retriever.searchHybrid('测试查询', { topK: 20 });
    const duration = Date.now() - start;
    
    expect(duration).toBeLessThan(30);
  });
  
  test('批量处理吞吐量', async () => {
    const texts = generateTestTexts(1000);
    const start = Date.now();
    
    await service.embedHybridBatch(texts);
    
    const duration = Date.now() - start;
    const throughput = texts.length / (duration / 1000);
    
    expect(throughput).toBeGreaterThan(50); // >50 texts/sec
  });
});
```

---

## 10. Deployment Guide

### 10.1 Prerequisites

```bash
# 1. Qdrant 1.5+ (支持 Sparse Index)
docker run -d \
  --name qdrant \
  -p 6333:6333 \
  -p 6334:6334 \
  -v $(pwd)/qdrant-storage:/qdrant/storage \
  qdrant/qdrant:v1.5.0

# 2. Node.js 18+
node --version  # >= 18.0.0

# 3. transformers.js V3/V4
npm install @huggingface/transformers  # 或 @xenova/transformers@latest
```

### 10.2 Environment Variables

```bash
# .env 文件

# Hybrid 模式
HYBRID_RETRIEVAL_ENABLED=true

# Dense 模型
DENSE_MODEL=bge-m3
DENSE_DIMENSION=1024

# Sparse 配置
SPARSE_MIN_WEIGHT=0.01
SPARSE_MAX_TERMS=100

# RRF 配置
RRF_K=60
RRF_DENSE_TOPK=50
RRF_SPARSE_TOPK=50

# Qdrant
QDRANT_URL=http://localhost:6333
VECTOR_STORE_TYPE=qdrant

# transformers.js
HF_ENDPOINT=https://hf-mirror.com
TRANSFORMERS_CACHE=./models
```

### 10.3 Migration Steps

```bash
# Step 1: 删除旧数据
rm -rf data/store/hierarchical-store.json

# Step 2: 升级依赖
npm install @huggingface/transformers@latest @qdrant/js-client-rest@latest

# Step 3: 启动 Qdrant
docker-compose up -d qdrant

# Step 4: 重建 Collection
node scripts/init-qdrant-collections.js

# Step 5: 重新处理文档
# 通过 API 重新上传所有文档
```

---

## 11. Glossary

| Term | Definition |
|------|------------|
| Dense Vector | 固定维度语义向量，捕捉整体语义 |
| Sparse Vector | 词级别权重向量，类似 BM25，精确匹配 |
| Hybrid Retrieval | Dense + Sparse 双路检索融合 |
| RRF | Reciprocal Rank Fusion，排名融合算法 |
| HNSW | Hierarchical Navigable Small World，向量索引算法 |
| bge-m3 | BAAI 开源多语言嵌入模型，支持 Dense + Sparse 输出 |

---

## 12. References

- [bge-m3 论文](https://arxiv.org/abs/2402.03216)
- [RRF 论文](Cormack et al., 2009)
- [Qdrant Sparse Index 文档](https://qdrant.tech/documentation/concepts/indexing/#sparse-indexes)
- [transformers.js 文档](https://huggingface.co/docs/transformers.js)