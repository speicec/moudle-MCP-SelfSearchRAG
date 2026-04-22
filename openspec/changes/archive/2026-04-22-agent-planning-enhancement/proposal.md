## Why

当前 Medical Agent 实现的是简化版 ReAct 循环，缺乏 Planning 能力。复杂查询（如"二甲双胍和利拉鲁肽哪个更适合肾功能不全患者"）无法进行任务分解和并行检索，导致：
- 检索效率低：线性执行，无法并行检索多个实体
- 答案质量差：无法系统性覆盖所有实体，常遗漏关键证据
- Token 超限风险：无上下文管理机制

引入 PlanAndExecute 模式可以解决这些问题，提升 Agent 处理复杂查询的能力。

## What Changes

- **新增 TaskPlanner 组件**：将查询分解为 Task DAG，识别并行机会
- **新增 TaskExecutor 组件**：DAG 执行引擎，支持并行调度和失败重试
- **新增 ContextManager**：Token 计数、上下文窗口管理、动态截断
- **新增 Re-planning 机制**：基于阈值的动态调整，补充任务和修正策略
- **新增 DAG 验证器**：纯规则验证，循环依赖检测、并行合法性检查
- **扩展 AgentState**：支持分支状态、中间检查点、状态恢复
- **新增 5 种工具类型**：calculate_indicator、check_interaction、check_contraindication

## Capabilities

### New Capabilities

- `task-planning`: 任务分解和 DAG 生成能力，包含复杂度判断、意图分析、模板匹配
- `dag-execution`: DAG 执行引擎，支持并行调度、失败重试、状态收集
- `context-management`: Token 计数、上下文窗口限制、优先级截断、压缩机制
- `replanning-trigger`: 基于阈值的 Re-planning 触发判断，包含覆盖度、证据质量、执行状态检查
- `dag-validation`: DAG 自动化验证规则，包含循环依赖检测、并行合法性、优先级合理性检查

### Modified Capabilities

- `medical-entity-recognition`: 新增指标值解析（如 eGFR=35），用于条件判断
- `mcp-query-tool`: 新增 `medical_agent_plan` MCP 工具，支持 Planning 模式调用

## Impact

### 代码影响
- `src/medical/agent/` 目录新增 6 个模块：
  - `TaskPlanner.ts` - 任务规划器
  - `TaskExecutor.ts` - DAG 执行器
  - `ContextManager.ts` - 上下文管理器
  - `ReplanningEngine.ts` - Re-planning 引擎
  - `DAGValidator.ts` - DAG 验证器
  - `ExecutionTypes.ts` - 执行类型定义
- `src/medical/agent/AgentExecutor.ts` 改造为支持 PlanAndExecute 流程
- `src/medical/agent/AgentState.ts` 扩展为支持分支状态

### API 影响
- MCP 工具新增 `medical_agent_plan` 参数：
  ```json
  {
    "query": "...",
    "enable_planning": true,
    "max_replan_rounds": 2
  }
  ```

### 性能影响
- Planning 阶段增加 1-2 次 LLM 调用（复杂度判断 + Planning）
- 复杂查询总执行时间可能增加，但并行检索可抵消部分延迟

### 兼容性影响
- **非破坏性变更**：现有 `medical_query` 和 `medical_agent` 工具保持兼容
- 新参数可选，默认保持 ReAct 模式