# Qdrant Vector Store Integration

## Overview

集成 Qdrant 向量数据库，替代内存向量存储，实现高效 HNSW 索引检索。

## Requirements

### Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-001 | 支持 HNSW 索引向量搜索 | MUST |
| FR-002 | 支持 Cosine 相似度计算 | MUST |
| FR-003 | 支持元数据过滤（documentId, qualityScore, pageNumber） | MUST |
| FR-004 | 支持批量向量写入 | MUST |
| FR-005 | 支持按文档 ID 批量删除向量 | MUST |
| FR-006 | 支持阈值过滤 | SHOULD |
| FR-007 | 支持 Collection 管理 | MUST |
| FR-008 | 支持连接健康检查 | SHOULD |
| FR-009 | 支持优雅关闭 | SHOULD |

### Non-Functional Requirements

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-001 | 检索延迟 | < 10ms (100K 向量) |
| NFR-002 | 写入吞吐 | > 1000 向量/秒 |
| NFR-003 | 内存占用 | 支持磁盘存储 |
| NFR-004 | 可用性 | Docker 单容器启动 |

## Interface Specification

```typescript
interface VectorStoreAdapter {
  // 生命周期
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  isReady(): boolean;
  
  // Collection
  createCollection(name: string, config: CollectionConfig): Promise<void>;
  deleteCollection(name: string): Promise<void>;
  collectionExists(name: string): Promise<boolean>;
  
  // CRUD
  upsert(collection: string, points: VectorPoint[]): Promise<void>;
  delete(collection: string, ids: string[]): Promise<void>;
  deleteByFilter(collection: string, filter: MetadataFilter): Promise<number>;
  
  // Search
  search(collection: string, query: SearchQuery): Promise<SearchResult[]>;
  
  // Stats
  getStats(collection: string): Promise<CollectionStats>;
}
```

## Collection Specification

### text_chunks
- **向量维度**: 1024
- **距离度量**: Cosine
- **HNSW 配置**: m=16, efConstruct=100
- **Payload 字段**:
  - documentId (string)
  - chunkId (string)
  - parentId (string, optional)
  - level ("small" | "parent")
  - qualityScore (float)
  - pageNumber (integer, optional)
  - contentType (string)
  - position (object: {start, end})
  - content (string, optional) ← 用于元数据恢复

### Content Field Behavior

| Setting | Behavior |
|---------|----------|
| `STORE_CONTENT_IN_PAYLOAD=false` | Content NOT stored in payload (default) |
| `STORE_CONTENT_IN_PAYLOAD=true` | Content stored in payload for recovery |

#### Scenario: Content stored in payload (enabled)
- **WHEN** STORE_CONTENT_IN_PAYLOAD environment variable is set to true
- **THEN** vector payload includes complete chunk content string

#### Scenario: Content stored in payload (disabled)
- **WHEN** STORE_CONTENT_IN_PAYLOAD is false or not set
- **THEN** vector payload excludes content field

#### Scenario: Content field size limit
- **WHEN** chunk content exceeds 10KB
- **THEN** content is truncated to 10KB with truncation marker

### Get Point with Full Payload

系统 SHALL 支持从 Qdrant 检索完整 payload 用于恢复。

#### Scenario: Retrieve point by ID
- **WHEN** system calls getPoint(collection, id) with with_payload=true
- **THEN** returns VectorPoint with complete payload including content (if stored)

#### Scenario: Retrieve multiple points for batch recovery
- **WHEN** system calls retrievePoints(collection, ids) for multiple IDs
- **THEN** returns array of VectorPoints with full payloads

### image_chunks
- **向量维度**: 512
- **距离度量**: Cosine
- **HNSW 配置**: m=12, efConstruct=80
- **Payload 字段**:
  - documentId (string)
  - imageId (string)
  - blockType ("figure" | "table" | "formula")
  - pageNumber (integer)
  - vlmText (string)

## HNSW Parameter Tuning

### Parameter Overview

| Parameter | Meaning | Impact |
|-----------|---------|--------|
| M | 每个节点的最大连接数 | 影响索引大小和召回率 |
| efConstruct | 构建时的搜索宽度 | 影响构建质量和时间 |
| ef | 查询时的搜索宽度 | 影响查询召回率和延迟 |

### Recommended Configuration

**text_chunks (1024维, 预估 ~100K 向量)**
```
M = 16
efConstruct = 100
ef (查询时) = 50-100 (动态调整)
```

**image_chunks (512维, 预估 ~10K 向量)**
```
M = 12
efConstruct = 80
ef (查询时) = 40-80
```

### Tuning Trade-offs

| M 值 | 召回率 | 内存占用 | 构建时间 |
|------|--------|----------|----------|
| 8 | 低 | 低 | 快 |
| 16 | 中高 ✓ | 中 | 中 |
| 32 | 高 | 高 | 慢 |

