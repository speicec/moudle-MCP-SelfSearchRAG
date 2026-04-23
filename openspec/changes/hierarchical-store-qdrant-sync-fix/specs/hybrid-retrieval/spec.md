# Hybrid Retrieval Specification (Modified)

## Overview

实现 Dense + Sparse 双轨检索，提升语义搜索与关键词匹配的综合召回质量。此 delta spec 添加 fallback 恢复机制。

## MODIFIED Requirements

### Requirement: Parent Expansion with Fallback Recovery

系统 SHALL 在 Parent Expansion 时具备 fallback 恢复机制，当 HierarchicalStore 缺失数据时从 Qdrant payload 恢复。

**原内容（hybrid-retrieval/spec.md）**:
```
Phase 1: Small Chunk Hybrid Search
...
└─→ RRF Fusion → fusedSmallChunkIds[]
      │
      └─→ 按 parentId 分组 → Parent Expansion
            │
            └─→ HierarchicalStore.getParents(parentIds)
                  → Parent Content
```

**修改后**:
```
Phase 1: Small Chunk Hybrid Search
...
└─→ RRF Fusion → fusedSmallChunkIds[]
      │
      └─→ 按 parentId 分组 → Parent Expansion
            │
            ├─→ HierarchicalStore.getParents(parentIds)
            │     → Parent Content (成功时)
            │
            └─→ [Fallback] 如果 getChunk() 返回 null:
                  │
                  └─→ Qdrant.getPoint(parentId)
                        │
                        └─→ 从 payload 恢复 metadata
                              │
                              └─→ 临时添加到 HierarchicalStore
                                    │
                                    └─→ 返回 Parent Content
```

#### Scenario: Parent expansion successful
- **WHEN** HierarchicalStore contains the parent chunk
- **THEN** system returns parent content directly

#### Scenario: Parent expansion fallback triggered
- **WHEN** HierarchicalStore.getChunk(parentId) returns null
- **THEN** system fetches metadata from Qdrant parent_chunks collection
- **AND** recovers parent chunk content if STORE_CONTENT_IN_PAYLOAD=true
- **AND** temporarily adds recovered chunk to HierarchicalStore for this request

#### Scenario: Fallback recovery incomplete
- **WHEN** Qdrant payload lacks content field
- **THEN** system logs warning and returns partial metadata
- **AND** marks result as incomplete in search result

### Requirement: Search result metadata includes recovery status

检索结果 SHALL 标记数据来源和恢复状态。

#### Scenario: Normal retrieval result
- **WHEN** data comes from HierarchicalStore directly
- **THEN** result.metadata.recoveredFrom is undefined

#### Scenario: Recovered retrieval result
- **WHEN** data was recovered from Qdrant payload
- **THEN** result.metadata.recoveredFrom = "qdrant_payload"

#### Scenario: Incomplete recovery result
- **WHEN** recovery could not restore content field
- **THEN** result.metadata.recoveryStatus = "partial"