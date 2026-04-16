## Context

当前架构使用内存 Map 存储向量，线性暴力搜索，维度 384，元数据与向量混合存储。

升级目标：Qdrant HNSW 索引 + 1024 维 Dense + Sparse Hybrid Retrieval + 元数据分离存储。

```
升级前                              升级后 (Hybrid)
═══════                            ════════════════

┌─────────────────────┐            ┌─────────────────────────────────────┐
│  InMemoryVectorStore │            │        Hybrid Retrieval              │
│  (Map<id, vector>)   │            │                                     │
│                     │            │  ┌─────────────────────────────────┐│
│  • 384 维 Dense     │            │  │  Dense (1024维)  ──语义搜索    ││
│  • 暴力搜索 O(N)     │───────────▶│  │  Sparse (词权重) ──关键词匹配 ││
│  • 元数据+向量混合   │            │  │  RRF Fusion    ──融合排序     ││
│  • 重启数据丢失      │            │  └─────────────────────────────────┘│
│                     │            │                                     │
│  HierarchicalStore  │            │  Qdrant VectorStore                 │
│  存向量+元数据       │            │  • Dense + Sparse 双索引           │
└─────────────────────┘            │  • HNSW + Sparse Index             │
                                   │                                     │
                                   │  HierarchicalStore                  │
                                   │  只存元数据 (content, parentId)     │
                                   └─────────────────────────────────────┘
```

## Goals / Non-Goals

**Goals:**
- Qdrant 集成，HNSW + Sparse 双索引实现亚毫秒级检索
- Dense + Sparse Hybrid Retrieval，提升语义+关键词召回
- 文本向量升级到 bge-m3 (1024 维 Dense + Sparse)
- 元数据过滤在向量数据库层执行，高效筛选
- 抛弃旧数据，全新架构
- 保持 Small-to-Big 检索策略不变
- 支持多模态（文本 Hybrid + 图像 Dense）分离存储
- transformers.js V3/V4 API 升级

**Non-Goals:**
- 不支持 Milvus/Chroma（本次只做 Qdrant）
- 不做 ColBERT Token-level 向量（存储开销过大）
- 不迁移旧数据（直接删除）
- 不修改 chunking 算法（只改存储层）
- 不做动态权重调整（固定 RRF）

## Architecture Design

### 1. VectorStoreAdapter 接口设计

```typescript
// src/retrieval/vector-store-adapter.ts

export interface VectorStoreAdapter {
  // 生命周期
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  isReady(): boolean;
  
  // Collection 管理（支持多维度分离）
  createCollection(name: string, config: CollectionConfig): Promise<void>;
  deleteCollection(name: string): Promise<void>;
  collectionExists(name: string): Promise<boolean>;
  
  // 向量操作
  upsert(collection: string, points: VectorPoint[]): Promise<void>;
  delete(collection: string, ids: string[]): Promise<void>;
  deleteByFilter(collection: string, filter: MetadataFilter): Promise<number>;
  
  // 搜索（核心功能）
  search(collection: string, query: SearchQuery): Promise<SearchResult[]>;
  
  // 统计
  getStats(collection: string): Promise<CollectionStats>;
}

export interface CollectionConfig {
  dimension: number;
  distance: 'Cosine' | 'Euclidean' | 'Dot';
  hnsw?: {
    m: number;          // HNSW M 参数（连接数）
    efConstruct: number; // 构建时的 ef
  };
}

export interface VectorPoint {
  id: string;
  vector: number[];
  payload: {
    documentId: string;
    chunkId: string;
    parentId?: string;
    modality: 'text' | 'image';
    pageNumber?: number;
    qualityScore: number;
    contentType: string;
    position: { start: number; end: number };
  };
}

export interface SearchQuery {
  vector: number[];
  topK: number;
  threshold?: number;
  filter?: MetadataFilter;
}

export interface MetadataFilter {
  documentId?: string;
  minQuality?: number;
  maxQuality?: number;
  pageNumbers?: number[];
  modality?: 'text' | 'image';
  contentTypes?: string[];
}
```

