## Why

当前RAG系统的文档切分策略存在根本性问题：固定长度切分（如512/1024 tokens）无视语义边界，导致上下文断裂、检索精度下降。垃圾分块混入检索结果，引发"垃圾进、垃圾出"循环。更糟的是，检索时盲目返回大量低相关性分块，token消耗爆炸却鲜有有效信息。

层级分块+语义切分是解决方案：用语义边界而非token计数决定分块位置，用父子关系保留完整上下文，用相似度断崖检测精准分割。这是提升RAG质量的关键一步。

## What Changes

- **新增语义分块引擎**：基于Embedding相似度的智能分块，在语义断崖处切分而非固定边界
- **新增层级分块结构**：父子分块体系，小块用于精准检索，大块提供完整上下文
- **新增Small-to-Big检索策略**：先定位精确小分块，再展开父分块返回完整语义单元
- **新增相似度断崖检测**：计算相邻embedding余弦相似度，识别语义突变点
- **新增分块质量评估**：过滤低质量分块，防止垃圾内容污染检索结果

## Capabilities

### New Capabilities

- `semantic-chunker`: 基于embedding相似度的语义分块，在语义边界处切分而非固定token边界
- `hierarchical-chunk-structure`: 父子分块层级结构，小块用于检索定位，大块提供完整上下文
- `small-to-big-retrieval`: 先检索小分块定位，再展开父分块返回完整语义单元
- `similarity-cliff-detector`: 余弦相似度断崖检测，识别语义突变点作为切分边界
- `chunk-quality-filter`: 分块质量评估与过滤，排除低信息密度分块

### Modified Capabilities

(无 - 全新能力，不修改现有spec)

## Impact

- **新增核心模块**：`src/chunking/semantic-chunker.ts`、`src/chunking/hierarchical-store.ts`、`src/chunking/cliff-detector.ts`、`src/chunking/quality-filter.ts`
- **修改检索引擎**：`src/retrieval/search-engine.ts` 需适配层级分块结构，支持Small-to-Big检索
- **修改嵌入流程**：`src/embedding/` 需支持分块级嵌入生成与相似度计算
- **新增配置项**：相似度阈值、断崖检测灵敏度、父子层级深度、质量过滤阈值
- **向后兼容**：保留固定长度分块作为fallback，不破坏现有调用者