| efConstruct | 构建质量 | 构建时间 |
|-------------|----------|----------|
| 50 | 一般 | 快 |
| 100 | 好 ✓ | 中 |
| 200 | 最佳 | 慢 |

### Query ef Adjustment

```typescript
// ef 查询参数可以动态调整
// 更大的 ef = 更高召回率，但更慢
const searchParams = {
  vector: queryVector,
  limit: 20,
  ef: 100,  // 搜索宽度
};
```

## Qdrant Filter Syntax

### Filter Structure

```typescript
interface Filter {
  must?: Condition[];      // AND - 所有条件必须满足
  should?: Condition[];    // OR - 至少一个条件满足
  must_not?: Condition[];  // NOT - 所有条件必须不满足
}
```

### Condition Types

**精确匹配 (match)**
```typescript
{
  key: 'documentId',
  match: { value: 'doc-123' }
}
```

**多值匹配 (match.any) - IN 语义**
```typescript
{
  key: 'pageNumber',
  match: { any: [1, 5, 10] }  // pageNumber IN [1, 5, 10]
}
```

**范围过滤 (range)**
```typescript
{
  key: 'qualityScore',
  range: {
    gte: 0.6,  // >= 0.6
    lte: 1.0,  // <= 1.0
  }
}
```

### TypeScript FilterBuilder Implementation

```typescript
// src/retrieval/qdrant-filter-builder.ts
import { Filter, Condition } from '@qdrant/js-client-rest';

export interface MetadataFilter {
  documentId?: string;
  minQuality?: number;
  maxQuality?: number;
  pageNumbers?: number[];
  level?: 'small' | 'parent';
  contentTypes?: string[];
}

export class QdrantFilterBuilder {
  build(filter: MetadataFilter): Filter | undefined {
    const conditions: Condition[] = [];

    // 文档 ID 精确匹配
    if (filter.documentId) {
      conditions.push({
        key: 'documentId',
        match: { value: filter.documentId }
      });
    }

    // 质量分数范围过滤
    if (filter.minQuality !== undefined || filter.maxQuality !== undefined) {
      conditions.push({
        key: 'qualityScore',
        range: {
          gte: filter.minQuality ?? 0,
          lte: filter.maxQuality ?? 1,
        }
      });
    }

    // 页码多值匹配 (IN 语义)
    if (filter.pageNumbers?.length) {
      conditions.push({
        key: 'pageNumber',
        match: { any: filter.pageNumbers }
      });
    }

    // 层级匹配
    if (filter.level) {
      conditions.push({
        key: 'level',
        match: { value: filter.level }
      });
    }

    // 内容类型多值匹配
    if (filter.contentTypes?.length) {
      conditions.push({
        key: 'contentType',
        match: { any: filter.contentTypes }
      });
    }

    if (conditions.length === 0) return undefined;

    return { must: conditions };  // AND 语义
  }

  // 按文档 ID 批量删除的过滤
  buildDeleteFilter(documentId: string): Filter {
    return {
      must: [
        { key: 'documentId', match: { value: documentId } }
      ]
    };
  }
}
```

### Filter Examples

**过滤低质量 + 指定文档**
```typescript
const filter = {
  must: [
    { key: 'documentId', match: { value: 'doc-abc' } },
    { key: 'qualityScore', range: { gte: 0.6 } },
  ]
};
```

**多文档 OR 搜索**
```typescript
const filter = {
  should: [
    { key: 'documentId', match: { value: 'doc-1' } },
    { key: 'documentId', match: { value: 'doc-2' } },
  ]
};
```

**排除特定页码**
```typescript
const filter = {
  must_not: [
    { key: 'pageNumber', match: { any: [1, 2] } }
  ]
};
```

## Error Handling

| Error Code | Description | Handling |
|------------|-------------|----------|
| QDRANT_CONNECTION | 无法连接 Qdrant | Fallback to in-memory |
| QDRANT_TIMEOUT | 操作超时 | Retry with exponential backoff |
| COLLECTION_EXISTS | Collection 已存在 | Skip creation |
| POINT_NOT_FOUND | 向量不存在 | Return empty result |

## Configuration

```typescript
interface QdrantConfig {
  url: string;              // http://localhost:6333
  apiKey?: string;          // optional
  timeoutMs: number;        // 10000
  collections: {
    text: string;
    image: string;
  };
  hnsw: {
    textM: number;
    textEfConstruct: number;
    imageM: number;
    imageEfConstruct: number;
  };
}
```

## Testing Criteria

- 单元测试覆盖: > 80%
- 搜索性能测试: 100K 向量 < 10ms
- 元数据过滤测试: 所有 filter 类型
- 连接恢复测试: 重连后恢复正常