### 2. Qdrant Collection 设计

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                         Qdrant Collections 结构                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  Collection: text_chunks                                                                │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐│
│  │  向量配置:                                                                             ││
│  │    dimension: 1024                                                                    ││
│  │    distance: Cosine                                                                   ││
│  │    hnsw: { m: 16, efConstruct: 100 }                                                  ││
│  │                                                                                       ││
│  │  Payload 结构:                                                                        ││
│  │    ┌─────────────────────────────────────────────────────────────────────────────────┐││
│  │    │ {                                                                               │││
│  │    │   documentId: "doc-abc123",                                                     │││
│  │    │   chunkId: "chunk-456",         ← 用于关联 HierarchicalStore                    │││
│  │    │   parentId: "parent-789",       ← Small-to-Big 扩展用                           │││
│  │    │   level: "small" | "parent",    ← chunk 层级                                    │││
│  │    │   qualityScore: 0.85,           ← 过滤低质量                                    │││
│  │    │   pageNumber: 5,                ← 页码过滤                                      │││
│  │    │   contentType: "text",          ← 内容类型                                      │││
│  │    │   position: { start: 100, end: 500 },                                           │││
│  │    │ }                                                                               │││
│  │    └─────────────────────────────────────────────────────────────────────────────────┘││
│  └───────────────────────────────────────────────────────────────────────────────────────┐│
└─────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  Collection: image_chunks                                                               │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐│
│  │  向量配置:                                                                             ││
│  │    dimension: 512     ← CLIP 固定                                                    ││
│  │    distance: Cosine                                                                   ││
│  │    hnsw: { m: 12, efConstruct: 80 }                                                   ││
│  │                                                                                       ││
│  │  Payload 结构:                                                                        ││
│  │    ┌─────────────────────────────────────────────────────────────────────────────────┐││
│  │    │ {                                                                               │││
│  │    │   documentId: "doc-abc123",                                                     │││
│  │    │   imageId: "img-789",           ← 关联 ImageStore                               │││
│  │    │   blockType: "figure" | "table" | "formula",                                    │││
│  │    │   pageNumber: 3,                                                                │││
│  │    │   vlmText: "架构流程图...",     ← VLM 描述（用于文本查图）                       │││
│  │    │ }                                                                               │││
│  │    └─────────────────────────────────────────────────────────────────────────────────┘││
│  └───────────────────────────────────────────────────────────────────────────────────────┐│
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### 3. 数据流设计

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                         文档处理数据流                                                   │
└─────────────────────────────────────────────────────────────────────────────────────────┘

     文档上传
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  1. PDF 解析                                                                            │
│     ┌───────────────────────────────────────────────────────────────────────────────────┐│
│     │  pdf-parser.ts                                                                    ││
│     │    → TextBlock[] (文本内容)                                                        ││
│     │    → ImageBlock[] (图像/表格)                                                      ││
│     │    → TableBlock[] (表格数据)                                                       ││
│     └───────────────────────────────────────────────────────────────────────────────────┐│
└─────────────────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  2. Chunking                                                                            │
│     ┌───────────────────────────────────────────────────────────────────────────────────┐│
│     │  semantic-chunker.ts                                                              ││
│     │    → HierarchicalChunk[] (small + parent)                                          ││
│     │    → 调用 ChunkQualityFilter.evaluate() 计算质量                                   ││
│     └───────────────────────────────────────────────────────────────────────────────────┐│
└─────────────────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  3. Embedding (双轨分离)                                                                │
│     ┌───────────────────────────────────────────────────────────────────────────────────┐│
│     │                                                                                   ││
│     │  文本 chunks ─────────────────────▶ LocalTextEmbeddingService                      ││
│     │    (small + parent)               │  multilingual-e5-large                        ││
│     │                                   │  dimension: 1024 ✓                            ││
│     │                                   │                                               ││
│     │  图像 blocks ─────────────────────▶ MultimodalEmbeddingService                     ││
│     │    (figures, tables)              │  CLIP ViT-B-32                               ││
│     │                                   │  dimension: 512 ✓                            ││
│     │                                                                                   ││
│     └───────────────────────────────────────────────────────────────────────────────────┐│
└─────────────────────────────────────────────────────────────────────────────────────────┘
         │
         ├─────────────────────────────────────────┐
         │                                         │
         ▼                                         ▼
