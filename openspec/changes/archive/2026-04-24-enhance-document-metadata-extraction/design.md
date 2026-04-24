## Context

当前系统的 PDF 处理流程使用 pdf-parse 库解析文档，但该库返回的 `data.info` 元数据（Title、Author、CreationDate 等）被丢弃。元数据在入库阶段就已缺失，导致整个数据处理链下游（chunk 存储、检索、答案生成）都无法获取完整的文档信息。

**数据流转现状**：
```
PDF → pdf-parse → text-extractor (丢弃 data.info) 
    → parse-stage (metadata: undefined)
    → chunking (无元数据)
    → chat.ts (sourceDocumentId → documentName)
```

**关键约束**：
- 不能破坏现有 chunk 数据结构向后兼容性
- pdf-parse 库的 info 字段格式不可控（依赖 PDF 作者是否填写）
- 年份信息通常不在 PDF 元数据中，需要从标题或文件名推断

## Goals / Non-Goals

**Goals:**
- 从 PDF 提取并保留完整元数据，传递到 chunk 层级
- SourceCitation 显示人类可读标题，而非文件名
- 智能推断年份（从标题、文件名、CreationDate）
- 识别医疗指南来源（ADA、KDIGO、ESC、CDS）

**Non-Goals:**
- 不修复置信评估 vs 相关度分析的分数差异问题（这是评估机制差异，非 Bug）
- 不重新设计 chunk 存储架构
- 不改变现有 API 接口签名

## Decisions

### Decision 1: 元数据存储位置

**选择**: 在 ChunkMetadata 中添加文档级元数据字段

**理由**:
- Chunk 是检索的基本单元，元数据需要随检索结果返回
- 避免额外的元数据查询（性能考虑）
- 保持向后兼容：所有新字段均为可选

**备选方案**:
1. 创建独立的 DocumentMetadataStore（需要额外查询，复杂度高）
2. 仅在检索时从文件名推断（不够准确，无法获取 Author/CreationDate）

### Decision 2: 年份推断策略

**选择**: 多来源优先级推断：Title → Filename → CreationDate → undefined

**推断流程**:
```typescript
function inferYear(title: string, filename: string, creationDate?: Date): number | undefined {
  // 1. 从标题提取（最可靠）
  const titleYear = title?.match(/\b(20\d{2}|19\d{2})\b/)?.[0];
  if (titleYear) return parseInt(titleYear);
  
  // 2. 从文件名提取
  const fileYear = filename?.match(/_(20\d{2}|19\d{2})/)?.[0];
  if (fileYear) return parseInt(fileYear);
  
  // 3. 从 CreationDate 获取
  if (creationDate) return creationDate.getFullYear();
  
  return undefined;
}
```

**理由**: 医疗指南通常在标题中包含年份（如 "Standards of Care 2024"），这是最准确的来源。

### Decision 3: 医疗来源识别

**选择**: 基于 title/author 的关键词匹配

**识别规则**:
```typescript
const GUIDELINE_PATTERNS = {
  'ADA': /ADA|American Diabetes Association|Standards of Care/i,
  'KDIGO': /KDIGO|Kidney Disease: Improving Global Outcomes/i,
  'ESC': /ESC|European Society of Cardiology/i,
  'CDS': /CDS|中国糖尿病学会|中华医学会糖尿病/i,
  'ATA': /ATA|American Thyroid Association/i,
};
```

**理由**: 简单高效，覆盖主要医疗指南来源。后续可扩展为基于规则库的更精确识别。

## Risks / Trade-offs

### Risk 1: PDF 元数据缺失或不准确

**风险**: 很多 PDF 文件的 info 字段为空或填写不准确（如 Title 为 "Microsoft Word Document"）

**缓解**:
- 实现 fallback 机制：title 缺失时使用 filename（去除扩展名）
- 年份推断使用多来源策略
- 所有字段均为可选，系统可正常运行

### Risk 2: 现有数据无元数据

**风险**: 已入库的 chunk 数据没有新字段

**缓解**:
- 新字段均为可选（`?:`），旧数据正常工作
- 检索时使用 fallback：`documentTitle ?? sourceDocumentId`
- 后续可选择性重建索引

### Risk 3: 文件名推断准确性

**风险**: 文件名格式不规范可能导致推断错误

**缓解**:
- 文件名推断作为第二优先级（仅当 title 无年份时）
- 正则匹配严格限制年份范围（1900-2099）
- 无法推断时返回 undefined，不强制填充

## Migration Plan

### Phase 1: 类型定义扩展（向后兼容）

1. 扩展 `ParsedMetadata` 添加 year 字段
2. 扩展 `ChunkMetadata` 添加文档级字段
3. 所有字段标记为可选（`?:`）

### Phase 2: 解析层改进

1. text-extractor.ts: 返回 pdf-parse 的 data.info
2. parse-stage.ts: 填充 ParsedMetadata，实现年份推断

### Phase 3: 存储层改进

1. document-processor.ts: 复制元数据到 chunk.metadata

### Phase 4: 应用层改进

1. chat.ts: 使用 chunk.metadata 构建 SourceCitation

### Rollback Strategy

- 新字段均为可选，删除相关代码即可回滚
- 无数据库迁移，无持久化变更