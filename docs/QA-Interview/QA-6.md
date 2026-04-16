# QA-6: Hybrid 架构下父子级切分搜索策略

## 问题

升级到 Hybrid Retrieval (Dense + Sparse) 后，如何保留 Small-to-Big 父子级切分模式，继续支持父子集搜索？

## 方案对比

### 方案 A: 只索引 Small Chunks（推荐）

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  方案 A: Small-Only 索引                                                     │
└─────────────────────────────────────────────────────────────────────────────┘

存储:
  Qdrant text_chunks:
    ┌─────────────────────────────────────────────────────────────────────────┐
    │  只存储 Small Chunks (Dense + Sparse)                                   │
    │                                                                         │
    │  Point:                                                                 │
    │    id: "small-001"                                                      │
    │    vector: [1024 floats]         ← Dense 语义向量                       │
    │    sparse_values: { ... }        ← Sparse 关键词向量                    │
    │    payload: {                                                           │
    │      parentId: "parent-AAA",    ← 关联 Parent ID                       │
    │      level: "small",                                                   │
    │      position: { start: 100, end: 300 },                               │
    │    }                                                                    │
    │                                                                         │
    │  不存储 Parent Chunks 向量！                                            │
    └─────────────────────────────────────────────────────────────────────────┘

  HierarchicalStore:
    Map<chunkId, {
      content: "...",           ← 完整文本（Small + Parent 都存）
      parentId: "parent-AAA",   ← 父子关联
      childIds: ["small-001", "small-002"],  ← 子 chunk 列表
    }>

搜索流程:
  Query → Hybrid Search (Small Chunks) → 找到匹配的 small chunks
         → 根据 parentId 扩展 → 从 HierarchicalStore 获取 Parent Content

优点:
  ✓ 索引量小（只有 small chunks）
  ✓ 搜索精确（小粒度匹配）
  ✓ Small-to-Big 扩展逻辑不变
  ✓ 存储开销最低

缺点:
  ✗ Fallback 只能遍历 Parent（无向量索引）
  ✗ Parent 粒度搜索需要二次处理
```

### 方案 B: 双层索引（Small + Parent）

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  方案 B: 双层索引 (Small + Parent)                                           │
└─────────────────────────────────────────────────────────────────────────────┘

存储:
  Qdrant text_chunks:
    ┌─────────────────────────────────────────────────────────────────────────┐
    │  存储两套向量（翻倍！）                                                  │
    │                                                                         │
    │  Small Chunk Points:                                                    │
    │    id: "small-001"                                                      │
    │    vector: [1024 floats]                                                │
    │    sparse_values: { ... }                                               │
    │    payload: { level: "small", parentId: "parent-AAA" }                 │
    │                                                                         │
    │  Parent Chunk Points:                                                   │
    │    id: "parent-AAA"                                                     │
    │    vector: [1024 floats]        ← Parent 也有向量                       │
    │    sparse_values: { ... }                                               │
    │    payload: { level: "parent", childIds: [...] }                       │
    │                                                                         │
    │  索引量翻倍: 100K small + 20K parent = 120K points                     │
    └─────────────────────────────────────────────────────────────────────────┘

搜索流程:
  主搜索: Hybrid Search (Small Chunks) → 扩展到 Parent
  Fallback: Hybrid Search (Parent Chunks) → 直接返回 Parent Content

优点:
  ✓ Parent 有独立索引，Fallback 高效
  ✓ 支持直接 Parent 搜索
  ✓ 双层召回覆盖更全

缺点:
  ✗ 存储翻倍（2x 向量存储）
  ✗ 索引维护复杂（父子联动更新）
  ✗ 冗余：Parent 内容是 Small 的拼接，向量语义相似
```

### 方案 C: Small 紧密索引 + Parent Payload

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  方案 C: Small 紧密索引 + Parent Payload                                     │
└─────────────────────────────────────────────────────────────────────────────┘

