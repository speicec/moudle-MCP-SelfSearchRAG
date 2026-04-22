## Context

### 当前状态

Medical Agent 当前实现简化版 ReAct 循环：

```
Think → Act → Observe → Decide → Answer
```

核心组件位于 `src/medical/agent/`：
- `AgentExecutor.ts` - 主循环执行器
- `MedicalReasoner.ts` - LLM 推理器
- `AgentState.ts` - 状态管理
- `AgentCache.ts` - 结果缓存
- `AgentLogger.ts` - 执行日志

### 问题分析

| 问题 | 影响 | 根因 |
|------|------|------|
| 无任务分解 | 复杂查询无法处理 | 每轮只做单一决策 |
| 线性执行 | 检索效率低 | 无并行调度机制 |
| 无上下文管理 | Token 超限风险 | 无 Token 计数 |
| 无自我修正 | 答案质量不稳定 | 无 Re-planning 机制 |

### 设计约束

- **兼容性约束**：现有 MCP 工具必须保持向后兼容
- **成本约束**：Planning 不应增加过多 LLM 调用
- **性能约束**：并行检索延迟应低于串行执行
- **安全性约束**：DAG 验证必须防止无效任务执行

---

## Goals / Non-Goals

**Goals:**

1. 实现 PlanAndExecute 模式，支持复杂查询的任务分解
2. 实现 DAG 执行引擎，支持并行调度和失败恢复
3. 实现上下文管理器，控制 Token 使用和动态截断
4. 实现基于阈值的 Re-planning 机制，支持动态调整
5. 实现纯规则 DAG 验证，确保执行安全性

**Non-Goals:**

1. **不实现 Reflection 循环**：属于 Phase 3，本变更不包含
2. **不实现 Multi-Agent 协作**：属于 Phase 5，本变更不包含
3. **不引入外部 Agent 框架**：使用自实现轻量级方案
4. **不修改 OCR/VLM 流程**：Agent 层不涉及文档处理

---

## Decisions

### Decision 1: Planning 模式选择

**选择**：PlanAndExecute（而非纯 ReAct 增强）

**理由**：
- ReAct 每轮独立决策，无法全局规划
- PlanAndExecute 支持任务分解和并行识别
- 复杂查询（对比类）需要前置规划

**替代方案**：
- **方案 A**：纯 ReAct 增强（每轮多决策）→ 无法处理复杂依赖
- **方案 B**：引入 LangGraph → 外部依赖，学习成本高
- **方案 C**：自实现 PlanAndExecute → 轻量可控 ✓

### Decision 2: Planning LLM 调用时机

**选择**：分级策略（简单查询跳过，复杂查询启用）

```
实体数 ≤ 1 → 跳过 Planning（零成本）
匹配模板 → 使用模板 DAG（零 LLM 调用）
其他 → LLM Planning（~700 tokens）
```

**理由**：
- 避免过度 Planning
- 模板匹配覆盖常见场景（禁忌检查、对比查询）
- 成本可控

### Decision 3: 并行执行策略

**选择**：Promise.all + 同类型限制

```typescript
// 并行限制
const PARALLEL_TYPE_LIMITS = {
  retrieve: 3,              // 同时最多检索 3 个实体
  check_interaction: 1,     // 外部 API 限流
  generate_answer: 1        // 答案生成必须串行
};
```

**理由**：
- Promise.all 原生支持，无需额外库
- 同类型限制避免资源竞争
- 外部 API 可能有限流

### Decision 4: DAG 验证方式

**选择**：纯规则验证（非 LLM 验证）

**理由**：
- 规则验证零成本、可预测
- 循环依赖可用 DFS 算法检测
- 并行冲突可用 Set 交集检测

**验证规则**：
```
结构完整性 → Set 检测 ID 唯一性
循环依赖 → DFS 图遍历
并行冲突 → Set 交集检查
参数完整性 → Schema 校验
```

### Decision 5: Re-planning 触发方式

**选择**：基于阈值的多维度触发

**触发维度**：
| 维度 | 阈值 | 权重 |
|------|------|------|
| 实体覆盖率 | ≥ 0.8 | 40% |
| 高置信度占比 | ≥ 0.3 | 20% |
| 失败任务占比 | ≤ 0.2 | 10% |
| 综合满意度 | ≥ 0.65 | 触发阈值 |

**理由**：
- 单一阈值过于简化
- 多维度综合评分更准确
- 关键任务失败立即触发（CRITICAL）

### Decision 6: 上下文管理策略

**选择**：Token 计数 + 优先级截断 + 压缩

```typescript
interface ContextManagerConfig {
  maxTokens: 60000;           // 上下文上限
  reserveForOutput: 4000;     // 输出预留
  compressionThreshold: 0.8;  // 压缩触发阈值
}
```

**理由**：
- 医学答案需要完整证据链
- 低置信度内容可压缩
- 高优先级（指南来源）优先保留

---

## Architecture

