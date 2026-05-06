## Context

**当前状态**:

数据流路径：`PDF 解析 → ParsedMetadata → ChunkMetadata → Qdrant Payload → 检索结果 → GRADE 评估`

问题发生在两个关键位置：

1. **存储时丢失**: `document-processor.ts:storeVectorsInQdrant` 构建 payload 时未写入 `documentYear`、`documentTitle`、`guidelineSource`
2. **恢复时丢失**: `hybrid-small-to-big-retriever.ts:recoverFromQdrant` 从 Qdrant payload 恢复 chunk 时无法获取这些字段

**约束**:

- Qdrant payload 存储需要考虑存储成本（每个字段增加 payload 大小）
- 已索引的文档缺少新字段，系统需要向后兼容处理
- VectorPayload 接口变更需要保持向后兼容

**利益相关者**:

- GRADE 评估系统：依赖这些字段进行准确评估
- 前端 EvidencePanel：依赖这些字段显示质量评级
- 检索系统：需要正确传递 metadata

## Goals / Non-Goals

**Goals**:

- 扩展 VectorPayload 接口，添加文档级元数据字段
- 确保新字段从 ChunkMetadata 正确写入 Qdrant payload
- 确保从 Qdrant 恢复时能正确还原这些字段
- 保持向后兼容（缺失字段时使用兜底值）

**Non-Goals**:

- 不实现数据迁移（已索引文档需要重新上传）
- 不修改 PDF 解析逻辑（已能正确提取元数据）
- 不修改前端显示逻辑（已有兜底机制）

## Decisions

### Decision 1: VectorPayload 字段类型选择

**选项对比**:

| 方案 | documentYear | documentTitle | guidelineSource |
|------|--------------|---------------|-----------------|
| A: 可选字段 | `number \| undefined` | `string \| undefined` | `string \| undefined` |
| B: 必填字段 + 默认值 | `number` (默认 0) | `string` (默认 '') | `string` (默认 '') |

**选择**: 方案 A（可选字段）

**理由**:
- 向后兼容：已索引文档无这些字段，可选字段不会导致类型错误
- 符合业务逻辑：年份/标题/来源可能确实不存在（如无元数据的 PDF）
- 兜底机制已存在：GRADE 评估对 undefined 有处理（timeWeight=0.7）

### Decision 2: 字段存储位置

**选项对比**:

| 方案 | 存储位置 | 影响 |
|------|----------|------|
| A: 仅 small chunks payload | 只在小块存储 | 恢复小块时可用 |
| B: 仅 parent chunks payload | 只在父块存储 | 恢复父块时可用 |
| C: 两者都存储 | small + parent 都存储 | 所有恢复场景可用 |

**选择**: 方案 C（两者都存储）

**理由**:
- 父块恢复时也需要这些字段（用于文献类型识别）
- small chunk 可能单独匹配（不总是扩展到 parent）
- 存储成本可控：每个字段最多 4 个额外属性

### Decision 3: 恢复逻辑优先级

**恢复时 metadata 构建**:

```
metadata.documentYear = payload.documentYear ?? (从 HierarchicalStore 获取)
metadata.documentTitle = payload.documentTitle ?? sourceDocumentId (兜底)
```

**理由**:
- payload 优先：最新数据可能在 payload
- HierarchicalStore 作为备用：如果 payload 无数据但有缓存
- sourceDocumentId 作为兜底：保证总有显示名称

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| 已索引文档缺少新字段 | 兜底机制处理 undefined；重新上传文档可获取完整数据 |
| Payload 大小增加 | 字段为可选，仅在存在时存储；字符串字段有长度限制 |
| 类型变更导致编译错误 | 所有新字段为可选，不破坏现有代码 |
| 恢复逻辑遗漏字段 | 在 recoverFromQdrant 中明确列出所有新字段 |

## Migration Plan

**部署步骤**:

1. 部署代码变更（类型定义 + 存储逻辑 + 恢复逻辑）
2. 新上传的文档自动获得完整元数据
3. 已有文档保持原状态，GRADE 评估使用兜底值

**无需数据迁移**:

- 系统对缺失字段已有兜底处理
- 用户可选择重新上传关键文档以获取完整评级

**回滚策略**:

- 代码回滚后，新字段不再写入 payload
- 已写入的字段不会导致错误（可选字段）
- 系统回退到 similarityScore 兜底模式