存储:
  Qdrant text_chunks:
    ┌─────────────────────────────────────────────────────────────────────────┐
    │  Small Chunks + Parent 信息紧密存储                                     │
    │                                                                         │
    │  Point:                                                                 │
    │    id: "small-001"                                                      │
    │    vector: [1024 floats]                                                │
    │    sparse_values: { ... }                                               │
    │    payload: {                                                           │
    │      parentId: "parent-AAA",                                           │
    │      level: "small",                                                   │
    │      parentContent: "...",      ← Parent 内容存 payload（大！）         │
    │      parentQualityScore: 0.85,                                         │
    │    }                                                                    │
    │                                                                         │
    │  问题: payload 有大小限制，Parent 内容可能超限                          │
    └─────────────────────────────────────────────────────────────────────────┘

优点:
  ✓ 单次查询获取完整上下文

缺点:
  ✗ Payload 大小限制（Qdrant 推荐 < 1KB）
  ✗ Parent 内容重复存储（每个 small chunk 都存一份）
  ✗ 存储冗余严重
```

---

## 推荐方案：Hybrid Small-to-Big

### 架构设计

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Hybrid Small-to-Big 架构                                                    │
└─────────────────────────────────────────────────────────────────────────────┘

                           文档处理流程
                           ═════════════

     Document
         │
         ▼
     Semantic Chunker
         │
         ├──────────────────────────────────────────────────────────────────────
         │
         │  输出: HierarchicalChunks
         │    ├─ Small Chunks: 100-200 tokens, 精确匹配单位
         │    └─ Parent Chunks: 500-1500 tokens, 上下文单位
         │
         ▼
     Hybrid Embedding (bge-m3)
         │
         │  Small Chunk → Dense (1024) + Sparse (词权重)
         │  Parent Chunk → 不生成向量（只存元数据）
         │
         ▼
     ┌─────────────────────────────────────────────────────────────────────────┐
     │  双轨存储                                                                │
     │                                                                         │
     │  Qdrant text_chunks (只索引 Small):                                    │
     │    Point:                                                               │
     │      id: smallChunkId                                                   │
     │      vector: Dense[1024]                                                │
     │      sparse_values: Sparse                                             │
     │      payload: {                                                         │
     │        parentId, level: "small", qualityScore, position, ...            │
     │      }                                                                  │
     │                                                                         │
     │  HierarchicalStore (Small + Parent 元数据):                            │
     │    smallChunks: Map<id, { content, parentId, qualityScore }>           │
     │    parentChunks: Map<id, { content, childIds[], qualityScore }>        │
     └─────────────────────────────────────────────────────────────────────────┘


                           检索流程
                           ═════════

     Query: "性能优化的架构设计方法"
         │
         ▼
     Hybrid Embedding
         │
         ├─ Dense [1024]
         └─ Sparse { "性能": 0.85, "优化": 0.72 }
         │
         ▼
     ┌─────────────────────────────────────────────────────────────────────────┐
     │  Phase 1: Small Chunk Hybrid Search                                     │
     │                                                                         │
     │  Qdrant 搜索:                                                           │
     │    searchDense(text_chunks, dense, topK=50)  → Dense Results          │
     │    searchSparse(text_chunks, sparse, topK=50) → Sparse Results        │
     │                                                                         │
     │  RRF Fusion:                                                            │
     │    融合 Dense + Sparse 结果 → fusedSmallChunkIds[]                    │
     │                                                                         │
     │  结果:                                                                  │
     │    [                                                                    │
     │      { smallChunkId: "s-001", score: 0.85, parentId: "p-AAA" },       │
     │      { smallChunkId: "s-002", score: 0.82, parentId: "p-AAA" },       │
     │      { smallChunkId: "s-005", score: 0.78, parentId: "p-BBB" },       │
     │    ]                                                                    │
     └─────────────────────────────────────────────────────────────────────────┘
         │
         ▼
     ┌─────────────────────────────────────────────────────────────────────────┐
     │  Phase 2: Parent Expansion (Small-to-Big)                               │
     │                                                                         │
     │  按 parentId 分组:                                                      │
     │    p-AAA: [s-001 (0.85), s-002 (0.82)]  → 2 个匹配                      │
     │    p-BBB: [s-005 (0.78)]                 → 1 个匹配                      │
     │                                                                         │
     │  Parent Score 计算:                                                     │
     │    score(parent) = max(childScores) 或 avg(childScores)                │
     │                                                                         │ │    p-AAA.score = max(0.85, 0.82) = 0.85                               │
     │    p-BBB.score = 0.78                                                   │
     │                                                                         │
     │  从 HierarchicalStore 获取 Parent Content:                             │
     │    parentAAA.content = "完整 500-1500 tokens 上下文..."                │
     │    parentBBB.content = "另一个完整上下文..."                            │
     └─────────────────────────────────────────────────────────────────────────┘
         │
         ▼
     ┌─────────────────────────────────────────────────────────────────────────┐
     │  Phase 3: Fallback (如果 Small 搜索结果不足)                            │
     │                                                                         │
     │  策略 A: 阈值过滤                                                        │
     │    如果 fusedSmallChunks.length < minResults:                          │
     │      触发 Fallback                                                      │
     │                                                                         │
     │  策略 B: Parent 粒度关键词搜索                                           │
     │    用 Query Sparse 向量做全文匹配:                                      │
     │      在 HierarchicalStore 中遍历 Parent Content                        │
     │      匹配关键词 {"性能", "优化", "架构"}                                │
     │      → 返回匹配的 Parent Chunks                                         │
     │                                                                         │
     │  策略 C: 独立 Parent Sparse Index (可选增强)                            │
     │    Qdrant parent_chunks 只存 Sparse（无 Dense）                        │
     │    → Fallback 时 Sparse Search Parent                                  │
     └─────────────────────────────────────────────────────────────────────────┘
         │
         ▼
     Final Results:
       [
         {
           parentChunkId: "p-AAA",
           parentContent: "完整上下文...",
           matchedSmallChunks: ["s-001", "s-002"],
           score: 0.85,
           source: "hybrid"
         },
         {
           parentChunkId: "p-BBB",
           parentContent: "另一个完整上下文...",
           matchedSmallChunks: ["s-005"],
           score: 0.78,
           source: "hybrid"
         }
       ]
```

