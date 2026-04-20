# Hybrid Retrieval Specification

## Overview

实现 Dense + Sparse 双轨检索，提升语义搜索与关键词匹配的综合召回质量。

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Lightweight Hybrid Retrieval                              │
└─────────────────────────────────────────────────────────────────────────────┘

                     文档处理流
                     ═══════════
                         
     Text Chunk ──────────────────────────────────────────────────────────────▶
                         │
                         ▼
              ┌─────────────────────┐
              │    bge-m3 Model     │
              │  (Xenova/bge-m3)    │
              └─────────────────────┘
                         │
           ┌─────────────┴─────────────┐
           │                           │
           ▼                           ▼
    ┌─────────────┐             ┌─────────────┐
    │ Dense 向量   │             │ Sparse 向量 │
    │  (1024维)   │             │ (词+权重)   │
    └─────────────┘             └─────────────┘
           │                           │
           ▼                           ▼
    ┌─────────────────────────────────────────────────────────────────────────┐
    │                     Qdrant text_chunks Collection                        │
    │  ┌─────────────────────────────────────────────────────────────────────┐│
    │  │  Point:                                                              ││
    │  │    id: chunkId                                                       ││
    │  │    vector: [1024 floats]       ← Dense 语义向量                      ││
    │  │    sparse_values: {            ← Sparse 关键词向量                   ││
    │  │      "优化": 0.85,                                                    ││
    │  │      "架构": 0.72,                                                    ││
    │  │      "性能": 0.68                                                     ││
    │  │    }                                                                  ││
    │  │    payload: { ... }                                                  ││
    │  └─────────────────────────────────────────────────────────────────────┘│
    └─────────────────────────────────────────────────────────────────────────┘


                     检索流 (双轨融合)
                     ══════════════════
                         
     Query ───────────────────────────────────────────────────────────────────▶
                         │
                         ▼
              ┌─────────────────────┐
              │    bge-m3 Model     │
              └─────────────────────┘
                         │
           ┌─────────────┴─────────────┐
           │                           │
           ▼                           ▼
    Dense Vector                 Sparse Vector
    (1024维)                     (词+权重)
           │                           │
           │                           │
           ▼                           ▼
    ┌─────────────┐             ┌─────────────┐
    │ Qdrant      │             │ Qdrant      │
    │ Dense Search│             │ Sparse Search│
    │ (HNSW)      │             │ (Sparse Index)│
    │             │             │             │
    │ top_k=50    │             │ top_k=50    │
    └─────────────┘             └─────────────┘
           │                           │
           │     ┌─────────────────────┤
           │     │                     │
           ▼     ▼                     ▼
    ┌─────────────────────────────────────────────────────────────────────────┐
    │                        RRF Fusion                                        │
    │  Reciprocal Rank Fusion:                                                │
    │    score = Σ 1/(k + rank_i)   (k=60)                                   │
    │                                                                         │
    │  Dense 结果: [chunk-A(rank=1), chunk-B(rank=3), ...]                   │
    │  Sparse 结果: [chunk-C(rank=1), chunk-A(rank=5), ...]                  │
    │                                                                         │
    │  融合后: [chunk-A(高), chunk-C(中), chunk-B(低), ...]                   │
    └─────────────────────────────────────────────────────────────────────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │     Top-K 结果      │
              │   (融合排序后)       │
              └─────────────────────┘