┌─────────────────────────────────┐   ┌─────────────────────────────────┐
│  4a. Qdrant 写入                │   │  4b. HierarchicalStore 写入      │
│  ┌─────────────────────────────┐│   │  ┌─────────────────────────────┐│
│  │  text_chunks collection     ││   │  │  • chunkId → metadata       ││
│  │    向量: 1024 维            ││   │  │  • content (完整文本)        ││
│  │    payload: {chunkId, ...}  ││   │  │  • qualityScore             ││
│  │                             ││   │  │  • parentId/childIds        ││
│  │  image_chunks collection    ││   │  │  • position                 ││
│  │    向量: 512 维             ││   │  │                             ││
│  │    payload: {imageId, ...}  ││   │  │  JSON 持久化保留            ││
│  └─────────────────────────────┘│   │  └─────────────────────────────┘│
└─────────────────────────────────┘   └─────────────────────────────────┘
```

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                         检索数据流                                                      │
└─────────────────────────────────────────────────────────────────────────────────────────┘

     用户查询: "性能优化的架构图"
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  1. 查询分析                                                                            │
│     ┌───────────────────────────────────────────────────────────────────────────────────┐│
│     │  QueryAnalyzer                                                                    ││
│     │    → 检测是否需要图像检索                                                          ││
│     │    → 生成查询向量                                                                  ││
│     └───────────────────────────────────────────────────────────────────────────────────┐│
└─────────────────────────────────────────────────────────────────────────────────────────┘
         │
         ├─────────────────────────────────────────┐
         │                                         │
         ▼                                         ▼
┌─────────────────────────────────┐   ┌─────────────────────────────────┐
│  2a. 文本检索                    │   │  2b. 图像检索                    │
│  ┌─────────────────────────────┐│   │  ┌─────────────────────────────┐│
│  │  Qdrant.search(             ││   │  │  Qdrant.search(             ││
│  │    collection: 'text_chunks'││   │  │    collection: 'image_chunks'││
│  │    vector: queryVector1024, ││   │  │    vector: clipVector512,    ││
│  │    topK: 20,                ││   │  │    topK: 5,                  ││
│  │    filter: {                ││   │  │    filter: {                 ││
│  │      minQuality: 0.6        ││   │  │      blockType: 'figure'     ││
│  │    }                        ││   │  │    }                         ││
│  │  )                          ││   │  │  )                           ││
│  │                             ││   │  │                              ││
│  │  结果: chunkIds + scores    ││   │  │  结果: imageIds + scores     ││
│  └─────────────────────────────┘│   │  └─────────────────────────────┘│
└─────────────────────────────────┘   └─────────────────────────────────┘
         │                                         │
         │                                         │
         ▼                                         ▼
┌─────────────────────────────────┐   ┌─────────────────────────────────┐
│  3a. Small-to-Big 扩展          │   │  3b. 图像内容获取                │
│  ┌─────────────────────────────┐│   │  ┌─────────────────────────────┐│
│  │  HierarchicalStore.getChunk ││   │  │  ImageStore.getImage         ││
│  │    (chunkIds)               ││   │  │    (imageIds)                ││
│  │                             ││   │  │                              ││
│  │  → 获取 parent content      ││   │  │  → 获取图像 buffer           ││
│  │  → 获取完整上下文           ││   │  │  → 获取 vlmText 描述         ││
│  └─────────────────────────────┘│   │  └─────────────────────────────┘│
└─────────────────────────────────┘   └─────────────────────────────────┘
         │                                         │
         └─────────────────────┬───────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  4. 结果合并 & 置信度计算                                                               │
│     ┌───────────────────────────────────────────────────────────────────────────────────┐│
│     │  ConfidenceCalculator                                                             ││
│     │    → 使用 Qdrant score + qualityScore 计算置信度                                   ││
│     │    → chunkQualityScore 现在来自真实质量评估                                        ││
│     └───────────────────────────────────────────────────────────────────────────────────┐│
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### 4. 元数据过滤实现

```typescript
// Qdrant 元数据过滤构建器
class QdrantFilterBuilder {
  build(filter: MetadataFilter): QdrantFilter {
    const conditions: FilterCondition[] = [];
    
    // 文档 ID 过滤
    if (filter.documentId) {
      conditions.push({
        key: 'documentId',
        match: { value: filter.documentId }
      });
    }
    
    // 质量分数范围过滤（高效！）
    if (filter.minQuality !== undefined) {
      conditions.push({
        key: 'qualityScore',
        range: { gte: filter.minQuality }
      });
    }
    
    // 页码过滤
    if (filter.pageNumbers?.length) {
      conditions.push({
        key: 'pageNumber',
        match: { any: filter.pageNumbers }
      });
    }
    
    // 模态过滤
    if (filter.modality) {
      conditions.push({
        key: 'modality',
        match: { value: filter.modality }
      });
    }
    
    return { must: conditions };
  }
}
```

### 5. 配置设计

```typescript
// src/config/vector-db-config.ts