### 核心实现

```typescript
// src/retrieval/hybrid-small-to-big.ts

export interface HybridSmallToBigConfig {
  // Small 搜索配置
  smallTopK: number;           // 50
  denseTopK: number;           // 50
  sparseTopK: number;          // 50
  
  // Parent 扩展配置
  parentScoreStrategy: 'max' | 'avg' | 'weighted';  // max
  maxParents: number;          // 10
  
  // Fallback 配置
  enableFallback: boolean;
  fallbackMinResults: number;  // 3
  fallbackThreshold: number;   // 0.6
}

export class HybridSmallToBigRetriever {
  private qdrant: QdrantVectorStore;
  private hierarchicalStore: HierarchicalStore;
  private embeddingService: HybridEmbeddingService;
  private config: HybridSmallToBigConfig;

  /**
   * Hybrid Small-to-Big 检索
   */
  async retrieve(query: string): Promise<HybridRetrievalResult[]> {
    // 1. 生成 Hybrid Embedding
    const embedding = await this.embeddingService.embedHybrid(query);

    // 2. Phase 1: Small Chunk Hybrid Search
    const smallResults = await this.searchSmallChunksHybrid(embedding);

    // 3. 检查是否需要 Fallback
    if (smallResults.length < this.config.fallbackMinResults) {
      console.log('[HybridSmallToBig] Triggering fallback: results insufficient');
      const fallbackResults = await this.fallbackSearch(embedding);
      return fallbackResults;
    }

    // 4. Phase 2: Parent Expansion
    const parentResults = this.expandToParents(smallResults);

    // 5. 限制结果数量
    return parentResults.slice(0, this.config.maxParents);
  }

  /**
   * Phase 1: Small Chunk Hybrid Search
   */
  private async searchSmallChunksHybrid(
    embedding: HybridEmbeddingResult
  ): Promise<SmallChunkSearchResult[]> {
    // 并行 Dense + Sparse 搜索
    const [denseResults, sparseResults] = await Promise.all([
      this.qdrant.searchDense('text_chunks', {
        vector: embedding.dense,
        topK: this.config.denseTopK,
        filter: { level: 'small' },  // 只搜索 small chunks
      }),
      
      this.qdrant.searchSparse('text_chunks', {
        sparseVector: embedding.sparse,
        topK: this.config.sparseTopK,
        filter: { level: 'small' },
      }),
    ]);

    // RRF 融合
    const fused = rrfFusion(denseResults, sparseResults, this.config.rrfK);

    // 从 HierarchicalStore 获取 small chunk content
    const smallChunks = this.hierarchicalStore.getChunks(
      fused.map(f => f.chunkId)
    );

    // 组合结果
    return fused.map((f, i) => ({
      smallChunkId: f.chunkId,
      smallChunkContent: smallChunks[i]?.content ?? '',
      parentId: f.payload.parentId as string,
      score: f.score,
      sources: f.sources,
      qualityScore: f.payload.qualityScore as number,
    }));
  }

  /**
   * Phase 2: Parent Expansion (Small-to-Big)
   */
  private expandToParents(
    smallResults: SmallChunkSearchResult[]
  ): HybridRetrievalResult[] {
    // 按 parentId 分组
    const parentGroups = this.groupByParent(smallResults);

    // 计算每个 Parent 的分数
    const parentScores = this.calculateParentScores(parentGroups);

    // 从 HierarchicalStore 获取 Parent Content
    const parentIds = Array.from(parentGroups.keys());
    const parentChunks = this.hierarchicalStore.getParentChunks(parentIds);

    // 组装最终结果
    return parentScores.map(ps => {
      const parent = parentChunks.get(ps.parentId);
      const matchedSmall = parentGroups.get(ps.parentId) ?? [];

      return {
        parentChunkId: ps.parentId,
        parentContent: parent?.content ?? '',
        matchedSmallChunks: matchedSmall.map(s => ({
          smallChunkId: s.smallChunkId,
          smallChunkContent: s.smallChunkContent,
          score: s.score,
        })),
        score: ps.score,
        source: 'hybrid',
        qualityScore: parent?.qualityScore ?? 0,
      };
    }).sort((a, b) => b.score - a.score);
  }

  /**
   * 按 parentId 分组
   */
  private groupByParent(
    smallResults: SmallChunkSearchResult[]
  ): Map<string, SmallChunkSearchResult[]> {
    const groups = new Map<string, SmallChunkSearchResult[]>();

    for (const result of smallResults) {
      const existing = groups.get(result.parentId);
      if (existing) {
        existing.push(result);
      } else {
        groups.set(result.parentId, [result]);
      }
    }

    return groups;
  }

  /**
   * 计算 Parent 分数
   */
  private calculateParentScores(
    parentGroups: Map<string, SmallChunkSearchResult[]>
  ): ParentScore[] {
    const scores: ParentScore[] = [];

    for (const [parentId, smallChunks] of parentGroups) {
      let score: number;

      switch (this.config.parentScoreStrategy) {
        case 'max':
          score = Math.max(...smallChunks.map(s => s.score));
          break;
        case 'avg':
          score = smallChunks.reduce((sum, s) => sum + s.score, 0) / smallChunks.length;
          break;
        case 'weighted':
          // 权重：匹配数量越多，分数越高
          const avgScore = smallChunks.reduce((sum, s) => sum + s.score, 0) / smallChunks.length;
          const matchBonus = Math.log(smallChunks.length + 1);
          score = avgScore * (1 + 0.1 * matchBonus);
          break;
      }

      scores.push({
        parentId,
        score,
        matchedCount: smallChunks.length,
      });
    }

    return scores.sort((a, b) => b.score - a.score);
  }

  /**
   * Fallback 搜索策略
   */
  private async fallbackSearch(
    embedding: HybridEmbeddingResult
  ): Promise<HybridRetrievalResult[]> {
    // 策略 A: Sparse 关键词在 Parent Content 中匹配
    const keywords = Array.from(embedding.sparse.keys())
      .filter(k => embedding.sparse.get(k)! > 0.3);

    console.log('[HybridSmallToBig] Fallback keywords:', keywords);

    // 遍历 Parent Chunks，匹配关键词
    const parentChunks = this.hierarchicalStore.getAllParentChunks();
    const matches: HybridRetrievalResult[] = [];

    for (const parent of parentChunks) {
      const keywordMatches = this.matchKeywords(parent.content, keywords);
      if (keywordMatches.score > this.config.fallbackThreshold) {
        matches.push({
          parentChunkId: parent.id,
          parentContent: parent.content,
          matchedSmallChunks: [],
          score: keywordMatches.score,
          source: 'fallback_keyword',
          qualityScore: parent.qualityScore,
        });
      }
    }

    return matches.sort((a, b) => b.score - a.score)
      .slice(0, this.config.maxParents);
  }

  /**
   * 关键词匹配评分
   */
  private matchKeywords(content: string, keywords: string[]): KeywordMatchResult {
    const lowerContent = content.toLowerCase();
    let matchCount = 0;
    let totalWeight = 0;

    for (const keyword of keywords) {
      if (lowerContent.includes(keyword.toLowerCase())) {
        matchCount++;
        totalWeight += 1;
      }
    }

    // BM25-like scoring
    const score = matchCount > 0 
      ? (matchCount / keywords.length) * (1 + Math.log(matchCount))
      : 0;

    return { score, matchCount, matchedKeywords: keywords.slice(0, matchCount) };
  }
}

// 类型定义
interface SmallChunkSearchResult {
  smallChunkId: string;
  smallChunkContent: string;
  parentId: string;
  score: number;
  sources: ('dense' | 'sparse')[];
  qualityScore: number;
}

interface HybridRetrievalResult {
  parentChunkId: string;
  parentContent: string;
  matchedSmallChunks: SmallChunkMatch[];
  score: number;
  source: 'hybrid' | 'fallback_keyword' | 'fallback_parent';
  qualityScore: number;
}

interface SmallChunkMatch {
  smallChunkId: string;
  smallChunkContent: string;
  score: number;
}

interface ParentScore {
  parentId: string;
  score: number;
  matchedCount: number;
}
```

