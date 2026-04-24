## Why

当前系统召回答案证据时存在两个核心问题：

1. **证据引用不完整**：引用显示为文件名（如 "ADA_2024.pdf"）而非人类可读的标题（如 "ADA Standards of Care 2024"），缺少年份、章节、作者等关键元数据，降低了答案的可信度和专业性。

2. **评估分数不一致**：置信评估（ConfidenceCalculator）分数很高，但 RAGAS 相关度分析（contextRelevance）显示只有 1%-3%。这是因为 ConfidenceCalculator 使用 Jaccard 关键词匹配（形式相似性），而 contextRelevance 使用 LLM 语义理解（语义相关性），两套评估机制衡量的维度不同。

根本原因是 PDF 解析阶段丢弃了 `pdf-parse` 库返回的文档元数据（Title、Author、CreationDate 等），导致这些信息在整个数据处理流程中缺失。

## What Changes

- 从 PDF 文档提取并保留完整元数据（标题、作者、年份、创建日期等）
- 在 Chunk 层级存储文档级元数据，使检索结果携带完整来源信息
- 改进 SourceCitation 构建，使用人类可读的标题而非文件名
- 添加医疗文献特殊处理，智能识别指南来源（ADA、KDIGO、ESC、CDS 等）
- 实现年份推断逻辑，从标题、文件名或 CreationDate 推断年份

## Capabilities

### New Capabilities

- `document-metadata-extraction`: PDF 元数据提取能力 - 从 pdf-parse 返回的 data.info 提取 Title、Author、Subject、CreationDate 等，并推断年份
- `medical-source-identification`: 医疗来源识别能力 - 智能识别指南来源（ADA、KDIGO、ESC、CDS 等），用于增强证据评估

### Modified Capabilities

- `document-management`: 扩展文档入库流程，在解析阶段保留元数据并传递到 chunk 层级
- `chat-retrieval`: 检索结果携带完整元数据，SourceCitation 使用 documentTitle 而非 sourceDocumentId

## Impact

**代码修改范围**：

| 文件 | 修改内容 |
|------|---------|
| `src/parsers/text-extractor.ts` | 提取并返回 pdf-parse 的 data.info 元数据 |
| `src/parsers/parse-stage.ts` | 填充 ParsedContent.metadata，实现年份推断 |
| `src/core/types.ts` | 扩展 ParsedMetadata，添加 year 字段 |
| `src/chunking/types.ts` | 扩展 ChunkMetadata，添加文档级字段 |
| `src/server/document-processor.ts` | 复制元数据到每个 chunk 的 metadata |
| `src/server/routes/chat.ts` | 使用 chunk.metadata 构建 SourceCitation |

**影响的数据结构**：
- `ParsedMetadata`: 新增 year 字段，确保 title/author 正确填充
- `ChunkMetadata`: 新增 documentTitle、documentAuthor、documentYear、guidelineSource 字段
- `SourceCitation`: documentName 使用标题而非文件名

**向后兼容**：
- 所有新增字段均为可选（`?:`），不影响现有数据
- 旧数据（无元数据）继续使用 sourceDocumentId 作为 fallback

**依赖关系**：
- 无新增外部依赖
- 利用已有的 pdf-parse 库返回值