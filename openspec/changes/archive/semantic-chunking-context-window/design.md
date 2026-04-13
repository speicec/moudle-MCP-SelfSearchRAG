## Context

当前 Small-to-Big 检索架构在医疗知识问答场景暴露出精度问题：

```
┌───────────────────────────────────────────────────────────────────────┐
│  当前问题：检索精度不足                                               │
└───────────────────────────────────────────────────────────────────────┘

用户查询: "麻醉前用药的常用药物"

期望返回:
  "4.麻醉前用药的常用药物：
   1) 镇痛药：吗啡、哌替啶、芬太尼
   2) 苯二氮卓类：地西泮、咪达唑仑
   ..."

实际返回:
  整个父块（2201字符），包含：
  - 胃肠道准备（不相关）
  - 麻醉前用药目的（相关但非目标）
  - 麻醉前用药常用药物（目标！）
  - 术前停药（相关但非目标）

问题根源：
  1. expandToParents() 返回整个父块
  2. 父块创建不考虑结构边界，混合多主题
```

**约束条件**：
- 向后兼容现有 API
- 不改变嵌入生成逻辑
- 支持中英文文档

## Goals / Non-Goals

**Goals:**
- 检索结果返回精简上下文窗口（匹配位置周围 N 字符）
- 父块创建时识别并尊重结构边界（章节、列表序号）
- 保持 Small-to-Big 检索架构不变

**Non-Goals:**
- 不修改嵌入模型或维度
- 不改变分块的基础 token 计算逻辑
- 不引入新的 LLM 调用

## Decisions

### 1. 上下文窗口提取策略

**决定**：在 `expandToParents()` 中实现 `extractContextWindow()` 辅助函数。

```typescript
interface ContextWindowConfig {
  beforeChars: number;   // 匹配位置前字符数，默认 300
  afterChars: number;    // 匹配位置后字符数，默认 500
  respectSentence: boolean; // 是否在句子边界截断，默认 true
}

function extractContextWindow(
  parentContent: string,
  smallChunkContent: string,
  config: ContextWindowConfig
): string
```

**备选方案**：
- A) 返回整个父块 + 后处理截断 - **拒绝**：浪费 token，增加延迟
- B) 在 LLM prompt 中截断 - **拒绝**：无法控制上下文质量
- C) 匹配位置周围提取 - **接受**：精准、可控

### 2. 结构边界检测策略

**决定**：新增 `StructureBoundaryDetector`，检测章节标题和列表序号。

```typescript
interface StructureBoundary {
  position: number;      // 边界位置（字符偏移）
  type: 'chapter' | 'section' | 'list-start';
  confidence: number;
}

// 检测规则
const BOUNDARY_PATTERNS = [
  /^第[一二三四五六七八九十]+[章节]/,      // 中文章节
  /^\d+\.\s+.+/,                          // 编号列表
  /^[一二三四五六七八九十]+[、.]\s+.+/,    // 中文序号
];
```

**备选方案**：
- A) 使用 CliffDetector 的语义相似度 - **拒绝**：需要嵌入计算，开销大
- B) 正则表达式匹配 - **接受**：快速、可解释、中英文通用

### 3. 父块分组策略

**决定**：修改 `groupForParents()` 为两阶段策略。

```
Phase 1: 检测结构边界，生成边界列表
Phase 2: 在边界内执行原有 token 计数分组逻辑

if (下一个小块跨越结构边界) {
  强制结束当前父块
  开始新父块
}
```

**影响**：父块可能更小（更接近 500 tokens），但语义更聚焦。

### 4. 结果类型扩展

**决定**：扩展 `HierarchicalRetrievalResult` 接口，向后兼容。

```typescript
interface HierarchicalRetrievalResult {
  // 现有字段
  smallChunkId: string;
  parentChunkId: string;
  smallChunkContent: string;
  parentChunkContent: string;  // 保留，完整父块
  similarityScore: number;
  sourceDocumentId: string;
  metadata: ChunkMetadata;
  expandedFromSmallChunk: boolean;

  // 新增字段
  contextWindow?: string;      // 提取的上下文窗口
  windowStart?: number;        // 窗口在父块中的起始位置
  windowEnd?: number;          // 窗口在父块中的结束位置
}
```

## Risks / Trade-offs

### 1. 上下文窗口可能丢失重要信息
- **风险**：固定窗口大小可能截断相关上下文
- **缓解**：提供配置参数，允许用户调整窗口大小；默认值基于经验（前300后500字符）

### 2. 结构边界检测误判
- **风险**：正则表达式可能误判或漏判边界
- **缓解**：设置最小置信度阈值；支持自定义边界模式

### 3. 父块变小导致检索结果变多
- **风险**：结构边界分割后，可能产生更多小父块
- **缓解**：配置 `mergeSmallParents: true` 允许合并相邻小父块（仅在无边界跨越时）

## Open Questions

1. **窗口大小动态调整**：是否需要根据匹配分数动态调整窗口大小？高分→大窗口，低分→小窗口？
2. **多语言边界模式**：是否需要为不同语言配置不同的边界检测模式？