### Qdrant Collection 设计

```typescript
// Qdrant text_chunks Collection (只索引 Small)

interface TextChunksCollectionConfig {
  vectors: {
    dense: {
      size: 1024,
      distance: 'Cosine',
      hnsw: { m: 16, efConstruct: 100 },
    },
  };
  
  sparse_vectors: {
    sparse: {},  // Sparse index
  };
}

// Point 结构
interface SmallChunkPoint {
  id: string;                    // smallChunkId
  
  vector: number[];              // Dense [1024]
  
  sparse_values: {
    indices: number[];
    values: number[];
  };
  
  payload: {
    // 关键： parentId 关联
    parentId: string;            // ← Parent Chunk ID
    
    // Small Chunk 元数据
    level: 'small';
    documentId: string;
    qualityScore: number;
    position: { start: number; end: number };
    pageNumber?: number;
    
    // 可选：预存部分 Parent 信息（优化单次查询）
    parentQualityScore?: number;
    parentTokenCount?: number;
  };
}
```

### HierarchicalStore 设计

```typescript
// src/chunking/hierarchical-store.ts (改造后)

interface HierarchicalStoreData {
  // Small Chunks 元数据
  smallChunks: Map<string, {
    content: string;             // ← Small Chunk 文本
    parentId: string;
    qualityScore: number;
    position: { start: number; end: number };
    sourceDocumentId: string;
  }>;

  // Parent Chunks 元数据
  parentChunks: Map<string, {
    content: string;             // ← Parent Chunk 文本（完整上下文）
    childIds: string[];          // ← 子 Small Chunk IDs
    qualityScore: number;
    sourceDocumentId: string;
  }>;

  // 文档索引
  documents: Map<string, {
    name: string;
    smallChunkCount: number;
    parentChunkCount: number;
    processedAt: Date;
  }>;
}

class HierarchicalStore {
  // 批量获取 Small Chunks
  getChunks(chunkIds: string[]): (SmallChunkData | undefined)[] {
    return chunkIds.map(id => this.data.smallChunks.get(id));
  }

  // 批量获取 Parent Chunks
  getParentChunks(parentIds: string[]): Map<string, ParentChunkData> {
    const result = new Map();
    for (const id of parentIds) {
      const chunk = this.data.parentChunks.get(id);
      if (chunk) result.set(id, chunk);
    }
    return result;
  }

  // 获取单个 Parent
  getParentChunk(parentId: string): ParentChunkData | undefined {
    return this.data.parentChunks.get(parentId);
  }

  // 根据 Small Chunk ID 找 Parent
  getParentBySmallChunkId(smallChunkId: string): ParentChunkData | undefined {
    const small = this.data.smallChunks.get(smallChunkId);
    if (!small) return undefined;
    return this.data.parentChunks.get(small.parentId);
  }

  // Fallback: 获取所有 Parent
  getAllParentChunks(): ParentChunkData[] {
    return Array.from(this.data.parentChunks.values());
  }

  // JSON 持久化（不含向量）
  saveToJson(path: string): void {
    const serializable = {
      smallChunks: Array.from(this.data.smallChunks.entries()),
      parentChunks: Array.from(this.data.parentChunks.entries()),
      documents: Array.from(this.data.documents.entries()),
    };
    // 写入文件...
  }
}
```

