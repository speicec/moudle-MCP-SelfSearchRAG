## Why

质量评级系统显示 "D - 仅供参考" + "关键词匹配"，无法正确进行 GRADE 评估。根本原因是 **VectorPayload 缺少文档级元数据字段**，导致：

1. 文档解析时提取的 `documentYear`、`documentTitle`、`guidelineSource` 未存储到 Qdrant
2. 从 Qdrant 恢复 chunk 时无法获取这些元数据
3. Agent 无法基于年份/标题进行准确的文献类型识别和时效权重计算
4. GRADE 评估默认返回最低等级 D

这导致整个增强证据评估系统无法正常工作，前端只能使用 similarityScore 兜底显示。

## What Changes

- 扩展 `VectorPayload` 接口，添加文档级元数据字段
- 修改 `document-processor.ts`，将 chunk.metadata 中的文档级字段写入 Qdrant payload
- 修改 `hybrid-small-to-big-retriever.ts` 的 `recoverFromQdrant` 方法，恢复这些字段到 ChunkMetadata
- 更新 `qdrant-vector-store` spec，明确 payload 字段定义

## Capabilities

### New Capabilities

- `payload-metadata-recovery`: 从 Qdrant payload 恢复完整的文档级元数据到 ChunkMetadata，支持 GRADE 评估所需的年份、标题、来源等信息

### Modified Capabilities

- `qdrant-vector-store`: 扩展 payload 字段定义，添加 documentYear、documentTitle、documentAuthor、guidelineSource 字段
- `enhanced-evidence-evaluation`: 添加前置条件说明，要求检索结果必须包含 documentYear/documentTitle 才能进行准确评估

## Impact

**受影响的文件**:

| 文件 | 修改内容 |
|------|----------|
| `src/retrieval/vector-store-adapter.ts` | VectorPayload 接口添加 4 个新字段 |
| `src/server/document-processor.ts` | storeVectorsInQdrant 函数添加 payload 字段写入 |
| `src/retrieval/hybrid-small-to-big-retriever.ts` | recoverFromQdrant 恢复新字段到 metadata |
| `openspec/specs/qdrant-vector-store/spec.md` | Payload 字段表格添加新字段 |

**受影响的 API**:

- `VectorPayload` 接口：新增可选字段，向后兼容
- Qdrant payload：新增字段存储，需要重新索引已有文档才能生效

**依赖系统**:

- GRADE 证据评估系统：依赖这些字段进行准确评估
- 前端 EvidencePanel：依赖这些字段显示质量评级

**数据迁移**:

- 已索引的文档缺少新字段，需要重新上传才能获得完整元数据
- 系统对缺失字段有兜底处理（documentYear=undefined → timeWeight=0.7）