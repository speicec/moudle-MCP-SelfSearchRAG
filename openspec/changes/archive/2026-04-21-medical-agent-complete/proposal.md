---
status: proposed
created: 2026-04-21
schema: spec-driven
---

# Medical Agent Complete: 从工具到 Agent

## Problem

已完成的 Medical 模块（`medical-agent-endocrinology`）只是静态工具，缺少核心 Agent 能力：

1. **检索断点**：`processMedicalQuery()` 返回 `retrievalResults = undefined`
2. **无 LLM 推理**：缺少 `LLMCaller` 注入，无法生成专业医学回答
3. **无 Agent 循环**：无迭代决策机制（Think → Act → Observe → Decide）

**用户痛点示例**：
```
用户: "糖尿病患者合并肾功能不全，二甲双胍是否还能用？"

当前系统 (processMedicalQuery):
entities: { drugs: [二甲双胍], diseases: [糖尿病, CKD] }
strategy: { primaryQuery: "二甲双胍 肾功能...", prioritySources: [ADA] }
answer: {
  conclusion: { text: "识别到医学实体...", confidence: "low" }
  retrievalResults: undefined  ← 断点！
}

期望系统 (MedicalAgent):
## 结论
二甲双胍在肾功能不全患者中使用需谨慎，具体取决于eGFR水平。

## 详细说明
根据ADA 2024指南：
• eGFR ≥45: 可正常使用
• eGFR 30-45: 慎用，需减量
• eGFR <30: 禁用

## 证据等级
Grade B - ADA指南推荐

## 来源引用
1. ADA Standards 2024, Section 9
```

## Proposed Solution

创建独立的 **MedicalAgent** 类，实现完整 ReAct 循环：

### 1. Agent 循环层

```
while (!satisfied && iteration < maxIterations)
  THINK:  LLM 分析当前状态
  ACT:    executeAction (extract_entities | retrieve | expand_query)
  OBSERVE: evaluateEvidence(results)
  DECIDE:  LLM 判断是否满足
ANSWER:   LLM 生成结构化医学回答
```

### 2. LLM 集成层

- 创建 `MedicalReasoner` 封装 LLM 推理
- 支持 Claude API / OpenAI API / Ollama
- 推荐使用 Claude API（医学专业推理质量最高）

### 3. 检索集成层

- 将 `McpRetrievalService` 注入到 Agent
- 使用 `buildQueryStrategy()` 生成的查询策略
- 返回真实检索结果而非 `undefined`

### 4. MCP 注册层

- 注册 `medical_agent` 工具到 McpServer
- 实现 `MedicalAgentHandler` 处理调用

## Scope

| 组件 | 改动 |
|------|------|
| 新增 `src/medical/agent/` | Agent 核心模块 (7个文件) |
| 新增 `src/config/llm-config.ts` | LLM API 配置 |
| 新增 `src/mcp/medical-agent-handler.ts` | MCP Handler |
| 修改 `src/mcp/server.ts` | 注册 medical_agent tool |
| 修改 `src/medical/mcp-tool.ts` | 添加 retrieval 参数 |

## Dependencies

### 前置：需要上传医学指南文档

| 文档 | 来源 | 内容 |
|------|------|------|
| ADA Standards 2024 | ADA | 糖尿病诊疗标准 |
| KDIGO CKD Guidelines 2024 | KDIGO | 慢性肾脏病管理 |
| ESC/ESH Guidelines 2023 | ESC | 高血压药物治疗 |
| ATA Guidelines 2023 | ATA | 甲状腺疾病管理 |

### 配置：需要 LLM API Key

```
推荐: ANTHROPIC_API_KEY (Claude API)
备用: OPENAI_API_KEY (已有，用于 embedding)
本地: Ollama (免费，质量较低)
```

## Success Criteria

- [ ] Agent 循环完整实现（Think → Act → Observe → Decide → Answer）
- [ ] 检索集成工作（retrievalResults 不为 undefined）
- [ ] LLM 推理生成专业医学回答
- [ ] MCP tool `medical_agent` 可被 Claude Desktop 调用
- [ ] 端到端测试：复杂医学查询返回结构化回答

## Risks

| 风险 | 级别 | 缓解措施 |
|------|------|----------|
| LLM API 成本 | 中 | 支持多 LLM 后端，可选择本地 Ollama |
| Agent 循环复杂 | 中 | 清晰的状态管理 + 最大迭代限制 |
| 检索质量依赖文档 | 高 | 需用户上传高质量指南文档 |
| LLM 幻觉 | 高 | 强制引用来源 + 医嘱提醒 |

## Timeline

预计工作量：3-5 天

- Day 1: 基础集成（检索 + MCP注册）
- Day 2: LLM 集成（LLMCaller + MedicalReasoner）
- Day 3: Agent 循环（MedicalAgent + AgentExecutor）
- Day 4: 测试与文档
- Day 5: 端到端验证 + 优化

## Related Changes

- `medical-agent-endocrinology` (已完成): 词典、实体识别、回答模板
- 本次 change 在其基础上添加 Agent 循环和 LLM 集成