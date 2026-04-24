# Medical Agent 使用指南

## 概述

Medical Agent 是一个专门针对内分泌领域医学知识检索的智能 Agent，支持双模式执行：
- **ReAct 模式**：完整循环（Think → Act → Observe → Decide → Answer）
- **Planning 模式**：PlanAndExecute 流程，支持任务分解、并行检索、动态重规划

### 最近更新 (2026-04-23)

**新增优化特性**：
- ✅ **规则化决策系统**：替代 LLM decide() 调用，减少 LLM 调用次数
- ✅ **早终止机制**：绝对禁忌直接返回答案，跳过完整 ReAct 循环
- ✅ **增强证据评估**：新增权威度、时效性、一致性维度

**性能影响**：
- LLM 调用：从 5-15 次降至 1-3 次（减少 80%+）
- 执行时间：从 10-40 秒降至 2-10 秒（预期）
- 绝对禁忌场景：立即返回（0 LLM 调用）

## 规则化决策系统

### 概述

原有的 `decide()` 阶段需要调用 LLM 判断是否满足回答条件。现在使用规则化决策替代，大幅减少 LLM 调用。

### 满足规则（按优先级）

1. **检索数量阈值** (`retrieval_count`)：检索结果 ≥ 3 条时满足
2. **高相似度阈值** (`high_similarity`)：最高相似度 > 0.7 时满足
3. **实体覆盖率** (`entity_coverage`)：检索内容覆盖 ≥ 80% 实体时满足
4. **绝对禁忌命中** (`absolute_contraindication`)：SafetyLayer 检测到绝对禁忌时满足

### 配置选项

```typescript
interface RuleThresholds {
  minRetrievalCount: number;      // 默认 3
  minSimilarityScore: number;     // 默认 0.7
  minEntityCoverage: number;      // 默认 0.8
}

// Agent 配置
const config = {
  useRuleBasedDecide: true,       // 启用规则化决策（默认 true）
  ruleThresholds: {               // 自定义阈值
    minRetrievalCount: 5,
    minSimilarityScore: 0.85,
  }
};
```

## 早终止机制

### 概述

当 SafetyLayer 检测到绝对禁忌时，直接生成答案，跳过整个 ReAct 循环。

### 执行流程

```
输入 → 实体识别 → SafetyLayer → [绝对禁忌?] → 立即返回答案
                                    ↓ 否
                            ReAct 循环 → 最终答案
```

### 适用场景

- 禁忌症查询：如 "肾功能不全患者能用二甲双胍吗"
- 相互作用查询：如 "二甲双胍和西咪替丁能合用吗"
- 危险组合检测

### 性能收益

- **LLM 调用**：0 次（直接返回）
- **响应时间**：< 1 秒（无需检索）

## 增强证据评估

### 新增评估维度

原有的证据评估仅考虑文献类型和 GRADE 等级。新增以下维度：

| 维度 | 权重 | 说明 |
|------|------|------|
| GRADE 等级 | 40% | 原有维度，证据质量等级 |
| 来源权威度 | 20% | 国际/国家/地方指南权重 |
| 时效性 | 20% | 文献年份线性衰减 |
| 一致性 | 10% | 多来源结论一致性 |
| 适用性 | 10% | 与查询场景匹配度 |

### 权威度分类

| 级别 | 权重 | 示例来源 |
|------|------|----------|
| 国际 | 1.0 | ADA, KDIGO, ESC, ATA, EASD |
| 国家 | 0.8 | CDS, CSH, CETA, 中国指南 |
| 地方 | 0.6 | 其他来源 |

### 时效性计算

```typescript
// 线性衰减公式
weight = 1.0 - (yearsSincePublication * 0.05);
// 最低权重 0.5
// 无年份信息默认 0.7
```

### 一致性检测

通过关键词冲突检测：
- 正向词：推荐、建议、可用、首选
- 反向词：禁用、不推荐、避免、慎用

当来源间存在冲突时，一致性分数降低。

### 综合评分

