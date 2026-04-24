# 设计一致性检查报告

## 时间: 2026-04-24 14:30

## 检查范围

- **设计文档:** `openspec/changes/enhance-document-metadata-extraction/design.md`
- **规格文档:** 
  - `specs/document-metadata-extraction/spec.md`
  - `specs/medical-source-identification/spec.md`
  - `specs/document-management/spec.md`
  - `specs/chat-retrieval/spec.md`
- **代码范围:** 
  - `src/parsers/text-extractor.ts`
  - `src/parsers/parse-stage.ts`
  - `src/core/types.ts`
  - `src/chunking/types.ts`
  - `src/server/document-processor.ts`
  - `src/server/routes/chat.ts`
  - `src/medical/evidence-evaluator.ts`

## 契约一致性状态: ⚠ 存在偏差

**注:** 这是一个**待实现**的设计，大部分功能尚未实现。

---

## 一致项

✓ **ParsedMetadata 类型定义** (`src/core/types.ts:143-153`) - 结构与设计一致，包含 title, author, subject, creationDate, pageCount 等字段

✓ **GUIDELINE_AUTHORITY_MAPPING** (`src/medical/evidence-evaluator.ts:289-305`) - 与设计 Decision 3 的关键词匹配规则一致

✓ **evaluateSourceAuthority 函数** (`src/medical/evidence-evaluator.ts:342-364`) - 权威性映射逻辑与设计规格一致

✓ **calculateTimeWeight 函数** (`src/medical/evidence-evaluator.ts:374-387`) - 时效权重计算逻辑与设计一致

---

## 偏差列表

### Critical

1. **ChunkMetadata 缺少文档级元数据字段** - `src/chunking/types.ts:69-74`
   - 设计期望: ChunkMetadata 包含 documentTitle, documentAuthor, documentYear, guidelineSource 字段
   - 实际实现: ChunkMetadata 仅包含 contentType, pageNumber?, section?, boundaryConfidence?
   - 影响: 元数据无法传递到 chunk 层级，下游检索和 SourceCitation 构建无法获取文档信息
   - 建议: 扩展 ChunkMetadata 接口添加新字段，所有字段标记为可选

2. **text-extractor.ts 未提取 PDF 元数据** - `src/parsers/text-extractor.ts:69-136`
   - 设计期望: extract() 方法返回 pdf-parse 的 data.info（Title, Author, CreationDate, Subject）
   - 实际实现: 仅提取文本内容，`data.info` 元数据被丢弃
   - 影响: 元数据在解析层就已缺失，无法填充到 ParsedMetadata
   - 建议: 在 extract() 方法中提取并返回 pdf-parse 的 `data.info` 字段

---

### Important

1. **parse-stage.ts 未填充 ParsedMetadata** - `src/parsers/parse-stage.ts:283-295`
   - 设计期望: 从 PDF info 填充 title, author, creationDate 等字段，实现年份推断
   - 实际实现: ParsedMetadata 所有字段均为 undefined（仅 pageCount 有值）
   - 影响: 元数据提取链断裂，ParsedContent.metadata 为空壳
   - 建议: 在 processPdfDocument 中调用 text-extractor 获取 PDF info，并实现 inferYear 函数

2. **SourceCitation 使用 sourceDocumentId 而非 documentTitle** - `src/server/routes/chat.ts:329-337`
   - 设计期望: SourceCitation.documentName 使用 documentTitle（人类可读标题）
   - 实际实现: documentName 直接使用 sourceDocumentId（文件名）
   - 影响: 前端显示的是文件名而非可读标题
   - 建议: 检查 chunk.metadata.documentTitle，fallback 到 sourceDocumentId

3. **年份推断函数未实现** - 设计 Decision 2
   - 设计期望: inferYear(title, filename, creationDate) 函数实现多来源推断
   - 实际实现: 函数不存在
   - 影响: 无法智能推断年份，documentYear 字段始终为 undefined
   - 建议: 在 parse-stage.ts 或新建 metadata-utils.ts 中实现 inferYear 函数