export interface VectorStoreConfig {
  type: 'qdrant' | 'in-memory';
  qdrant?: {
    url: string;
    apiKey?: string;
    timeoutMs: number;
    collections: {
      text: string;    // 'text_chunks'
      image: string;   // 'image_chunks'
    };
    hnsw: {
      textM: number;        // 16
      textEfConstruct: number;  // 100
      imageM: number;       // 12
      imageEfConstruct: number; // 80
    };
  };
}

export const DEFAULT_VECTOR_STORE_CONFIG: VectorStoreConfig = {
  type: 'qdrant',
  qdrant: {
    url: process.env.QDRANT_URL ?? 'http://localhost:6333',
    apiKey: process.env.QDRANT_API_KEY,
    timeoutMs: 10000,
    collections: {
      text: 'text_chunks',
      image: 'image_chunks',
    },
    hnsw: {
      textM: 16,
      textEfConstruct: 100,
      imageM: 12,
      imageEfConstruct: 80,
    },
  },
};

// Embedding 维度配置
export const EMBEDDING_DIMENSIONS = {
  text: 1024,   // multilingual-e5-large
  image: 512,   // CLIP ViT-B-32
};
```

## Decisions

### Decision 1: 向量模型选择

**问题**: 1024 维模型选哪个？

**选项**:
- A) `multilingual-e5-large` - 1024 维，多语言支持好，Xenova 可用
- B) `bge-m3` - 1024 维，中文优化，Xenova 可用（2026年已支持）
- C) `text-embedding-3-large` (OpenAI) - 3072 维，API 调用

**选择**: **支持 A 或 B（用户按场景选择）**

**对比分析**:
```
┌────────────────────────────────────────────────────────────┐
│  Model Comparison                                          │
├─────────────────┬────────────────┬────────────────────────┤
│  Feature        │  e5-large      │  bge-m3                │
├─────────────────┼────────────────┼────────────────────────┤
│  Chinese        │  Good          │  Excellent ✓           │
│  Cross-lingual  │  Excellent ✓   │  Good                  │
│  Inference      │  ~50ms         │  ~60ms                 │
│  ONNX (Xenova)  │  ✓             │  ✓ (2026已支持)        │
└─────────────────┴────────────────┴────────────────────────┘
```

**推荐场景**:
- 中文为主 → bge-m3（中文检索最优）
- 中英混合 → multilingual-e5-large（跨语言更强）

**理由**:
- transformers.js V3/V4 现已支持 bge-m3（Xenova/bge-m3）
- 两者都无需 API 调用，本地推理
- 1024 维足够，不需要 OpenAI 3072 维
- 用户可根据文档语言分布选择

### Decision 2: 元数据分离策略

**问题**: chunk content 存在哪里？

**选项**:
- A) 存在 Qdrant payload（与向量一起）
- B) 存在 HierarchicalStore（只存元数据在 Qdrant）
- C) 存在独立文件系统

**选择**: **B) HierarchicalStore 保留**

**理由**:
- content 可能很大（parent chunk 500-1500 tokens）
- Qdrant payload 有大小限制
- HierarchicalStore 已有 JSON 持久化
- 通过 chunkId 关联，查询后获取

### Decision 4: HNSW Parameter Tuning

**问题**: HNSW 参数如何选择？

**参数含义**:
| 参数 | 含义 | 影响 |
|------|------|------|
| M | 每个节点最大连接数 | 内存占用 + 召回率 |
| efConstruct | 构建时搜索宽度 | 构建质量 + 时间 |
| ef | 查询时搜索宽度 | 查询召回率 + 延迟 |

**选择**:
```
text_chunks (1024维, ~100K 向量):
  M = 16
  efConstruct = 100
  ef (查询) = 50-100 (可动态调整)

image_chunks (512维, ~10K 向量):
  M = 12
  efConstruct = 80
  ef (查询) = 40-80
