# Qdrant Vector Store Specification (Modified)

## Overview

集成 Qdrant 向量数据库，替代内存向量存储，实现高效 HNSW 索引检索。此 delta spec 增强 payload 存储以支持元数据重建。

## MODIFIED Requirements

### Requirement: Payload includes content field for metadata recovery

Qdrant payload SHALL 可选包含 content 字段，用于元数据恢复。

**原内容（qdrant-vector-store/spec.md Payload 字段）**:
```
- Payload 字段:
  - documentId (string)
  - chunkId (string)
  - parentId (string, optional)
  - level ("small" | "parent")
  - qualityScore (float)
  - pageNumber (integer, optional)
  - contentType (string)
  - position (object: {start, end})
```

**修改后**:
```
- Payload 字段:
  - documentId (string)
  - chunkId (string)
  - parentId (string, optional)
  - level ("small" | "parent")
  - qualityScore (float)
  - pageNumber (integer, optional)
  - contentType (string)
  - position (object: {start, end})
  - content (string, optional) ← 新增：用于元数据恢复
```

#### Scenario: Content stored in payload (enabled)
- **WHEN** STORE_CONTENT_IN_PAYLOAD environment variable is set to true
- **THEN** vector payload includes complete chunk content string

#### Scenario: Content stored in payload (disabled)
- **WHEN** STORE_CONTENT_IN_PAYLOAD is false or not set
- **THEN** vector payload excludes content field

#### Scenario: Content field size limit
- **WHEN** chunk content exceeds 10KB
- **THEN** content is truncated to 10KB with truncation marker

### Requirement: VectorPayload interface updated

VectorPayload interface SHALL include optional content field.

#### Scenario: VectorPayload with content
- **WHEN** creating VectorPoint with content
- **THEN** payload.content contains the full text

#### Scenario: VectorPayload without content
- **WHEN** creating VectorPoint without content
- **THEN** payload.content is undefined

## ADDED Requirements

### Requirement: Get point with full payload

系统 SHALL 支持从 Qdrant 检索完整 payload 用于恢复。

#### Scenario: Retrieve point by ID
- **WHEN** system calls getPoint(collection, id) with with_payload=true
- **THEN** returns VectorPoint with complete payload including content (if stored)

#### Scenario: Retrieve multiple points for batch recovery
- **WHEN** system calls retrievePoints(collection, ids) for multiple IDs
- **THEN** returns array of VectorPoints with full payloads