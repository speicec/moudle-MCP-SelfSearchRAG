# Medical Agent 使用指南

## 概述

Medical Agent 是一个专门针对内分泌领域医学知识检索的智能 Agent，实现了完整的 ReAct 循环（Think → Act → Observe → Decide → Answer）。

## 功能特性

- **医学实体识别**：自动识别疾病、药物、指标等专业术语
- **智能检索策略**：基于实体构建查询策略，支持术语扩展
- **ReAct 循环**：多轮推理决策，逐步完善检索结果
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

### 2. `medical_agent` - 完整 Agent 查询

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
```

## 证据等级说明

| Grade | 说明 |
|-------|------|
| A | 高质量证据（RCT、Meta分析） |
| B | 中等质量证据（观察性研究、指南推荐） |
| C | 低质量证据（专家意见、病例报告） |
| D | 极低质量证据 |

## API 集成

### 创建 MedicalAgent

```typescript
import { createMedicalAgent } from './medical/agent/index.js';
import { createLLMCaller } from './config/llm-config.js';

const llmCaller = createLLMCaller();
const agent = createMedicalAgent(llmCaller, retrievalFunction);

const result = await agent.run({
  query: '二甲双胍禁忌症',
  domain: 'diabetes',
});
```

### 自定义配置

```typescript
const agent = createMedicalAgent(llmCaller, retrieval, {
  maxIterations: 5,
  confidenceThreshold: 0.8,
  retrievalTopK: 10,
  retrievalThreshold: 0.3,
});
```

## 常见问题

### Q: Agent 执行时间较长？

减少 `max_iterations`（默认5），或使用 `medical_query` 替代。

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
const agent = createMedicalAgent(llmCaller, retrieval, {
  enableTraceLogging: true,
});
```

## 安全提示

⚠️ **重要提醒**：

- Medical Agent 生成的回答仅供参考
- 不构成医疗诊断或治疗建议
- 实际用药请咨询专业医生
- 系统可能存在知识更新滞后问题