```

## Requirements

### Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-001 | bge-m3 Dense 向量生成 (1024维) | MUST |
| FR-002 | bge-m3 Sparse 向量生成 (词+权重) | MUST |
| FR-003 | Qdrant Sparse Vector 索引支持 | MUST |
| FR-004 | Dense + Sparse 双路搜索 | MUST |
| FR-005 | RRF (Reciprocal Rank Fusion) 融合算法 | MUST |
| FR-006 | transformers.js V3/V4 API 兼容 | MUST |
| FR-007 | 环境变量控制 Hybrid 模式开关 | SHOULD |
| FR-008 | 检索结果来源标记 (dense/sparse/hybrid) | SHOULD |

### Quality Requirements

| ID | Requirement | Baseline | Target |
|----|-------------|----------|--------|
| QR-001 | 中文关键词召回 | 0.65 | 0.85+ |
| QR-002 | 语义召回 | 0.75 | 0.88+ |
| QR-003 | 混合召回 F1 | 0.70 | 0.90+ |
| QR-004 | 检索延迟 (双路) | - | < 30ms |

## Dense Vector Specification

| Attribute | Value |
|-----------|-------|
| Model | Xenova/bge-m3 |
| Dimension | 1024 |
| Distance | Cosine |
| Index | HNSW (M=16, efConstruct=100) |
| Pooling | mean |
| Normalize | true |

## Sparse Vector Specification

| Attribute | Value |
|-----------|-------|
| Model | Xenova/bge-m3 (sparse output) |
| Format | `{ term: weight }` Map |
| Weight Threshold | > 0.01 (过滤低权重词) |
| Index | Qdrant Sparse Index |

**Sparse 向量特点**:
- 词级别权重，非固定维度
- 类似 BM25 但语义增强
- 中文分词由模型内置处理
- 存储压缩友好

## RRF Fusion Algorithm

```typescript
interface FusionResult {
  chunkId: string;
  score: number;
  denseRank?: number;
  sparseRank?: number;
  sources: ('dense' | 'sparse')[];
}

// Reciprocal Rank Fusion
function rrfFusion(
  denseResults: SearchResult[],
  sparseResults: SearchResult[],
  k: number = 60
): FusionResult[] {
  const scoreMap = new Map<string, FusionResult>();
  
  // Dense contribution
  denseResults.forEach((r, rank) => {
    const score = 1 / (k + rank + 1);
    const existing = scoreMap.get(r.id);
    if (existing) {
      existing.score += score;
      existing.denseRank = rank + 1;
      existing.sources.push('dense');
    } else {
      scoreMap.set(r.id, {
        chunkId: r.id,
        score,
        denseRank: rank + 1,
        sources: ['dense']
      });
    }
  });
  
  // Sparse contribution
  sparseResults.forEach((r, rank) => {
    const score = 1 / (k + rank + 1);
    const existing = scoreMap.get(r.id);
    if (existing) {
      existing.score += score;
      existing.sparseRank = rank + 1;
      existing.sources.push('sparse');
    } else {
      scoreMap.set(r.id, {
        chunkId: r.id,
        score,
        sparseRank: rank + 1,
        sources: ['sparse']
      });
    }
  });
  
  // Sort by fused score
  return Array.from(scoreMap.values())
    .sort((a, b) => b.score - a.score);
}
```

## Qdrant Collection Schema

### text_chunks Collection (Small Chunks - Dense + Sparse)

```typescript
// Qdrant text_chunks Collection
// 只存储 Small Chunks，用于主搜索

interface TextChunkPoint {
  id: string;                    // smallChunkId
  
  // Dense vector (1024维) - 语义搜索
  vector: number[];
  
  // Sparse vector - 关键词搜索
  sparse_values: {
    indices: number[];           // 词 ID (内部映射)
    values: number[];            // 权重
  };
  
  payload: {
    documentId: string;
    chunkId: string;             // smallChunkId
    parentId: string;            // 关联 Parent (关键!)
    level: "small";              // 固定为 small
    qualityScore: number;
    pageNumber?: number;
    contentType: string;
    position: { start: number; end: number };
  };
}
```

### parent_chunks Collection (Parent Chunks - Sparse Only)

```typescript
// Qdrant parent_chunks Collection
// 只存储 Sparse，用于 Fallback 索引搜索

interface ParentChunkPoint {
  id: string;                    // parentChunkId
  
  // 只有 Sparse，没有 Dense
  sparse_values: {
    indices: number[];
    values: number[];
  };
  
  payload: {
    documentId: string;
    chunkId: string;             // parentChunkId
    level: "parent";             // 固定为 parent
    childIds: string[];          // 子 Small Chunk IDs
    qualityScore: number;
    tokenCount: number;          // Parent token 长度
    pageNumber?: number;
  };
}
```

**存储对比**:

| Collection | Dense | Sparse | 100K 向量存储 |
|------------|-------|--------|---------------|
| text_chunks (Small) | ✓ 1024维 | ✓ | ~400MB |
| parent_chunks (Parent) | - | ✓ only | ~20MB |
| **总计** | - | - | **~420MB (+20%)** |

**Parent Sparse Index 优势**:
- Fallback 索引搜索，无需遍历
- Sparse 向量轻量（词权重，压缩友好）
- 关键词匹配精确（中文优化）
- 存储开销可控（~5% Dense 开销）
```