```typescript
compositeScore =
  GRADE_WEIGHT * gradeScore +
  AUTHORITY_WEIGHT * authorityWeight +
  TIME_WEIGHT * timeWeight +
  CONSISTENCY_WEIGHT * consistencyScore +
  APPLICABILITY_WEIGHT * applicabilityScore;
```

### 低质量证据警告

当证据综合评分 < 0.5 或一致性分数 < 0.5 时，自动添加警告：
- "证据质量较低，建议查阅权威指南确认"
- "不同来源存在证据分歧，请综合判断"

## 功能特性

- **医学实体识别**：自动识别疾病、药物、指标等专业术语
- **智能检索策略**：基于实体构建查询策略，支持术语扩展
- **查询重写优化**：ReAct 和 Planning 模式都支持查询策略构建
- **ReAct 循环**：多轮推理决策，规则化决策减少 LLM 调用
- **Planning 模式**：任务 DAG 分解，并行检索，动态调整
- **LLM 推理**：使用 Claude/OpenAI/Ollama 进行临床推理
- **结构化回答**：包含结论、详细说明、证据等级、来源引用
- **早终止**：绝对禁忌场景立即返回

## MCP 工具

### 1. `medical_query` - 简化版医学查询

**适用场景**：快速查询，无需完整 Agent 循环

**参数**：
```json
{
  "query": "二甲双胍禁忌症",
  "domain": "diabetes",  // 可选：diabetes, hypertension, thyroid, all
  "include_guidelines": true,
  "year_range": [2020, 2024]
}
```

**返回**：
- `entities`: 识别的医学实体
- `strategy`: 查询策略
- `answer`: 结构化医学回答
- `retrievalResults`: 检索结果（如有数据）

### 2. `medical_agent` - ReAct 模式查询

**适用场景**：复杂医学查询，需要多轮推理

**参数**：
```json
{
  "query": "糖尿病患者合并肾功能不全eGFR=35，二甲双胍能否使用",
  "domain": "all",
  "max_iterations": 5,
  "confidence_threshold": 0.8
}
```

**返回**：
- Markdown 格式的结构化回答
- 包含 Agent 执行统计

### 3. `medical_agent_plan` - Planning 模式查询

**适用场景**：复杂查询（对比、多实体、综合分析）

**参数**：
```json
{
  "query": "二甲双胍和利拉鲁肽哪个更适合肾功能不全患者",
  "domain": "diabetes",
  "enable_planning": true,       // 是否启用 Planning 模式（默认 true）
  "max_replan_rounds": 2,        // 最大重规划轮数（默认 2）
  "confidence_threshold": 0.65   // 综合满意度阈值（默认 0.65）
}
```

**返回**：
- Markdown 格式的结构化回答
- Planning 模式信息（复杂度级别、匹配模板）
- 执行 DAG 结构
- 重规划历史（如有）
- Agent 执行统计

## Planning 模式说明

### 复杂度级别

| 级别 | 说明 | 处理方式 |
|------|------|----------|
| simple | 单实体查询 | 跳过 Planning，直接 ReAct |
| moderate | 2-3实体，单意图 | 单次 Planning |
| complex | 多实体/对比/综合 | 多阶段 Planning + Replanning |
| structured | 明确条件过滤 | 使用模板 DAG |

### 模板匹配

Planning 模式内置 6 个结构化模板，零 LLM 调用：

| 模板名称 | 适用场景 | 任务数 |
|----------|----------|--------|
| 指南年份过滤 | 需要年份过滤的指南查询 | 3 |
| 药物禁忌检查 | 单药禁忌症查询 | 3 |
| 药物对比 | 多药物对比查询 | 5（含并行） |
| 指标药物查询 | 带指标值的禁忌检查 | 5（含并行） |
| 指标决策支持 | 决策支持 + 指标值 + 禁忌检查 | 5（含并行） |
| 疾病用药建议 | 疾病 + 无药物 + 无指标值 | 3（含并行） |