```

**理由**:
- M=16 是召回率和内存的平衡点（8太低，32太高）
- efConstruct=100 保证构建质量，200过慢
- image 用更小参数因为向量数量少，不需要高连接度
- ef 查询参数可动态调整，topK=20 时 ef=50 已足够

**Trade-off 表**:
```
┌────────────────────────────────────────────────────────────┐
│  M 值对比                                                  │
├─────────┬──────────┬──────────┬──────────┬────────────────┤
│  M      │  召回率   │  内存    │  构建时间 │  适用场景      │
├─────────┼──────────┼──────────┼──────────┼────────────────┤
│  8      │  低      │  低      │  快      │  小规模测试    │
│  16 ✓   │  中高    │  中      │  中      │  生产推荐      │
│  32     │  高      │  高      │  慢      │  超高召回需求  │
└─────────┴──────────┴──────────┴──────────┴────────────────┘
```

### Decision 5: Qdrant Filter Implementation

**问题**: 元数据过滤如何实现？

**Qdrant Filter 结构**:
```typescript
interface Filter {
  must?: Condition[];      // AND 语义
  should?: Condition[];    // OR 语义
  must_not?: Condition[];  // NOT 语义
}
```

**关键 Condition 类型**:
| 类型 | 语法 | 语义 |
|------|------|------|
| 精确匹配 | `match: { value }` | field == value |
| 多值匹配 | `match: { any: [...] }` | field IN [...] |
| 范围过滤 | `range: { gte, lte }` | field >= min && field <= max |

**实现**: FilterBuilder 模式
```typescript
// src/retrieval/qdrant-filter-builder.ts
export class QdrantFilterBuilder {
  build(filter: MetadataFilter): Filter | undefined {
    const conditions: Condition[] = [];

    if (filter.documentId) {
      conditions.push({
        key: 'documentId',
        match: { value: filter.documentId }  // 精确匹配
      });
    }

    if (filter.minQuality !== undefined) {
      conditions.push({
        key: 'qualityScore',
        range: { gte: filter.minQuality }  // 范围过滤
      });
    }

    if (filter.pageNumbers?.length) {
      conditions.push({
        key: 'pageNumber',
        match: { any: filter.pageNumbers }  // IN 语义
      });
    }

    return conditions.length ? { must: conditions } : undefined;
  }
}
```

**理由**:
- FilterBuilder 封装 Qdrant 复杂语法
- must = AND 连接多个条件，符合常见过滤场景
- match.any 提供 IN 语义，页码多选高效
- range.gte/lte 支持质量分数范围过滤

### Decision 3: Collection 命名策略

**问题**: 如何处理版本升级？

**选项**:
- A) 固定名称 `text_chunks`，升级时重建
- B) 版本化命名 `text_chunks_v2`

**选择**: **A) 固定名称**

**理由**:
- 抛弃旧数据，直接重建
- 配置简单
- 不需要版本切换逻辑

### Decision 6: Hybrid Retrieval Strategy

**问题**: 是否采用 Dense + Sparse + ColBERT 全 Hybrid？

**选项**:
- A) **Full Hybrid** (Dense + Sparse + ColBERT)
- B) **Lightweight Hybrid** (Dense + Sparse)
- C) **Pure Dense** (仅升级维度)

**选择**: **B) Lightweight Hybrid (Dense + Sparse)**

**对比分析**:
```
┌────────────────────────────────────────────────────────────────────────────┐
│  Hybrid 方案对比                                                            │
├─────────────────┬─────────────────────┬────────────────────────────────────┤
│  方案           │  存储开销            │  适用场景                          │
├─────────────────┼─────────────────────┼────────────────────────────────────┤
│  Dense only     │  400MB (100K)       │  纯语义检索                        │
│  Dense+Sparse ✓ │  430MB (100K)       │  语义+关键词，推荐                 │
│  Dense+Sparse   │  5-20GB (100K)      │  超高精度，存储过大                │
│  +ColBERT       │                     │                                    │
└─────────────────┴─────────────────────┴────────────────────────────────────┘

ColBERT 存储分析:
  每个 token 一个向量 → 500 token chunk = 500 × 1024 × 4bytes = 2MB
  100K chunks = 200GB (不可接受！)
