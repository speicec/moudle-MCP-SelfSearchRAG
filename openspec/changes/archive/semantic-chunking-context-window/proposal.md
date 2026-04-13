## Why

当前 Small-to-Big 检索存在两个核心问题：

1. **上下文膨胀**：`expandToParents()` 返回整个父块（500-1500 tokens），但用户查询往往只匹配其中一小段。返回过多无关内容稀释了语义相关性，降低了 LLM 回答质量。

2. **结构边界破坏**：父块创建时仅按 token 数量合并，不考虑语义边界。导致一个父块跨越多个章节/主题，混合语义降低了检索精度。

**真实案例**：用户查询"麻醉前用药的常用药物"，期望返回 4 行精准答案，但系统返回了包含"胃肠道准备"、"麻醉前用药目的"、"术前停药"等混合内容的大块，导致匹配不精确。

## What Changes

### 1. 上下文窗口提取
- `expandToParents()` 不再返回整个父块内容
- 提取匹配 small chunk 周围的上下文窗口（前后各 N 字符）
- 新增配置参数 `contextWindowChars`（默认 500）

### 2. 结构边界感知的父块创建
- 在 `HierarchicalStore.buildHierarchy()` 中引入结构边界检测
- 父块不应跨越明显的结构边界（如章节标题、编号列表开始）
- 利用现有的 `CliffDetector` 进行语义边界识别

### 3. 混合分块策略
- 第一阶段：识别结构边界（章节、列表序号）
- 第二阶段：在结构边界内执行 small-to-big 策略
- 新增 `StructureBoundaryDetector` 工具函数

## Capabilities

### New Capabilities

- `context-window-extraction`: 检索结果上下文窗口提取，返回匹配位置附近的精简内容

### Modified Capabilities

- `small-to-big-retrieval`: 扩展检索结果类型，支持上下文窗口提取而非完整父块
- `hierarchical-chunk-structure`: 父块创建时考虑结构边界，避免跨章节合并

## Impact

**核心文件修改**：
- `src/chunking/small-to-big-retriever.ts` - `expandToParents()` 方法
- `src/chunking/hierarchical-store.ts` - `groupForParents()` 方法
- `src/chunking/config.ts` - 新增配置参数
- `src/chunking/types.ts` - 扩展结果类型

**新增文件**：
- `src/chunking/structure-boundary-detector.ts` - 结构边界检测器

**API 影响**：
- `HierarchicalRetrievalResult` 接口新增 `contextWindow` 字段
- 向后兼容：`parentChunkContent` 仍可用，但推荐使用 `contextWindow`