### 组件架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Agent Planning Enhancement 架构                            │
└─────────────────────────────────────────────────────────────────────────────┘

                              Query + Entities
                                      │
                                      ▼
                           ┌─────────────────────┐
                           │   ComplexityJudge   │
                           │   (复杂度判断)        │
                           └─────────────────────┘
                                      │
                          ┌───────────┴───────────┐
                          │                       │
                     simple                  moderate/complex
                          │                       │
                          ▼                       ▼
                    直接 ReAct            ┌─────────────────────┐
                                         │   IntentAnalyzer    │
                                         │   (意图分析)         │
                                         └─────────────────────┘
                                                  │
                                                  ▼
                                         ┌─────────────────────┐
                                         │   TemplateMatcher   │
                                         │   (模板匹配)         │
                                         └─────────────────────┘
                                                  │
                                      ┌───────────┴───────────┐
                                      │                       │
                                 matched                  unmatched
                                      │                       │
                                      ▼                       ▼
                               使用模板 DAG          ┌─────────────────────┐
                                                    │   TaskPlanner        │
                                                    │   (LLM Planning)     │
                                                    └─────────────────────┘
                                                  │
                                                  ▼
                                         ┌─────────────────────┐
                                         │   DAGValidator      │
                                         │   (规则验证)         │
                                         └─────────────────────┘
                                                  │
                                      ┌───────────┴───────────┐
                                      │                       │
                                 valid=false             valid=true
                                      │                       │
                                      ▼                       ▼
                               AutoCorrect 或回退    ┌─────────────────────┐
                                                    │   TaskExecutor       │
                                                    │   (DAG 执行)         │
                                                    └─────────────────────┘
                                                  │
                                                  ▼
                                         ┌─────────────────────┐
                                         │   ContextManager    │
                                         │   (上下文管理)       │
                                         └─────────────────────┘
                                                  │
                                                  ▼
                                         ┌─────────────────────┐
                                         │   ResultChecker     │
                                         │   (结果检查)         │
                                         └─────────────────────┘
                                                  │
                                      ┌───────────┴───────────┐
                                      │                       │
                                 satisfied               not satisfied
                                      │                       │
                                      ▼                       ▼
                              generate_answer      ┌─────────────────────┐
                                                   │   ReplanningEngine   │
                                                   │   (动态调整)         │
                                                   └─────────────────────┘
                                              │
                                              └──────────────────────▶ TaskExecutor
```

### 数据流

```typescript
// Planning 流程数据流
Query → ComplexityLevel → IntentAnalysis → TemplateMatch → TaskDAG → ValidatedDAG

// Execution 流程数据流
ValidatedDAG → ExecutorState → TaskResults → ExecutionSummary → ReplanningDecision

// Context 管理数据流
RetrievalResults → ContextEntries → TokenCount → CompressedContext → LLMPrompt
```

---

## Risks / Trade-offs

### Risk 1: Planning LLM 调用延迟

**风险**：Planning 增加 1-2 次 LLM 调用，增加延迟

**缓解措施**：
- 简单查询跳过 Planning
- 模板匹配零 LLM 调用
- Planning 结果可缓存

### Risk 2: DAG 验证过于严格

**风险**：验证规则可能拒绝有效的 DAG

**缓解措施**：
- 自动修正机制（自依赖、优先级冲突）
- 回退策略（无法修正时回退 ReAct）
- 警告与错误分级处理

### Risk 3: Re-planning 无限循环

**风险**：Re-planning 可能无限迭代

**缓解措施**：
- 最大轮数限制（maxReplanRounds = 2）
- 收敛检查（两轮无提升停止）
- 冷却时间（500ms）

### Risk 4: 并行执行竞态

**风险**：并行任务可能有状态冲突

**缓解措施**：
- 任务状态隔离（独立收集结果）
- 同类型并行限制
- 无共享状态设计

---

## Migration Plan

### Phase 1: 基础架构（不影响现有功能）

1. 新增类型定义 `ExecutionTypes.ts`
2. 新增 `DAGValidator.ts`（纯规则，可独立测试）
3. 新增 `ContextManager.ts`（可独立测试）

### Phase 2: Planning 层（可选启用）

1. 新增 `ComplexityJudge.ts`
2. 新增 `IntentAnalyzer.ts`
3. 新增 `TaskPlanner.ts`
4. 新增结构化模板

### Phase 3: Executor 改造（替换主流程）

1. 新增 `TaskExecutor.ts`
2. 改造 `AgentExecutor.ts` 支持双模式
3. 新增 `ReplanningEngine.ts`

### Phase 4: MCP 工具集成

1. 新增 `medical_agent_plan` MCP 工具参数
2. 保持现有工具兼容
3. 添加配置开关

### Rollback Strategy

- 双模式并存：ReAct 和 PlanAndExecute
- 配置开关控制：`enable_planning: boolean`
- 简单查询自动使用 ReAct
- 失败时自动回退到 ReAct

---

## Open Questions

1. **Planning Prompt 优化**：当前 Prompt 约 700 tokens，是否可以进一步压缩？
2. **模板扩展策略**：当前 4 个模板，哪些场景应该优先添加新模板？
3. **并行度动态调整**：是否需要根据系统负载动态调整并行度？
4. **Re-planning 置信度阈值**：0.65 是否合适，是否需要根据领域调整？

---

## References

- [Agent 预研路线分析](../../docs/agent-roadmap-analysis.md)
- [TaskPlanner Prompt 设计](../../docs/agent-taskplanner-prompts.md)
- [Re-planning 阈值与 DAG 验证](../../docs/agent-replanning-validation.md)