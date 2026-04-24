# Storage Sync Specification

## Overview

确保 HierarchicalStore（内存元数据）和 Qdrant（向量数据库）数据一致性，提供启动时同步检查与自动恢复机制。

## ADDED Requirements

### Requirement: Startup synchronization check

系统启动时 SHALL 自动验证 HierarchicalStore 与 Qdrant 数据一致性。

#### Scenario: Consistent data on startup
- **WHEN** server starts with both stores having matching chunk counts
- **THEN** sync check passes and no recovery is needed

#### Scenario: Missing chunks in HierarchicalStore
- **WHEN** Qdrant has chunks that HierarchicalStore does not have
- **THEN** system automatically recovers metadata from Qdrant payload

#### Scenario: Missing vectors in Qdrant
- **WHEN** HierarchicalStore has chunks that Qdrant does not have
- **THEN** system logs warning and reports inconsistency via health API

### Requirement: Automatic metadata recovery from Qdrant

系统 SHALL 能够从 Qdrant payload 恢复缺失的 HierarchicalStore 元数据。

#### Scenario: Recover parent chunk metadata
- **WHEN** HierarchicalStore.getChunk(parentId) returns null during retrieval
- **THEN** system fetches chunk metadata from Qdrant and populates HierarchicalStore

#### Scenario: Recover small chunk metadata
- **WHEN** small chunk metadata is missing in HierarchicalStore
- **THEN** system recovers from text_chunks collection payload

### Requirement: Health check API for storage status

系统 SHALL 提供 `/api/health/storage` 端点监控存储状态。

#### Scenario: Check storage health
- **WHEN** client requests GET /api/health/storage
- **THEN** system returns sync status with chunk counts for both stores

#### Scenario: Inconsistent storage detected
- **WHEN** health check reveals missing chunks
- **THEN** response includes `missingInStore` and `missingInQdrant` arrays

### Requirement: Enhanced Qdrant payload with content field

系统 SHALL 在 Qdrant payload 中存储 content 字段（可选）用于元数据重建。

#### Scenario: Store content in payload (enabled)
- **WHEN** STORE_CONTENT_IN_PAYLOAD=true
- **THEN** vector payload includes full chunk content

#### Scenario: Store content in payload (disabled)
- **WHEN** STORE_CONTENT_IN_PAYLOAD=false or not set
- **THEN** vector payload excludes content field (metadata recovery limited)