```

**理由**:
- ColBERT 存储开销太大（5-20GB），违背 "实用主义" 原则
- Dense + Sparse 已经覆盖 95% 的检索需求
- Sparse 提供关键词精确匹配（中文召回提升显著）
- RRF 融合简单高效，无需复杂权重调整

**Hybrid 架构**:
```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Lightweight Hybrid Retrieval                                                │
└─────────────────────────────────────────────────────────────────────────────┘

                    文档处理
                    ═════════
     Text ──▶ bge-m3 ──┬──▶ Dense (1024维) ──▶ Qdrant text_chunks.dense
                      │
                      └──▶ Sparse (词权重) ──▶ Qdrant text_chunks.sparse

                    检索流程
                    ═════════
     Query ──▶ bge-m3 ──┬──▶ Dense Search ──┐
                      │                    │
                      └──▶ Sparse Search ──┼──▶ RRF Fusion ──▶ Top-K
                                           │
                                           └──▶ 并行执行 (Promise.all)
```

**bge-m3 模型选择理由**:
- 同时输出 Dense + Sparse，无需两套模型
- transformers.js V3/V4 已支持 (Xenova/bge-m3)
- 中文优化，Sparse 对中文关键词匹配更精准
- 单模型双输出，内存占用更低

### Decision 7: transformers.js API 升级

**问题**: transformers.js V2.17 → V3/V4 API 变化如何处理？

**关键变化**:
| V2.17 (旧) | V3/V4 (新) |
|------------|------------|
| `@xenova/transformers` | `@huggingface/transformers` |
| `pipeline('feature-extraction')` | `pipeline('feature-extraction', { ... })` |
| 单输出 (Dense) | 多输出支持 (Dense + Sparse) |
| `output.data` | `output.dense_vec`, `output.sparse_vec` |

**升级策略**:
```typescript
// V2.17 (旧代码)
const extractor = await pipeline('feature-extraction', modelId);
const output = await extractor(text, { pooling: 'mean', normalize: true });
const denseVector = Array.from(output.data);

// V3/V4 (新代码 - bge-m3)
import { pipeline } from '@huggingface/transformers';
const extractor = await pipeline('feature-extraction', 'Xenova/bge-m3', {
  quantized: true,
});

const output = await extractor(text, {
  pooling: 'mean',
  normalize: true,
  return_sparse: true,  // 启用 Sparse 输出
});

const denseVector = Array.from(output.dense_vec.data);
const sparseVector = new Map(Object.entries(output.sparse_vec));
```

**理由**:
- V3/V4 新增 `return_sparse` 参数支持 bge-m3
- API 前向兼容，渐进升级
- 保留旧代码 fallback 路径

## Risks / Trade-offs

### Risk 1: Qdrant 依赖引入
**影响**: 新增外部服务依赖，部署复杂度增加
**缓解**: 
- Docker 一行启动：`docker run -p 6333:6333 qdrant/qdrant`
- 提供 in-memory fallback 用于本地开发测试

### Risk 2: 内存占用增加
**影响**: 1024 维比 384 维增加 2.67 倍内存
**缓解**:
- Qdrant 支持磁盘存储
- 5千文档 × 50 chunks = 25万向量，约 1GB（可接受）

### Risk 3: 首次模型加载时间
**影响**: multilingual-e5-large 模型较大，首次加载可能需要几分钟
**缓解**:
- 模型下载后本地缓存
- 启动时预加载模型
- 后续启动秒级

### Trade-off: 简洁性 vs 功能
选择固定 1024 维（不支持动态切换），牺牲配置灵活性，换取实现简洁。

## Migration Plan

1. **删除旧数据**
   - 删除 `data/store/hierarchical-store.json`
   - 清空内存数据

2. **安装依赖**
   ```bash
   npm install @qdrant/js-client-rest
   ```

3. **启动 Qdrant**
   ```bash
   docker run -p 6333:6333 -v $(pwd)/qdrant-storage:/qdrant/storage qdrant/qdrant
   ```

4. **修改代码**
   - 创建 VectorStoreAdapter 接口
   - 实现 QdrantVectorStore
   - 修改 document-processor.ts 写入逻辑
   - 修改 small-to-big-retriever.ts 搜索逻辑
   - 添加 embedding 1024 维配置

5. **验证测试**
   - 上传新文档测试
   - 搜索功能测试
   - 元数据过滤测试

6. **回滚策略**
   - 设置 `VECTOR_STORE_TYPE=in-memory` 回退到旧实现
   - Qdrant 故障时自动 fallback