**新增模板说明**：

- **指标决策支持** (`decision_support_with_indicator`)：针对"eGFR=35能否使用二甲双胍"类查询，优先级高于指标药物查询模板
- **疾病用药建议** (`disease_drug_recommendation`)：针对"糖尿病用什么药"类用药推荐查询

### 配置参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| enable_planning | true | 是否启用 Planning 模式 |
| max_replan_rounds | 2 | 最大重规划轮数 |
| confidence_threshold | 0.65 | 综合满意度触发阈值 |

### 重规划触发条件

当以下条件满足时触发重规划：
- 实体覆盖率 < 80%
- 证据质量评分 < 30%
- 失败任务比例 > 20%
- 关键任务失败（立即触发）

## LLM 配置

### 环境变量

设置以下环境变量之一（按优先级）：

```bash
# Anthropic Claude API（推荐）
ANTHROPIC_API_KEY=your-api-key

# OpenAI API
OPENAI_API_KEY=your-api-key

# Ollama（本地）
# 无需配置，自动使用 http://localhost:11434
```

### 配置优先级

1. ANTHROPIC_API_KEY → Claude API
2. OPENAI_API_KEY → OpenAI API
3. 默认 → Ollama（本地）

## 医学指南文档

### 推荐上传的指南文档

上传以下专业指南以获得最佳检索效果：

| 文档 | 来源 | 内容 |
|------|------|------|
| ADA Standards 2024 | ADA | 糖尿病诊疗标准 |
| KDIGO CKD Guidelines 2024 | KDIGO | 慢性肾脏病管理 |
| ESC/ESH Guidelines 2023 | ESC | 高血压药物治疗 |
| ATA Guidelines 2023 | ATA | 甲状腺疾病管理 |

### 文档上传方法

使用 `ingest_document` MCP 工具上传：

```json
{
  "document_path": "/path/to/ADA_Standards_2024.pdf",
  "metadata": {
    "source": "ADA",
    "year": 2024,
    "domain": "diabetes"
  }
}
```

## 回答格式示例

### ReAct 模式

```markdown
## 🔍 检索分析

**原始查询**: "二甲双胍禁忌症"

**识别结果**:
- 药物: 二甲双胍
- 意图: 禁忌检查

**优化查询**: "二甲双胍 禁忌症 用法注意事项"

**执行路径**: ReAct → 实体识别 → 查询优化 → 多轮检索

**检索结果**: 5条相关文献

---

## 结论
二甲双胍在肾功能不全患者中使用需谨慎，具体取决于eGFR水平。

## 详细说明
- eGFR ≥45: 可正常使用
- eGFR 30-45: 慎用，需减量
- eGFR <30: 禁用

## 证据等级
Grade B - ADA指南推荐

## 来源引用
1. ADA Standards 2024, Section 9
2. KDIGO CKD Guidelines 2024

## 注意事项
- 本回答仅供参考，不构成医疗建议
- 请咨询专业医生后再做决定

## Agent 执行统计
- 迭代次数: 3
- 执行动作: 5
- 耗时: 1500ms
- 状态: 满足
```

### Planning 模式

```markdown
## 🔍 检索分析

**原始查询**: "利拉鲁肽在肾功能不全患者中安全性优于二甲双胍"

**识别结果**:
- 药物: 利拉鲁肽, 二甲双胍
- 指标: eGFR
- 意图: 对比查询 (安全性评估)

**优化查询**: "利拉鲁肽 二甲双胍 eGFR 肾功能安全性 禁忌症对比"

**执行路径**: Planning → 模板匹配 → 药物对比DAG → 并行检索

**检索结果**: 8条相关文献

---

## 结论
利拉鲁肽在肾功能不全患者中安全性优于二甲双胍。

## 详细说明
- 利拉鲁肽：可用于eGFR≥15的患者
- 二甲双胍：eGFR<30时禁用

## Planning 模式信息
- 复杂度级别: complex
- 匹配模板: 药物对比

## 执行 DAG
- retrieve_metformin (retrieve): completed
- retrieve_liraglutide (retrieve): completed
- compare_drugs (evaluate): completed
- answer (generate_answer): completed
并行组: parallel_retrieve

## Agent 执行统计
- 总任务数: 5
- 完成任务: 5
- 并行任务: 2
- LLM 调用次数: 1
- 重规划轮数: 0
- 耗时: 2500ms
```

