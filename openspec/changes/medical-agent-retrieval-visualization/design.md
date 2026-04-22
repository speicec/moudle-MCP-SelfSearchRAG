## Context

### 当前架构
Medical Agent 支持双模式执行：
- **ReAct 模式**：迭代循环（Think → Act → Observe → Decide），使用 `query-planner` 优化检索
- **Planning 模式**：任务 DAG 执行，支持并行检索和重规划

```
AgentExecutor.run()
    │
    ├── chooseExecutionMode(entities, query)
    │       │
    │       ├── ComplexityJudge.assessComplexity()
    │       │       └── needsPlanning? → true/false
    │       │
    │       └── mode = 'planning' | 'react'
    │
    ├── Planning 模式
    │       ├── executePlanningMode()
    │       │       ├── plan() → DAG (问题：使用假 LLM)
    │       │       ├── validateDAG()
    │       │       └── execute(dag) (问题：未使用优化 query)
    │       │
    │       └── generateAnswerFromState()
    │
    └── ReAct 模式
            ├── executeReactMode()
            │       ├── buildQuery(entities) → 优化 query ✓
            │       ├── retrieval(优化 query) ✓
            │       └── iterative reasoning
            │
            └── generateAnswer()
```

### 核心问题链路

```typescript
// AgentExecutor.ts:143-152 (当前问题代码)
const planningResult = await plan(entities, query, {
  llmCall: async (prompt: string) => {
    // ❌ 假实现：直接返回硬编码 DAG
    return JSON.stringify({
      tasks: [
        { id: 'retrieve_1', type: 'retrieve', params: { query }, ... }  // ← 原始 query
      ]
    });
  },
  enableLLMFallback: true,
});
```

### 相关约束
- AgentLogger 已存在但未被 AgentExecutor 使用
- TemplateMatcher 只有 4 种模板，匹配失败时使用假 LLM
- IntentAnalyzer 只检测 `/禁忌/` 关键词

## Goals / Non-Goals

**Goals:**
- 修复 Planning 模式：使用 `query-planner.buildQueryStrategy()` 生成优化检索词
- 扩展意图检测：识别决策支持类查询的禁忌检查需求
- 新增模板：覆盖 `decision_support + indicator_value` 组合
- 实现双通道可视化：MCP Tool 简要版 + Logger 完整版
- 集成 AgentLogger：替代分散的 console.log

**Non-Goals:**
- 不修改 LLM 调用接口（使用现有 LLMCaller）
- 不修改 DAG 执行引擎核心逻辑
- 不修改实体识别器核心逻辑
- 不增加新的查询类型

## Decisions

### Decision 1: Planning 模式检索优化策略

**选择**: 在 `executePlanningMode()` 中调用 `buildQueryStrategy()`，将优化后的 query 注入 DAG 任务参数

**替代方案**:
- A) 在 TaskPlanner.plan() 中优化 ❌ - 太晚，DAG 已生成
- B) 在 TemplateMatcher.generateDAG() 中优化 ✓ - 模板级优化（配合 Decision 2）
- C) 在 TaskExecutor.executeByType() 中优化 ❌ - 执行层，不改变 DAG

**最终方案**: A + B 组合
1. 在 `executePlanningMode()` 开始时调用 `buildQueryStrategy()`
2. 将优化策略传递给 `plan()` 和模板 DAG 生成器
3. 确保所有 retrieve 任务使用优化 query

### Decision 2: 模板扩展策略

**选择**: 新增 `decision_support_with_indicator` 模板

**模板定义**:
```typescript
{
  id: 'decision_support_with_indicator',
  name: '指标决策支持',
  matchCriteria: (entities, intentAnalysis) => {
    return (
      intentAnalysis.queryTypes.includes('decision_support') &&
      entities.drugs.length >= 1 &&
      entities.indicators.length >= 1 &&
      entities.indicators.some(i => i.value !== undefined)
    );
  },
  generateDAG: (entities, query, intentAnalysis, strategy) => {
    // 使用 strategy.primaryQuery 作为检索词
    // 并行检索药物禁忌 + 指标阈值
    ...
  }
}
```

