## Why

Planning 模式引入后，文档召回质量显著下降。诊断发现三个核心问题：

1. **假 LLM 实现** - `AgentExecutor.executePlanningMode()` 使用硬编码的假 LLM，直接返回原始 query 作为检索参数，而非调用 `query-planner` 优化
2. **意图检测不全** - `IntentAnalyzer` 只检测"禁忌"关键词，无法识别"能否使用"背后的禁忌检查需求
3. **模板覆盖不足** - 只有 4 种模板，`decision_support` 类查询无法匹配，被迫使用假 LLM fallback

同时，用户无法看到 Agent 的决策过程，不知道为什么选择 Planning/ReAct 模式、检索词如何被重写、模板匹配失败原因。

## What Changes

### 核心修复
- 修复 Planning 模式检索优化：使用 `query-planner.buildQueryStrategy()` 优化检索查询
- 扩展意图检测：识别"能否使用"、"可以服用"等决策支持意图背后的禁忌检查需求
- 新增 `decision_support_with_indicator` 模板：覆盖"eGFR=35能否使用二甲双胍"类查询

### 可视化增强
- 新增检索可视化模块：展示原始 query → 关键词匹配 → 实体匹配 → 重写 query
- 新增白箱链路追踪：展示从输入到 DAG/ReAct 分配的完整决策链
- 双通道输出：MCP Tool 简要版（用户可见）+ Logger 完整版（调试可见）

### 日志系统
- AgentExecutor 集成 AgentLogger（替代分散的 console.log）
- 记录模板匹配尝试过程（成功和失败的）

## Capabilities

### New Capabilities
- `retrieval-visualization`: 检索结果可视化 - 展示查询重写、实体匹配、执行路径的简要版和完整版输出
- `execution-trace`: 白箱链路追踪 - 记录每个阶段的决策过程、耗时、输入输出

### Modified Capabilities
- `task-planning`: 修改 Planning 模式的检索优化逻辑，确保使用 query-planner 优化的检索词
- `medical-entity-recognition`: 扩展 IntentAnalyzer 的禁忌意图检测模式
- `mcp-query-tool`: 扩展输出格式，在结论前添加检索可视化章节

## Impact

### 核心文件修改
- `src/medical/agent/AgentExecutor.ts` - 核心修改：集成 Logger、修复 Planning 模式
- `src/medical/agent/IntentAnalyzer.ts` - 扩展禁忌检测
- `src/medical/agent/TemplateMatcher.ts` - 新增模板
- `src/medical/agent-mcp-tool.ts` - 扩展输出格式

### 新增文件
- `src/medical/agent/RetrievalVisualization.ts` - 可视化数据结构和格式化
- `src/medical/agent/TraceVisualizer.ts` - 链路追踪系统

### 类型扩展
- `src/medical/agent/types.ts` - 新增 RetrievalVisualization、ExecutionTrace 类型

### 测试文件
- 对应模块的测试文件需要同步更新