## 证据等级说明

| Grade | 说明 |
|-------|------|
| A | 高质量证据（RCT、Meta分析） |
| B | 中等质量证据（观察性研究、指南推荐） |
| C | 低质量证据（专家意见、病例报告） |
| D | 极低质量证据 |

## HTTP Chat 路径集成

### API 端点

Medical Agent 已集成到 HTTP Chat `/api/chat/generate` 路径，支持前端可视化。

**请求参数**：
```json
{
  "query": "二甲双胍禁忌症",
  "enableAgent": true,  // 可选，默认 true
  "topK": 5,
  "similarityThreshold": 0.0,
  "maxContextTokens": 4000
}
```

**响应结构**：
```json
{
  "query": "二甲双胍禁忌症",
  "results": [...],
  "thinking": "推理过程...",
  "answer": "最终回答...",
  "duration": 2500,
  "agentUsed": true,
  "agentSatisfied": true
}
```

### enableAgent 开关

- `enableAgent: true` - 启用 Agent 分析，发送可视化事件
- `enableAgent: false` - 禁用 Agent，直接进行检索

### LLMCaller 适配器

HTTP Chat 使用 LLMGenerationService 作为 Agent 的 LLMCaller：
```typescript
const llmCaller: LLMCaller = async (prompt: string) => {
  const result = await llmGenerationService.generateOnce({
    query: prompt,
    context: '',
    sources: [],
  });
  return result.answer;
};
```

## WebSocket 可视化事件

### agent:* 事件类型

Agent 执行过程通过 WebSocket 实时广播：

| 事件类型 | 触发时机 | 数据字段 |
|----------|----------|----------|
| `agent:input` | Agent 开始执行 | query |
| `agent:entities` | 实体识别完成 | entityMatches, keywordMatches |
| `agent:complexity` | 复杂度评估完成 | complexity |
| `agent:mode` | 执行模式选择 | executionMode, executionReason, matchedTemplate |
| `agent:query_rewrite` | 查询改写完成 | queryRewriting, query |
| `agent:template` | 模板匹配完成 | templateAttempts, matchedTemplate |
| `agent:dag` | DAG 构建（Planning） | dag |
| `agent:execution` | 执行进度更新 | executorState |
| `agent:complete` | Agent 执行完成 | agentResult |

### 事件数据格式

**agent:input**:
```json
{
  "type": "agent:input",
  "agentPhase": "input",
  "query": "二甲双胍禁忌症",
  "timestamp": 1234567890
}
```

**agent:entities**:
```json
{
  "type": "agent:entities",
  "agentPhase": "entities",
  "entityMatches": [
    {
      "matchedTerm": "二甲双胍",
      "canonicalName": "二甲双胍",
      "entityType": "drug",
      "confidence": 0.9
    }
  ],
  "timestamp": 1234567891
}
```

**agent:complexity**:
```json
{
  "type": "agent:complexity",
  "agentPhase": "complexity",
  "complexity": {
    "level": "simple",
    "needsPlanning": false,
    "entityCount": 1,
    "hasComparison": false,
    "hasConditions": false,
    "hasInteraction": false,
    "reason": "单实体查询，无需规划"
  },
  "timestamp": 1234567892
}
```

**agent:mode**:
```json
{
  "type": "agent:mode",
  "agentPhase": "mode",
  "executionMode": "react",
  "executionReason": "简单查询，使用 ReAct 循环",
  "matchedTemplate": null,
  "timestamp": 1234567893
}
```

