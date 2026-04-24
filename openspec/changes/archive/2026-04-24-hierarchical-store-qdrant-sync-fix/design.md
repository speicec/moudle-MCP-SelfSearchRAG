## Context

### 当前状态

系统使用双存储架构：
- **HierarchicalStore** (`src/chunking/hierarchical-store.ts`): 内存存储 chunk 元数据（content, parentId, qualityScore 等），支持持久化到 `data/store/hierarchical-store.json`
- **Qdrant** (`src/retrieval/qdrant-client.ts`): 向量数据库，存储 dense/sparse vectors 和 payload

### 数据流

```
文档处理流程:

┌────────────────┐    ┌────────────────────┐    ┌────────────────────┐
│  Pipeline      │───▶│  HierarchicalStore │───▶│  Qdrant            │
│  (处理文档)     │    │  (存元数据 + parentId)│    │  (存 vectors)      │
└────────────────┘    └────────────────────┘    └────────────────────┘

检索流程:

┌────────────────┐    ┌────────────────────┐    ┌────────────────────┐
│  Qdrant        │───▶│  HybridRetriever   │───▶│  HierarchicalStore │
│  (返回 parentId)│    │  (expandToParents) │    │  (getChunk 内容)   │
│                │    │                    │    │  ❌ 可能返回 null   │
└────────────────┘    └────────────────────┘    └────────────────────┘
```

### 问题根源

当以下情况发生时，两个存储数据不一致：
1. **服务器重启** - HierarchicalStore 从磁盘加载失败，或持久化文件不存在/损坏
2. **处理中断** - 文档只存入 Qdrant，未存入 HierarchicalStore
3. **持久化路径不一致** - Qdrant 数据独立持久化，HierarchicalStore 可能丢失

### Stakeholders

- `http-server.ts` - 初始化和启动流程
- `document-processor.ts` - 文档处理和存储
- `hybrid-small-to-big-retriever.ts` - 检索和 parent expansion
- `qdrant-client.ts` - 向量存储

## Goals / Non-Goals

**Goals:**
1. 启动时自动检测和修复数据不一致
2. 检索时具备 fallback 机制，从 Qdrant payload 恢复缺失元数据
3. 提供健康检查 API 监控存储状态
4. 增强 Qdrant payload，存储足够信息用于元数据重建

**Non-Goals:**
- 不改变现有检索算法或相似度计算
- 不修改文档处理 Pipeline 的核心逻辑
- 不解决 Qdrant 本身的性能问题

## Decisions

### Decision 1: 启动时同步策略

**选择**: 从 Qdrant 重建 HierarchicalStore 缺失数据

**备选方案**:
| 方案 | 优点 | 缺点 |
|------|------|------|
| A. 从 Qdrant 重建 | 数据最新，无需额外存储 | 需要完整 payload |
| B. 强制同步持久化 | 数据一致性强 | 性能影响，复杂度高 |
| C. 双写确认机制 | 防止写入失败 | 增加写入延迟 |

**理由**: 方案 A 最简单，且 Qdrant payload 已经包含大部分元数据，只需补充 `content` 字段。

### Decision 2: Payload 增强策略

**选择**: 在 Qdrant payload 中存储 `content` 字段（可选）

**备选方案**:
| 方案 | 存储成本 | 恢复能力 |
|------|----------|----------|
| A. 存储完整 content | 较高（每 chunk） | 完全恢复 |
| B. 存储 content hash | 低 | 需要外部内容源 |
| C. 不存储 content | 无 | 仅恢复元数据，无内容 |

**理由**: 选择方案 A，因为：
- Content 是检索的核心，无法恢复则检索失败
- 存储成本可控（文本 chunk 通常 < 1KB）
- 可通过配置开关控制是否存储

### Decision 3: Fallback 时机

**选择**: 在 `expandToParents()` 中实时 fallback

**实现逻辑**:
```typescript
// hybrid-small-to-big-retriever.ts
const parentChunk = this.hierarchicalStore.getChunk(parentId);
if (!parentChunk) {
  // Fallback: 从 Qdrant payload 恢复
  const recoveredChunk = await this.recoverFromQdrant(parentId);
  if (recoveredChunk) {
    this.hierarchicalStore.addChunk(recoveredChunk); // 临时添加
    return recoveredChunk;
  }
}
```

### Decision 4: 健康检查 API

**选择**: 新增 `/api/health/storage` 端点

**返回结构**:
```json
{
  "hierarchicalStore": {
    "smallChunks": 150,
    "parentChunks": 30,
    "persisted": true
  },
  "qdrant": {
    "textChunks": 150,
    "parentChunks": 30,
    "healthy": true
  },
  "syncStatus": {
    "consistent": true,
    "missingInStore": [],
    "missingInQdrant": []
  }
}
```

## Risks / Trade-offs

### Risk 1: Content 存储增加 payload 大小
→ **Mitigation**: 使用配置开关 `STORE_CONTENT_IN_PAYLOAD=false` 可禁用

### Risk 2: 启动时同步可能耗时
→ **Mitigation**: 异步执行，不阻塞服务启动；增量同步仅处理差异

### Risk 3: Fallback 恢复可能不完整
→ **Mitigation**: 记录警告日志，健康检查 API 显示不一致状态

### Risk 4: 双写可能导致竞态条件
→ **Mitigation**: 使用事务性写入顺序：先 HierarchicalStore，后 Qdrant

## Migration Plan

1. **Phase 1**: 增强 payload 存储（向后兼容）
   - 添加 `content` 字段到 VectorPayload（可选）
   - 修改 `storeVectorsInQdrant()` 包含 content

2. **Phase 2**: 实现同步检查
   - 添加 `syncStores()` 函数到 `http-server.ts`
   - 启动时执行增量同步

3. **Phase 3**: 实现 fallback 机制
   - 修改 `HybridSmallToBigRetriever.expandToParents()`

4. **Phase 4**: 添加健康检查 API
   - 新增 `/api/health/storage` 端点

**Rollback**: 各阶段独立，可单独禁用功能开关

## Open Questions

1. `content` 字段存储是否需要加密或压缩？（建议：先不加密，后续可加）
2. 启动时同步是否需要用户确认？（建议：自动执行，日志记录）
3. 是否需要定期同步检查？（建议：仅在启动时，后续可通过 API 手动触发）