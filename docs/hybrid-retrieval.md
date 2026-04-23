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
| `STORE_CONTENT_IN_PAYLOAD` | Store chunk content in Qdrant payload for recovery | 'false' |
| `MAX_PAYLOAD_CONTENT_SIZE` | Maximum content size to store in payload (bytes) | '10240' (10KB) |

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

### Collection Recreation (Sparse Vector Fix)

**⚠️ IMPORTANT: After upgrading to named vector format, you MUST recreate all collections and reprocess documents.**

The sparse vector fix (2026-04-23) changed the Qdrant collection architecture to use **named vectors**:

**Old Architecture (WRONG - sparse search fails):**
```
text_chunks: vectors: {size: 1024} (unnamed) + sparse_vectors: {text_sparse}
```

**New Architecture (CORRECT - sparse search works):**
```
text_chunks: vectors: {text_dense: {size: 1024}} + sparse_vectors: {text_sparse}
```

**Root Cause**: When using named sparse vectors, Qdrant requires named dense vectors too. Both must be in the same `vector` object.

**Migration Steps:**

1. **Backup existing data** (if needed):
   ```bash
   # Export documents from Qdrant if you need to preserve them
   curl http://localhost:6333/collections/text_chunks/points/export > text_backup.json
   curl http://localhost:6333/collections/parent_chunks/points/export > parent_backup.json
   curl http://localhost:6333/collections/image_chunks/points/export > image_backup.json
   ```

2. **Delete existing collections**:
   ```bash
   curl -X DELETE http://localhost:6333/collections/text_chunks
   curl -X DELETE http://localhost:6333/collections/parent_chunks
   curl -X DELETE http://localhost:6333/collections/image_chunks
   ```

3. **Restart the server** - collections will be recreated with correct named vector format:
   ```bash
   npm run dev
   ```

4. **Reprocess ALL documents** to populate vectors with new format:
   ```bash
   # Use MCP tool or HTTP API to re-upload documents
   ```

5. **Verify sparse search works**:
   ```bash
   # Test with keyword query like "加班" or "禁忌"
   curl -X POST http://localhost:3000/api/chat/generate \
     -H "Content-Type: application/json" \
     -d '{"query": "加班", "topK": 5}'
   ```

**Why This is Required:**
- Old documents lack sparse vectors (bug caused field name mismatch)
- Even if sparse vectors existed, they were stored in wrong format (`sparse_vector` field instead of inside `vector` object)
- Named vector format is a fundamental architecture change that cannot be migrated in-place

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
   - **Most Likely Cause**: Using old collection architecture with unnamed dense vectors
   - **Check collection configuration**:
     ```bash
     curl http://localhost:6333/collections/text_chunks
     # Should show: vectors: {"text_dense": {...}}
     # NOT: vectors: {size: 1024} (unnamed format)
     ```
   - **Fix**: Recreate collections with named vector format (see "Collection Recreation" section above)
   - Verify sparse vector dimension matches collection config
   - Verify `sparseMinWeight` threshold is appropriate

4. **Named vector format explanation**
   
   **Qdrant Named Vector Requirements:**
   - When using named sparse vectors, dense vectors MUST also be named
   - Both vectors go in the SAME `vector` object, not separate fields
   
   **Correct Format (Upsert):**
   ```json
   {
     "id": "point_id",
     "vector": {
       "text_dense": [0.1, 0.2, ..., 0.1024],  // Named dense vector
       "text_sparse": {                          // Named sparse vector
         "indices": [123, 456, 789],
         "values": [0.5, 0.8, 0.3]
       }
     },
     "payload": {...}
   }
   ```
   
   **Wrong Format (Will Fail):**
   ```json
   {
     "id": "point_id",
     "vector": [0.1, 0.2, ..., 0.1024],         // ❌ Unnamed dense (array)
     "sparse_vector": {                          // ❌ Separate field
       "indices": [123, 456, 789],
       "values": [0.5, 0.8, 0.3]
     }
   }
   ```
   
   **Collection Configuration:**
   ```json
   {
     "vectors": {
       "text_dense": {"size": 1024, "distance": "Cosine"}
     },
     "sparse_vectors": {
       "text_sparse": {"modifier": "idf"}
     }
   }
   ```
   
   **Search Format:**
   ```json
   // Dense search
   {
     "vector": {
       "name": "text_dense",
       "vector": [0.1, 0.2, ..., 0.1024]
     }
   }
   
   // Sparse search
   {
     "vector": {
       "name": "text_sparse",
       "vector": {
         "indices": [123, 456, 789],
         "values": [0.5, 0.8, 0.3]
       }
     }
   }
   ```