**agent:query_rewrite**:
```json
{
  "type": "agent:query_rewrite",
  "agentPhase": "query_rewrite",
  "queryRewriting": {
    "primaryQuery": "二甲双胍 禁忌症 用法",
    "expandedTerms": ["Metformin", "格华止"]
  },
  "query": "二甲双胍禁忌症",
  "timestamp": 1234567894
}
```

**agent:complete**:
```json
{
  "type": "agent:complete",
  "agentPhase": "complete",
  "agentResult": {
    "satisfied": true,
    "retrievalCount": 5,
    "totalTimeMs": 1500,
    "iterations": 2,
    "llmCallCount": 3
  },
  "timestamp": 1234567990
}
```

### 前端订阅方式

前端通过 WebSocket 连接后，自动接收 agent:* 事件：
```typescript
// useWebSocket.ts 自动处理
if (event.type === 'agent:input') {
  useRetrievalStore.getState().handleAgentInput(event.query, event.timestamp);
}
if (event.type === 'agent:entities') {
  useRetrievalStore.getState().handleAgentEntities(event.entityMatches, event.keywordMatches);
}
// ... 其他事件
```

## Agent 执行阶段可视化

### 阶段说明

Agent 执行过程分为以下阶段，每个阶段都有对应的可视化输出：

| 阶段 | 说明 | 输出内容 |
|------|------|----------|
| **输入解析** | 接收用户查询 | 原始查询、时间戳 |
| **实体识别** | 识别医学实体 | 匹配术语、实体类型、置信度 |
| **复杂度评估** | 评估查询复杂度 | 复杂度级别、是否需要Planning |
| **模式选择** | 选择执行模式 | ReAct/Planning、选择原因 |
| **查询优化** | 构建检索策略 | 优化查询词、扩展术语 |
| **模板匹配** | Planning模式匹配模板 | 模板尝试过程、匹配结果 |
| **DAG构建** | Planning模式构建任务DAG | DAG结构、并行组 |
| **执行** | 执行检索任务 | 执行进度、任务状态 |
| **回答生成** | 生成结构化回答 | 最终答案、证据等级 |

### 双通道输出

Agent 提供两种可视化输出：

**1. MCP Tool 简要版（用户可见）**
- 在回答前插入"🔍 检索分析"章节
- 展示关键决策点：原始查询 → 实体识别 → 查询优化 → 执行路径
- 适合快速了解 Agent 决策过程

**2. Logger 完整版（调试可见）**
- 详细记录每个阶段的完整数据
- 包含模板匹配尝试过程（成功和失败）
- JSON格式的结构化日志
- 适合问题排查和性能分析

### 模板匹配过程可视化

Planning 模式的模板匹配过程会记录：

**简要版**:
```
**执行路径**: Planning → 模板匹配 → 药物对比DAG → 并行检索
```

**完整版** (通过 Logger 查看):
```
### 模板匹配尝试
- guideline_year_filter: ✗ (no year filter)
- drug_contraindication: ✗ (multiple drugs)
- decision_support_with_indicator: ✗ (no decision_support pattern)
- drug_comparison: ✓ 匹配成功
```

### 启用详细日志

```typescript
const executor = createAgentExecutor({
  enableTraceLogging: true,  // 启用完整可视化
}, context);
```

详细日志输出到 AgentLogger，可通过以下方式查看：
- Console 输出（debug级别）
- Logger 报告文件（如有配置）

## API 集成

### 创建 MedicalAgent（ReAct 模式）

```typescript
import { createAgentExecutor } from './medical/agent/AgentExecutor.js';
import { createLLMCaller } from './config/llm-config.js';

const llmCaller = createLLMCaller();
const executor = createAgentExecutor({
  maxIterations: 5,
  confidenceThreshold: 0.8,
  enablePlanning: false, // ReAct 模式
}, context);

const result = await executor.run(query);
```

### 创建 MedicalAgent（Planning 模式）

```typescript
const executor = createAgentExecutor({
  maxIterations: 5,
  confidenceThreshold: 0.8,
  enablePlanning: true,   // 启用 Planning
  maxReplanRounds: 2,     // 最大重规划轮数
}, context);

const result = await executor.run(complexQuery);
```

