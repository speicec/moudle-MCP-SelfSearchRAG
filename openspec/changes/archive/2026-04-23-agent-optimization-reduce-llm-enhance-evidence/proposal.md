## Why

当前 Medical Agent 存在两个核心问题：

1. **LLM 调用过多**：ReAct 模式每轮迭代调用 2-3 次 LLM（think + decide + generateAnswer），典型查询需 5-15 次 LLM 调用，导致高成本和响应延迟（10-40秒）。

2. **证据评估维度不足**：当前仅评估文献类型和时效性，缺乏来源权威性、证据一致性、时效权重等维度，无法区分 ADA 国际指南与地方共识的质量差异。

优化后将减少 40-70% LLM 调用，响应时间降低 30-50%，证据评估更全面可靠。

## What Changes

- **规则化决策判断**：将 `decide()` 函数从 LLM 调用改为规则判断，基于检索数量、相似度、实体覆盖率、安全评估等规则直接判断是否满足
- **提前终止机制**：绝对禁忌场景（SafetyLayer severity='absolute'）直接跳过 ReAct 循环，无需检索
- **增强证据评估**：新增来源权威性分级、时效权重计算、证据一致性检查、多维度综合评分
- **证据排序优化**：高质量证据优先进入回答生成，低质量证据标注风险提示

## Capabilities

### New Capabilities

- `rule-based-decision`: 规则化决策判断能力，替代 LLM decide()，基于检索结果数量、相似度阈值、实体覆盖率、安全评估状态等规则判断是否满足回答条件
- `early-termination`: 提前终止能力，绝对禁忌场景直接跳过 ReAct 循环，减少不必要的检索和 LLM 调用
- `enhanced-evidence-evaluation`: 增强证据评估能力，包括来源权威性分级（international/national/local）、时效权重计算、证据一致性检查、多维度综合评分

### Modified Capabilities

无（现有 specs 中没有决策判断和证据评估的 spec 定义）

## Impact

### 代码影响

- `src/medical/agent/AgentExecutor.ts`：
  - `decide()` 函数重构为规则化判断
  - `executeReactMode()` 新增提前终止分支
  - 新增 `decideByRules()` 函数

- `src/medical/evidence-evaluator.ts`：
  - 新增 `evaluateSourceAuthority()` 函数
  - 新增 `calculateTimeWeight()` 函数
  - 新增 `checkConsistency()` 函数
  - 新增 `calculateEnhancedCompositeScore()` 函数
  - 扩展 `EvidenceEvaluation` 类型定义

- `src/medical/types.ts`：
  - 扩展 `EvidenceEvaluation` 接口，新增字段

### API 影响

无（内部优化，不影响 MCP Tool 和 HTTP API 接口）

### 性能影响

- LLM 调用减少：40-70%（典型查询）
- 响应时间降低：30-50%
- 证据评估准确度提升：新增权威性、一致性维度

### 兼容性

- 无破坏性变更
- 现有回答格式不变
- 可视化事件不变