## Search API

```typescript
interface HybridSearchQuery {
  query: string;
  topK: number;
  threshold?: number;
  filter?: MetadataFilter;
  
  // Hybrid 配置
  hybrid?: {
    enabled: boolean;
    rrfK?: number;           // RRF 参数，默认 60
    denseTopK?: number;      // Small Dense 搜索 topK
    sparseTopK?: number;     // Small Sparse 搜索 topK
    fallbackSparseTopK?: number;  // Parent Sparse Fallback topK
  };
}

interface HybridSearchResult {
  results: SearchResult[];
  fusionDetails: {
    denseCount: number;
    sparseCount: number;
    overlapCount: number;    // 双路都召回的 chunk
    method: 'hybrid_small' | 'fallback_parent_sparse';
  };
}

// 搜索模式
type SearchMode = 'small_hybrid' | 'parent_sparse_fallback' | 'combined';
```

## Search Flow (Small + Parent Sparse)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  双 Collection 搜索流程                                                       │
└─────────────────────────────────────────────────────────────────────────────┘

Phase 1: Small Chunk Hybrid Search
───────────────────────────────────────────────
  Query → bge-m3 → Dense + Sparse
         │
         ├─→ Qdrant.searchDense('text_chunks', dense, topK=50)
         │     → Dense Results: small chunkIds
         │
         ├─→ Qdrant.searchSparse('text_chunks', sparse, topK=50)
         │     → Sparse Results: small chunkIds
         │
         └─→ RRF Fusion → fusedSmallChunkIds[]
               │
               └─→ 按 parentId 分组 → Parent Expansion
                     │
                     └─→ HierarchicalStore.getParents(parentIds)
                           → Parent Content

Phase 2: Fallback (Parent Sparse Index Search)
─────────────────────────────────────────────────
  条件: Small Hybrid 结果不足 (count < minResults)
  
  Query → bge-m3 → Sparse only (跳过 Dense)
         │
         └─→ Qdrant.searchSparse('parent_chunks', sparse, topK=20)
               │
               └─→ Parent Sparse Results: parentChunkIds[]
                     │
                     └─→ HierarchicalStore.getParents(parentIds)
                           → Parent Content

Phase 3: 结果合并
─────────────────────────────────────────────────
  if (smallResults.length >= minResults):
    return smallResults (with Parent Expansion)
  else:
    return fallbackResults (Parent Sparse)
```

## Testing Criteria

- Dense 向量维度验证 (1024)
- Sparse 向量词权重范围验证 (>0, <1)
- Small Collection 双路搜索验证
- Parent Collection Sparse 搜索验证
- RRF 融合正确性验证
- Parent Expansion 分组验证
- Fallback 触发条件验证
- 检索延迟测试 (Small <30ms, Parent Fallback <15ms)
- 中文关键词匹配测试 (对比纯 Dense)
```

## Configuration

```typescript
interface HybridRetrievalConfig {
  enabled: boolean;
  
  // Dense 配置
  dense: {
    model: 'bge-m3' | 'multilingual-e5-large';
    dimension: 1024;
    hnsw: { m: number; efConstruct: number; ef: number };
  };
  
  // Sparse 配置
  sparse: {
    model: 'bge-m3';           // bge-m3 必须用于 sparse
    minWeight: number;         // 最小权重阈值
    maxTerms: number;          // 最大词数
  };
  
  // Fusion 配置
  fusion: {
    method: 'rrf';
    rrfK: number;
    denseTopK: number;
    sparseTopK: number;
  };
}
```

## Environment Variables

```bash
# Hybrid 模式开关
HYBRID_RETRIEVAL_ENABLED=true

# Dense 模型 (可选 bge-m3 或 e5-large)
DENSE_MODEL=bge-m3

# Sparse 最小权重阈值
SPARSE_MIN_WEIGHT=0.01

# RRF 参数
RRF_K=60
RRF_DENSE_TOPK=50
RRF_SPARSE_TOPK=50
```

## Testing Criteria

- Dense 向量维度验证 (1024)
- Sparse 向量词权重范围验证 (>0, <1)
- 双路搜索独立验证
- RRF 融合正确性验证
- 重叠 chunk 标记验证
- 检索延迟测试 (<30ms)
- 中文关键词匹配测试 (对比纯 Dense)