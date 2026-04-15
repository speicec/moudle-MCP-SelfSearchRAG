## Context

当前系统已有完整的质量评估实现（`ChunkQualityFilter` 类），包含：
- 四个质量维度的计算方法：`informationDensity`, `repetitionRatio`, `semanticCompleteness`, `documentRelevance`
- 复合分数计算：`calculateCompositeScore()`
- 文档 embedding 设置：`setDocumentEmbedding()`

但 `document-processor.ts` 的 `storeInHierarchical()` 函数绕过了这些评估逻辑，直接使用 `createDefaultQualityScore()` 硬编码 0.5。

```
当前流程（问题）：
─────────────────
document → parse → embed → index
                              │
                              ▼
                    storeInHierarchical()
                              │
                              ▼
              createDefaultQualityScore() ← 硬编码 0.5
                              │
                              ▼
                    store.addChunk(chunk)

期望流程（修复后）：
─────────────────
document → parse → embed → index
                              │
                              ▼
                    storeInHierarchical()
                              │
                              ▼
              aggregateEmbeddings(chunkEmbeddings)
                              │
                              ▼
              qualityFilter.setDocumentEmbedding(docId, docEmb)
                              │
                              ▼
              qualityFilter.evaluate(chunk) ← 真实评估
                              │
                              ▼
                    store.addChunk(chunk)
```

## Goals / Non-Goals

**Goals:**
- 集成 `ChunkQualityFilter` 到文档处理流程
- 计算文档整体 embedding 作为 `documentRelevance` 维度的参照
- 使前端质量分布图表显示真实数据
- 保持现有 API 兼容性（`qualityScore` 字段已存在）

**Non-Goals:**
- 不修改质量评估算法本身（四个维度计算方法不变）
- 不改变 chunk 存储结构（只改变 `qualityScore` 的值）
- 不修改前端组件（前端已支持真实质量分数显示）
- 不改变质量过滤的默认配置（threshold=0.3, mode=flag）

## Decisions

### Decision 1: 文档 embedding 计算时机

**问题**: 文档 embedding 需要在 chunk embedding 生成后才能聚合计算。

**选项**:
- A) 在 `storeInHierarchical()` 中先收集所有 chunk embeddings，聚合后设置
- B) 在 `EmbeddingStage` 完成后单独计算并传递
- C) 使用第一个 chunk embedding 作为文档代表（近似）

**选择**: **A** - 在 `storeInHierarchical()` 中聚合

**理由**:
- 最简单，不需要修改其他 stage
- 所有 embeddings 已经在同一函数内可用
- 使用 `aggregateEmbeddings()` 函数（已存在于 `utils.ts`）

### Decision 2: ChunkQualityFilter 实例化位置

**问题**: `ChunkQualityFilter` 应该在哪里创建和持有？

**选项**:
- A) 在 `storeInHierarchical()` 中每次创建新实例
- B) 在 `Fastify` 实例中作为全局服务持有
- C) 在 `HierarchicalStore` 中集成

**选择**: **A** - 函数内创建临时实例

**理由**:
- 当前文档处理是隔离的，每个文档独立评估
- 不需要跨文档共享状态
- 避免引入新的服务生命周期管理复杂性
- 未来可轻松迁移到 B 或 C 如果需要

### Decision 3: documentRelevance 默认值处理

**问题**: 如果文档 embedding 计算失败，`documentRelevance` 应该返回什么？

**选项**:
- A) 返回 0.5（当前行为，表示"未知"）
- B) 返回 0.0（表示"无法评估"）
- C) 基于其他三个维度加权重新计算 composite

**选择**: **A** - 保持 0.5 默认值

**理由**:
- 保持向后兼容
- 0.5 表示"中性"，不影响 composite 过多（权重 0.30）
- 其他三个维度仍可提供有效评估

## Risks / Trade-offs

### Risk 1: 文档 embedding 聚合性能
**影响**: 大文档（1000+ chunks）聚合 embedding 可能增加处理时间
**缓解**: `aggregateEmbeddings()` 使用平均计算，O(n) 复杂度，影响有限

### Risk 2: 内存使用
**影响**: 需要先收集所有 embeddings 再聚合，短暂内存峰值
**缓解**: Embeddings 已在内存中，只是额外一次遍历，无额外分配

### Risk 3: 质量分布变化
**影响**: 修复后质量分数不再是 0.5，可能大量 chunk 被标记为 low quality
**缓解**: 默认 threshold=0.3 较低，大多数正常内容应能通过；可在前端观察分布后调整

### Trade-off: 简单性 vs 可扩展性
选择在函数内创建临时实例，牺牲了跨文档状态共享能力，换取实现简单性。如果未来需要（如跨文档质量分析），需要重构为全局服务。

## Migration Plan

1. **修改 `document-processor.ts`**:
   - 导入 `ChunkQualityFilter` 和 `aggregateEmbeddings`
   - 在 `storeInHierarchical()` 中：
     - 创建 `ChunkQualityFilter` 实例
     - 聚合 embeddings → 设置文档 embedding
     - 替换 `createDefaultQualityScore()` 为 `qualityFilter.evaluate()`

2. **测试验证**:
   - 上传文档，检查 chunk 质量分数不再是全 0.5
   - 检查前端质量分布图表显示真实分布
   - 验证 API 返回的 `qualityScore` 字段

3. **回滚策略**:
   - 如果有问题，恢复 `createDefaultQualityScore()` 调用即可
   - 无数据迁移，纯代码回滚

## Open Questions

- 是否需要添加配置选项控制质量评估是否启用？（当前假设始终启用）
- 是否需要添加日志输出质量评估结果以便调试？