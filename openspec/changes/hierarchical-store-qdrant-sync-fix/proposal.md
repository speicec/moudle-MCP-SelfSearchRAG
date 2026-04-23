## Why

检索系统在 Hybrid 模式下返回空结果，尽管 Qdrant 存储了向量数据。根本原因是 `HierarchicalStore`（内存元数据存储）与 `Qdrant`（向量数据库）数据不一致。当服务器重启或文档处理中断时，`HierarchicalStore` 可能没有劳动法等新文档的 chunk 元数据，而 `Qdrant` 却有对应的向量，导致 `HybridRetriever.expandToParents()` 无法找到 parent chunk 内容。

**典型症状：**
- `[HybridRetriever] Got 9 parent results` → `[SmallToBigRetriever] Hybrid retrieval results: 0`
- `hierarchicalStore.getChunk(parentId)` 返回 `null`
- 检索相关度仅 2%，最终结果为空

## What Changes

1. **启动时同步检查** - 服务启动时验证 HierarchicalStore 与 Qdrant 数据一致性
2. **自动恢复机制** - 从 Qdrant payload 重建缺失的 HierarchicalStore 元数据
3. **持久化增强** - 确保文档处理完成后同时持久化到两个存储系统
4. **健康检查 API** - 新增 `/api/health/storage` 端点检查存储状态

## Capabilities

### New Capabilities

- `storage-sync`: 启动时同步检查与自动恢复机制，确保 HierarchicalStore 和 Qdrant 数据一致

### Modified Capabilities

- `hybrid-retrieval`: 修改检索流程，增加 fallback 机制：当 `HierarchicalStore.getChunk()` 返回 null 时，尝试从 Qdrant payload 恢复元数据
- `qdrant-vector-store`: 增强 payload 存储，确保包含足够信息用于元数据重建（完整 content 字段）

## Impact

- **代码文件**:
  - `src/server/http-server.ts` - 启动时同步检查
  - `src/retrieval/hybrid-small-to-big-retriever.ts` - fallback 恢复逻辑
  - `src/retrieval/qdrant-client.ts` - payload 增强
  - `src/server/routes/stats.ts` - 新增健康检查 API
- **API**: 新增 `GET /api/health/storage` 端点
- **数据持久化**: `HierarchicalStore` 持久化文件格式可能需要升级