5. **Parent chunk not found in HierarchicalStore**
   - Enable `STORE_CONTENT_IN_PAYLOAD=true` for recovery capability
   - Check storage sync status at `/api/stats/health/storage`
   - Recovery mechanism will automatically recover from Qdrant during retrieval

## Recovery Mechanism (Data Consistency)

### Problem: HierarchicalStore and Qdrant Inconsistency

When the server restarts or document processing is interrupted, `HierarchicalStore` may lose chunk metadata while `Qdrant` retains the vectors. This causes retrieval to fail when trying to expand small chunks to parent content.

### Solution: Three-Level Recovery

1. **Startup Sync Check** (Automatic)
   - Compares chunk counts between `HierarchicalStore` and `Qdrant`
   - Logs warnings if data is inconsistent
   - Runs asynchronously without blocking server startup

2. **On-Demand Recovery** (During Retrieval)
   - When `HierarchicalStore.getChunk()` returns undefined, `HybridSmallToBigRetriever` attempts to recover from Qdrant payload
   - Recovered chunks are temporarily added to `HierarchicalStore`
   - Requires `STORE_CONTENT_IN_PAYLOAD=true`

3. **Health Check API** (Monitoring)
   - `/api/stats/health/storage` - View storage status
   - `/api/stats/health/storage/sync` - Trigger manual sync check

### Payload Enhancement

To enable recovery, chunk content must be stored in Qdrant payload:

```typescript
// VectorPayload interface with content field
interface VectorPayload {
  documentId: string;
  chunkId: string;
  level: 'small' | 'parent' | 'image';
  modality: 'text' | 'image';
  content?: string;  // Recovery content (requires STORE_CONTENT_IN_PAYLOAD=true)
  // ... other fields
}
```

Configuration:
```bash
export STORE_CONTENT_IN_PAYLOAD=true
export MAX_PAYLOAD_CONTENT_SIZE=10240  # 10KB max per chunk
```

### Recovery Flow

```
Retrieval Request
       │
       ▼
┌─────────────────────────────┐
│  HybridSmallToBigRetriever  │
│  searchHybrid()             │
└─────────────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│  expandToParents()          │
│  Get parent chunk from      │
│  HierarchicalStore          │
└─────────────────────────────┘
       │
       ├──── Chunk Found ────► Return Content
       │
       ▼ (Chunk Not Found)
┌─────────────────────────────┐
│  recoverFromQdrant()        │
│  1. Get point from Qdrant   │
│  2. Extract content from    │
│     payload                 │
│  3. Create HierarchicalChunk│
│  4. Add to HierarchicalStore│
└─────────────────────────────┘
       │
       ├──── Recovery Success ───► Return Recovered Content
       │
       ▼ (Recovery Failed)
   Skip Result + Log Warning
```

### Limitations

- **Content truncation**: Content exceeding `MAX_PAYLOAD_CONTENT_SIZE` is truncated
- **No embedding recovery**: Embeddings remain in Qdrant; recovered chunks have empty embeddings
- **Quality score default**: Recovered chunks use default quality score (0.5)
- **Full recovery**: Requires document reprocessing for complete data restoration

## References

- [Qdrant Documentation](https://qdrant.tech/documentation/)
- [bge-m3 Paper](https://arxiv.org/abs/2402.03216)
- [RRF Paper](https://plg.uwaterloo.ca/~gvcormac/cormacksigir09-rrf.pdf)