# Medical Agent 使用指南

## 概述

Medical Agent 是一个专门针对内分泌领域医学知识检索的智能 Agent，支持双模式执行：
- **ReAct 模式**：完整循环（Think → Act → Observe → Decide → Answer）
- **Planning 模式**：PlanAndExecute 流程，支持任务分解、并行检索、动态重规划

## 功能特性

- **医学实体识别**：自动识别疾病、药物、指标等专业术语
- **智能检索策略**：基于实体构建查询策略，支持术语扩展
- **ReAct 循环**：多轮推理决策，逐步完善检索结果
- **Planning 模式**：任务 DAG 分解，并行检索，动态调整
- **LLM 推理**：使用 Claude/OpenAI/Ollama 进行临床推理
- **结构化回答**：包含结论、详细说明、证据等级、来源引用

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

Planning 模式内置 4 个结构化模板，零 LLM 调用：

| 模板名称 | 适用场景 | 任务数 |
|----------|----------|--------|
| 指南年份过滤 | 需要年份过滤的指南查询 | 3 |
| 药物禁忌检查 | 单药禁忌症查询 | 3 |
| 药物对比 | 多药物对比查询 | 5（含并行） |
| 指标药物查询 | 带指标值的禁忌检查 | 5（含并行） |

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