### 自定义配置

```typescript
const executor = createAgentExecutor({
  maxIterations: 5,
  confidenceThreshold: 0.8,
  retrievalTopK: 10,
  retrievalThreshold: 0.3,
  enablePlanning: true,
  maxReplanRounds: 2,
  enableQualityCheck: true,
  enableTraceLogging: true,
}, context);
```

## 常见问题

### Q: Agent 执行时间较长？

减少 `max_iterations`（默认5），或使用 `medical_query` 替代。

### Q: Planning 模式何时使用？

Planning 模式适合：
- 对比查询（如 "A vs B"）
- 多实体查询（≥2个药物/疾病）
- 综合分析查询

简单查询（单实体）会自动跳过 Planning。

### Q: 如何选择 ReAct vs Planning？

- ReAct：单实体、简单查询、需要多轮交互
- Planning：对比查询、多实体、需要并行检索

系统会自动根据复杂度选择模式。

### Q: 检索结果为空？

确保已上传相关医学指南文档，使用 `list_documents` 查看已索引文档。

### Q: LLM 配置问题？

检查环境变量设置：
```bash
echo $ANTHROPIC_API_KEY
echo $OPENAI_API_KEY
```

### Q: 如何查看 Agent 执行过程？

启用日志：
```typescript
const executor = createAgentExecutor({
  enableTraceLogging: true,
}, context);
```

### Q: Planning 失败会怎样？

Planning 失败会自动回退到 ReAct 模式，结果中包含 `fallbackReason`。

## 安全提示

⚠️ **重要提醒**：

- Medical Agent 生成的回答仅供参考
- 不构成医疗诊断或治疗建议
- 实际用药请咨询专业医生
- 系统可能存在知识更新滞后问题

## 故障排除

### 常见问题修复 (2026-04-23)

以下问题已在最近更新中修复：

#### Q: Agent 执行时间过长 (330秒+)？

**已修复**：Agent 循环现在在 `satisfied=true` 后立即终止。

修复前：循环不检查 `satisfied` 状态，导致 3 轮迭代
修复后：`satisfied=true` → 立即退出循环（1-2 轨）

```typescript
// AgentState.ts:154-161
export function canContinue(state: AgentState): boolean {
  return (
    state.status !== 'completed' &&
    state.status !== 'failed' &&
    !isMaxIterationsReached(state) &&
    !state.satisfied &&  // ✅ 新增检查
    !state.error
  );
}
```

#### Q: 空查询导致 500 错误？

**已修复**：空查询现在返回 400 错误而非崩溃。

修复前：`queryRewriting.primaryQuery=""` → HybridRetriever 崩溃 → 500 错误
修复后：空查询检测 → fallback 到原始查询 → 或返回 400 错误

```typescript
// chat.ts
if (!retrievalQuery || retrievalQuery.trim().length === 0) {
  return reply.status(400).send({ error: 'Invalid query' });
}
```

#### Q: 前端显示 "检索数量: 0" 但实际有结果？

**已修复**：ReAct 模式现在正确设置 `retrievalCount`。

修复前：ReAct 模式不调用 `setRetrievalResultCount` → count=0
修复后：循环结束时设置正确的 count

```typescript
// AgentExecutor.ts
const finalRetrievalCount = state.retrievalResults?.length ?? 0;
this.collector.setRetrievalResultCount(finalRetrievalCount);
```

#### Q: Agent 执行日志显示 queryRewriting 为空？

**已修复**：ReAct 模式现在生成 `queryRewriting` 可视化数据。

修复前：只有 Planning 模式调用 `collectQueryRewriting`
修复后：ReAct 模式在循环开始前也调用

### 仍然存在的问题

如果遇到以下问题：

- **LLM 响应超时**：检查 LLM API 连接，尝试使用本地模型
- **检索结果不相关**：上传更多领域相关的医学指南
- **实体识别错误**：检查术语词典配置 `config/synonyms.json`