### Decision 3: 可视化数据收集架构

**选择**: 创建独立的 `VisualizationCollector` 类，在各阶段收集数据

**架构**:
```
VisualizationCollector
    │
    ├── collectInputPhase(query, timestamp)
    ├── collectEntityPhase(entities, matchDetails)
    ├── collectComplexityPhase(complexity)
    ├── collectModeSelectionPhase(mode, reason)
    ├── collectTemplatePhase(templateAttempts) ← 新增：记录尝试过程
    ├── collectDAGPhase(dag)
    ├── collectExecutionPhase(executorState)
    ├── collectAnswerPhase(answer)
    │
    ├── buildBriefVisualization() → MCP Tool 输出
    └── buildFullVisualization() → Logger 报告
```

**替代方案**:
- A) 扩展 AgentState 添加 visualization 字段 ❌ - 状态膨胀，ReAct/Planning 共用复杂
- B) 在 AgentLogger 中直接收集 ✓ - 简单，但 Logger 功能边界模糊
- C) 独立 Collector + AgentLogger 集成 ✓ (选择) - 清晰分离，易于测试

### Decision 4: 双通道输出格式

**MCP Tool 简要版**:
```
## 🔍 检索分析

**原始查询**: "eGFR=35能否使用二甲双胍"

**识别结果**:
- 药物: 二甲双胍
- 指标: eGFR=35 mL/min/1.73m²
- 意图: 决策支持 (禁忌检查)

**优化查询**: "二甲双胍 eGFR 阈值 禁忌症"

**执行路径**: Planning → 模板匹配 → DAG执行

**检索结果**: 3条相关文献
```

**Logger 完整版**:
```
### Phase 1: 输入解析
**时间**: 2026-04-22T10:30:00.123Z
**耗时**: 5ms
**输入**: "eGFR=35能否使用二甲双胍"

### Phase 2: 实体识别
**识别器**: DictionaryMatcher
**匹配过程**:
```json
{
  "drugs": [{ "matchedTerm": "二甲双胍", "id": "drug_metformin", "position": [15, 19] }],
  "indicators": [{ "matchedTerm": "eGFR", "value": 35, "thresholdZone": "caution" }]
}
```

### Phase 3-8: ...
(每个阶段的完整 JSON 数据、耗时、决策细节)

### 模板匹配尝试
- guideline_year_filter: ✗ (no year filter)
- drug_contraindication: ✗ (indicators.length > 0)
- decision_support_with_indicator: ✓ 匹配成功
```

### Decision 5: AgentLogger 集成方式

**选择**: AgentExecutor 添加 logger 属性，在各阶段调用 logger.logXxx()

**修改点**:
```typescript
class AgentExecutor {
  private config: ExtendedAgentConfig;
  private context: AgentContext;
  private logger: AgentLogger;  // 新增
  private collector: VisualizationCollector;  // 新增

  constructor(config: ExtendedAgentConfig, context: AgentContext) {
    this.config = config;
    this.context = context;
    this.logger = createAgentLogger(config.enableTraceLogging ? 'debug' : 'info');
    this.collector = new VisualizationCollector();
  }

  async run(query: string): Promise<AgentResult> {
    this.logger.setQuery(query);
    this.collector.collectInputPhase(query);
    ...
  }
}
```

## Risks / Trade-offs

### Risk 1: 性能影响
**风险**: VisualizationCollector 增加数据收集开销
**缓解**: 仅在 enableTraceLogging=true 时收集完整数据；简要版使用已计算数据

### Risk 2: 状态管理复杂度
**风险**: Planning 模式 DAG 执行结果提取复杂
**缓解**: 在 ExecutorState 中统一存储检索结果数量，便于统计

### Risk 3: 模板匹配边界模糊
**风险**: decision_support_with_indicator 与 indicator_drug_query 可能重叠
**缓解**: 定义清晰的优先级：decision_support_with_indicator > indicator_drug_query

### Risk 4: 回滚兼容性
**风险**: 修改 AgentResult 类型可能影响现有消费者
**缓解**: 新增字段为可选类型，不影响现有代码