4. **医疗来源识别未集成到解析流程** - `src/medical/evidence-evaluator.ts:189-212`
   - 设计期望: parse-stage.ts 在解析时识别 guidelineSource 并填充到 ChunkMetadata
   - 实际实现: guidelineSource 仅在 evidence-evaluator 中通过 documentName 推断（下游补救）
   - 影响: 元数据提取不完整，依赖下游补救而非上游提取
   - 建议: 在 parse-stage.ts 中实现 identifyGuidelineSource 函数

---

### Minor

1. **document-processor.ts 未传播元数据到 chunk** - `src/server/document-processor.ts:256-271`
   - 设计期望: 复制 ParsedContent.metadata 到 chunk.metadata（documentTitle, documentYear 等）
   - 实际实现: 仅复制 contentType 和 pageNumber
   - 建议: 在 createHierarchicalChunk 时复制文档级元数据

2. **DocumentMetadata 类型未定义完整字段** - `src/server/types.ts`（需确认）
   - 设计期望: DocumentMetadata 包含 title, author, year, guidelineSource
   - 实际实现: 未验证（文件未读取）
   - 建议: 检查 DocumentMetadata 类型定义，确保包含设计要求的字段

3. **Document List API 未包含提取元数据** - 设计 document-management/spec.md
   - 设计期望: GET /api/documents 返回 title, author, year, guidelineSource
   - 实际实现: 未验证（routes/document.ts 未读取）
   - 建议: 检查并更新 document routes 实现

---

## 待实现项

根据 Migration Plan Phase 1-4，以下功能尚未实现：

### Phase 1: 类型定义扩展
- [x] ParsedMetadata 已包含完整字段 - **已完成**
- [ ] ChunkMetadata 需扩展添加 documentTitle, documentAuthor, documentYear, guidelineSource

### Phase 2: 解析层改进
- [ ] text-extractor.ts: 提取并返回 pdf-parse 的 data.info
- [ ] parse-stage.ts: 填充 ParsedMetadata 字段
- [ ] parse-stage.ts: 实现 inferYear 函数
- [ ] parse-stage.ts: 实现 identifyGuidelineSource 函数

### Phase 3: 存储层改进
- [ ] document-processor.ts: 复制元数据到 chunk.metadata

### Phase 4: 应用层改进
- [ ] chat.ts: SourceCitation 使用 chunk.metadata.documentTitle
- [ ] chat.ts: 使用 chunk.metadata.documentYear
- [ ] evidence-evaluator.ts: 使用 chunk.metadata.guidelineSource（而非从 documentName 推断）

---

## 建议

1. **优先修复 Critical 偏差**
   - 扩展 ChunkMetadata 类型定义
   - 修改 text-extractor.ts 提取 PDF info

2. **按 Phase 顺序实现**
   - 遵循设计文档的 Migration Plan 顺序，确保向后兼容

3. **向后兼容策略**
   - 所有新字段使用可选标记 `?:`
   - 检索时使用 fallback: `documentTitle ?? sourceDocumentId`
   - 无需数据迁移，旧数据正常工作

4. **补充设计文档**
   - 无需补充，设计文档已完整定义接口契约和数据结构

---

## 附录: 设计与实现的对照表

| 设计定义 | 实现状态 | 偏差程度 |
|----------|----------|----------|
| ChunkMetadata.documentTitle | 未实现 | Critical |
| ChunkMetadata.documentAuthor | 未实现 | Critical |
| ChunkMetadata.documentYear | 未实现 | Critical |
| ChunkMetadata.guidelineSource | 未实现 | Critical |
| inferYear 函数 | 未实现 | Important |
| identifyGuidelineSource 函数 | 未实现 | Important |
| text-extractor 返回 PDF info | 未实现 | Critical |
| SourceCitation 使用 documentTitle | 使用 sourceDocumentId | Important |
| evidence-evaluator 使用 guidelineSource | 使用 documentName 推断 | Minor |