---

## Fallback 增强方案

### 独立 Parent Sparse Index（可选）

如果想增强 Fallback 性能，可以为 Parent Chunks 创建独立的 Sparse Index：

```typescript
// Qdrant parent_chunks Collection (只 Sparse)

interface ParentChunksCollectionConfig {
  // 只有 Sparse，没有 Dense
  sparse_vectors: {
    sparse: {},
  };
}

// 用途：Fallback 时高效搜索 Parent
async fallbackSearchWithSparseIndex(
  embedding: HybridEmbeddingResult
): Promise<HybridRetrievalResult[]> {
  // 直接在 Parent Sparse Index 搜索
  const parentResults = await this.qdrant.searchSparse('parent_chunks', {
    sparseVector: embedding.sparse,
    topK: 10,
  });

  // 从 HierarchicalStore 获取 Parent Content
  const parentIds = parentResults.map(r => r.id);
  const parentChunks = this.hierarchicalStore.getParentChunks(parentIds);

  return parentResults.map((r, i) => ({
    parentChunkId: r.id,
    parentContent: parentChunks.get(r.id)?.content ?? '',
    matchedSmallChunks: [],
    score: r.score,
    source: 'fallback_sparse',
    qualityScore: r.payload.qualityScore as number,
  }));
}
```