## RAG 评估体系集成

### 概述

Medical Agent 已集成 8 维度 RAG 评估体系，自动评估每次查询的回答质量。

### 评估维度

| 维度 | 说明 | 权重 |
|------|------|------|
| Faithfulness (忠实度) | 答案是否忠实于检索内容，检测幻觉 | 20% |
| Context Relevance | 检索内容是否与问题相关 | 10% |
| Answer Relevance | 答案是否回答了问题 | 10% |
| Medical Accuracy | 术语使用正确性、指南符合度 | 20% |
| Safety Assessment | 禁忌检测、相互作用风险 | 20% |
| Evidence Traceability | 来源标注、引用准确性 | 10% |
| Completeness | 实体覆盖、问题覆盖 | 5% |
| Terminology Accuracy | 医疗术语使用准确性 | 5% |

### 风险等级

| 等级 | 阈值 | 处理建议 |
|------|------|----------|
| Safe | 综合分数 ≥ 85%, 安全 ≥ 85% | 正常发布 |
| Caution | 综合分数 ≥ 70%, 安全 ≥ 70% | 添加提示标记 |
| Warning | 综合分数 < 70% 或 安全 < 70% | 需人工审核 |
| Danger | 安全评估 < 50% | 阻止发布 |

### 异步评估模式

评估任务通过 Redis + Bull 队列异步执行，不阻塞 Agent 主流程。

```typescript
// Agent 执行后自动提交评估任务
import { createEvaluationQueue } from './queue/EvaluationQueue.js';
import { createTraceContext } from './tracing/TraceContext.js';

// 创建追踪上下文
const traceContext = createTraceContext();
traceContext.setQuery(query, queryRewriting.primaryQuery);
traceContext.setEntities(entities);
traceContext.recordRetrieval(retrievalResults);
traceContext.setAnswer(answer, confidence);
traceContext.complete();

// 提交评估任务（不阻塞，< 50ms）
const queue = await createEvaluationQueue();
const job = await queue.addJob(traceContext.build(), 'normal');

// Agent 立即返回，评估在后台执行
```

### 评估结果查询

```typescript
// 查询评估状态
const status = await queue.getJobStatus(job.id);

// 查询队列统计
const stats = await queue.getQueueStats();
console.log('等待:', stats.waiting);
console.log('执行:', stats.active);
console.log('完成:', stats.completed);
```

### 追踪数据持久化

追踪数据存储在 SQLite (`./data/traces.db`)：

```typescript
import { createTraceStorage } from './tracing/TraceStorage.js';

const storage = await createTraceStorage();

// 查询最近追踪记录
const traces = await storage.getRecentTraces(100);

// 查询评估趋势
const trends = await storage.getEvaluationTrends('7d');
```

### WebSocket 实时推送

评估进度和结果通过 WebSocket 实时推送：

```typescript
// 前端订阅
import { useStatsStore } from './store/statsStore';

const { evaluationMetrics, handleEvaluationUpdate } = useStatsStore();

// WebSocket 自动处理 'metrics:update' 事件
```

### 配置选项

```typescript
// 自定义权重配置
const customConfig = {
  weights: {
    faithfulness: 0.25,
    safetyAssessment: 0.25,
    medicalAccuracy: 0.20,
    // ... 其他维度
  },
  thresholds: {
    faithfulness: 0.75,
    safetyCritical: 0.60,
  },
};
```

### Docker 部署

```bash
# 启动所有服务（Redis + Worker）
docker-compose up -d

# 扩展 Worker 数量
docker-compose up -d --scale evaluation-worker=3

# 查看 Worker 日志
docker-compose logs -f evaluation-worker
```

### 监控界面

访问 `/admin/queues` 查看：
- 任务状态 (pending/active/completed/failed)
- 任务详情
- 手动重试/删除任务

---

**文档版本**: 2026-04-23
**最后更新**: RAG 评估体系集成