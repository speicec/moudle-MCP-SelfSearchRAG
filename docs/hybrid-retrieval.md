# Hybrid Retrieval Architecture

## Overview

This document describes the Hybrid Retrieval system implemented in the RAG MCP Server, combining Dense vectors (semantic search) and Sparse vectors (keyword matching) for optimal retrieval performance.

## Architecture

### Three-Collection Model

The system uses three separate Qdrant collections optimized for different use cases:

| Collection | Vector Type | Dimension | Purpose |
|------------|-------------|-----------|---------|
| `text_chunks` | Dense + Sparse | 1024 + Sparse | Small chunk hybrid search |
| `parent_chunks` | Sparse only | Sparse only | Parent fallback search |
| `image_chunks` | Dense only | 512 | Image similarity search |

### Data Flow

```
Document Upload
      │
      ▼
┌─────────────────┐
│  Document       │
│  Processing     │
└─────────────────┘
      │
      ▼
┌─────────────────┐
│  Chunking       │
│  (Small+Parent) │
└─────────────────┘
      │
      ├──────────────────┬──────────────────┐
      ▼                  ▼                  ▼
┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│ text_chunks │   │parent_chunks│   │image_chunks │
│ Dense+Sparse│   │Sparse only  │   │Dense only   │
└─────────────┘   └─────────────┘   └─────────────┘
      │                  │                  │
      └──────────────────┴──────────────────┘
                         │
                         ▼
                  ┌─────────────┐
                  │   Query     │
                  │   Search    │
                  └─────────────┘
```

## Retrieval Process

### Phase 1: Small Chunk Hybrid Search

When a query is received:

1. Generate query embeddings using HybridEmbeddingService:
   - Dense vector (1024 dimensions)
   - Sparse vector (term weights)

2. Parallel search on `text_chunks`:
   - Dense search (HNSW index)
   - Sparse search (Sparse index)

3. RRF Fusion combines results:
   ```
   score = Σ 1/(k + rank_i)
   ```

### Phase 2: Parent Expansion

Small chunk results are expanded to parent chunks:

1. Group small chunks by `parentId`
2. Calculate parent scores:
   - **max**: Highest small chunk score
   - **avg**: Average of small chunk scores
   - **weighted**: avg × (1 + log(matchCount))

3. Fetch parent content from HierarchicalStore

### Phase 3: Fallback to Parent Sparse Index

If small hybrid search returns insufficient results:

1. Search `parent_chunks` using sparse index
2. No traversal required - direct index lookup
3. Return parent content directly

## RRF Fusion Algorithm

Reciprocal Rank Fusion (RRF) combines ranked lists without score normalization:

```typescript
function rrfFusion(denseResults, sparseResults, k = 60) {
  const scoreMap = new Map();

  // Process dense results
  for (let i = 0; i < denseResults.length; i++) {
    const rrfScore = 1 / (k + (i + 1));
    // ... accumulate score
  }

  // Process sparse results
  for (let i = 0; i < sparseResults.length; i++) {
    const rrfScore = 1 / (k + (i + 1));
    // ... accumulate score
  }

  return sortByScore(scoreMap);
}
```

Benefits of RRF:
- No score normalization needed
- Robust to different score scales
- Simple and effective

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VECTOR_STORE_TYPE` | Vector store type ('qdrant' or 'in-memory') | 'in-memory' |
| `QDRANT_URL` | Qdrant server URL | 'http://localhost:6333' |
| `QDRANT_API_KEY` | Qdrant API key (optional) | - |
| `HYBRID_RETRIEVAL_ENABLED` | Enable hybrid mode | 'true' |
| `EMBEDDING_MODE` | Embedding mode ('hybrid', 'local', 'api') | 'local' |

### Hybrid Config (src/config/vector-db-config.ts)

```typescript
const DEFAULT_HYBRID_CONFIG = {
  enabled: true,
  denseWeight: 0.7,
  sparseWeight: 0.3,
  rrf: {
    k: 60,
    denseTopK: 50,
    sparseTopK: 50,
    fallbackTopK: 20,
  },
};
```

## bge-m3 Model

The system uses BAAI/bge-m3 for hybrid embeddings:

- **Dense output**: 1024 dimensions (semantic similarity)
- **Sparse output**: Term weights (keyword matching)
- **Multilingual**: Supports Chinese, English, and 100+ languages

### Usage

```typescript
// Small chunk: Dense + Sparse
const hybrid = await embeddingService.embedHybrid(text);
// hybrid.dense: number[] (1024)
// hybrid.sparse: { indices: number[], values: number[] }

// Parent chunk: Sparse only (saves storage)
const sparse = await embeddingService.embedSparseOnly(text);
// sparse.sparse: { indices: number[], values: number[] }
```

## Vector Payload Schema

### text_chunks Payload

```typescript
{
  documentId: string,
  chunkId: string,
  parentId: string,        // Link to parent
  level: 'small',
  modality: 'text',
  qualityScore: number,
  pageNumber: number,
  contentType: string,
  position: { start, end }
}
```

### parent_chunks Payload

```typescript
{
  documentId: string,
  chunkId: string,
  level: 'parent',
  modality: 'text',
  qualityScore: number,
  childIds: string[],      // Link to children
  pageNumber: number,
  contentType: string,
  position: { start, end }
}
```

### image_chunks Payload

```typescript
{
  documentId: string,
  chunkId: string,
  level: 'image',
  modality: 'image',
  blockType: 'figure' | 'table' | 'formula' | 'image',
  pageNumber: number,
  vlmText: string,         // VLM description
  width: number,
  height: number
}
```

## Migration Guide

### From In-Memory to Qdrant

1. Install Qdrant:
   ```bash
   docker run -p 6333:6333 qdrant/qdrant
   ```

2. Set environment variables:
   ```bash
   export VECTOR_STORE_TYPE=qdrant
   export QDRANT_URL=http://localhost:6333
   export EMBEDDING_MODE=hybrid
   ```

3. Re-process documents to populate Qdrant collections

### Data Migration

- Old `hierarchical-store.json` format (v1) contains embeddings
- New format (v2) stores only metadata, embeddings in Qdrant
- Migration script required for existing data

## Performance Considerations

### Search Performance

| Operation | In-Memory | Qdrant |
|-----------|-----------|--------|
| Dense search | O(N) linear | O(log N) HNSW |
| Sparse search | O(N) linear | O(1) index |
| Hybrid search | O(N) × 2 | O(log N) + O(1) |

### Storage Efficiency

- **Small chunks**: Dense (1024) + Sparse ~1KB each
- **Parent chunks**: Sparse only ~200B each (80% reduction)
- **Image chunks**: Dense (512) ~0.5KB each

## Troubleshooting

### Common Issues

1. **Qdrant connection failed**
   - Check Qdrant is running: `curl http://localhost:6333/collections`
   - Fallback to in-memory mode automatically

2. **Model loading timeout**
   - Set `TRANSFORMERS_CACHE` for model caching
   - Use `HF_ENDPOINT` for China mirror

3. **Sparse search returns no results**
   - Check sparse vector dimension matches collection config
   - Verify `sparseMinWeight` threshold is appropriate

## References

- [Qdrant Documentation](https://qdrant.tech/documentation/)
- [bge-m3 Paper](https://arxiv.org/abs/2402.03216)
- [RRF Paper](https://plg.uwaterloo.ca/~gvcormac/cormacksigir09-rrf.pdf)