**优点**:
- Fallback 不需要遍历，直接索引搜索
- 只 Sparse Index，存储开销小（~20% Dense 开销）

**缺点**:
- 需要维护两个 Collection
- Parent Sparse 向量需要额外生成

---

## 总结对比

| 方案 | 索引量 | Small-to-Big | Fallback 性能 | 存储开销 | 推荐度 |
|------|--------|--------------|---------------|----------|--------|
| A: Small-Only | 低 | ✓ 完美 | 遍历 Parent | 最低 | ★★★★★ |
| B: 双层索引 | 高 | ✓ 完美 | 索引搜索 | 2x | ★★☆☆☆ |
| C: Payload 紧密 | 低 | ✓ 完美 | 单次查询 | 冗余大 | ★☆☆☆☆ |
| D: Small + Parent Sparse | 中 | ✓ 完美 | 索引搜索 | +20% | ★★★★☆ |

**推荐**: 方案 A (Small-Only) + 可选增强 D (Parent Sparse Index for Fallback)

---

## 实现路线图

### Phase 1: Small-Only 基础实现
- Qdrant 只索引 Small Chunks (Dense + Sparse)
- HierarchicalStore 保持父子元数据
- 实现 HybridSmallToBigRetriever
- Fallback 用关键词遍历 Parent

### Phase 2: 优化 Fallback（可选）
- 创建 parent_chunks Collection (只 Sparse)
- Parent Sparse 向量生成
- Fallback 改用 Sparse Index 搜索

### Phase 3: 性能优化
- Parent Score 策略调优（max/avg/weighted）
- 匹配数量 Bonus 计算
- 并行搜索优化

---

## 相关文档

- [QA-5: Hybrid Retrieval 与现有策略兼容性](./QA-5.md)
- [QA-4: bge-m3 transformers.js 支持](./QA-4.md)
- [Hybrid Retrieval SDD](../openspec/changes/upgrade-to-qdrant-vector-store/sdd.md)