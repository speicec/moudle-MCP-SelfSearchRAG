# QA-8: Medical Agent 完整实现 - 从工具到 Agent

> 问题：已实现的 Medical 模块（词典、实体识别、回答模板）只是静态工具，如何将其升级为完整的 Agent，实现自主决策、迭代检索、专业医学回答？

---

## 一、问题诊断：当前系统缺失

### 1.1 已完成的部分

```
✅ src/medical/
├── dictionaries/        # 词典数据 (500+实体)
│   ├── diseases.ts      # 疾病词典
│   ├── drugs/*.ts       # 药物词典
│   ├── indicators.ts    # 指标词典
│   ├── relations.ts     # 禁忌关系
│   ├── guidelines.ts    # 指南来源
│   └── aliases.ts       # 别名映射
├── entity-recognizer.ts # 实体识别器
├── query-planner.ts     # 查询规划器
├── evidence-evaluator.ts# 证据评估器
├── answer-generator.ts  # 回答生成器
├── mcp-tool.ts          # MCP 工具定义

✅ 93 个测试全部通过
✅ 实体识别功能验证：Ozempic → 司美格鲁肽，eGFR → 肾小球滤过率
```

### 1.2 核心缺失分析

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    GAP ANALYSIS - What's Missing                         │
└─────────────────────────────────────────────────────────────────────────┘

用户查询: "糖尿病患者合并肾功能不全，二甲双胍是否还能用"
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  1. Entity Recognizer ✅                                                 │
│     → { drugs: [二甲双胍], diseases: [糖尿病, CKD], indicators: [eGFR] }│
└─────────────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  2. Query Planner ✅                                                     │
│     → { primaryQuery, expandedTerms, prioritySources: [ADA, KDIGO] }    │
└─────────────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  3. Retrieval ❌ 断点！                                                   │
│     processMedicalQuery() 返回 retrievalResults = undefined             │
│     没有调用 McpRetrievalService.query()                                 │
└─────────────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  4. LLM Reasoning ❌ 断点！                                              │
│     没有注入 LLMCaller                                                   │
│     无法生成专业医学推理                                                  │
└─────────────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  5. Answer Generator ⚠️                                                  │
│     只返回模板结构，没有实际内容                                          │
│     conclusion.text = "识别到医学实体..."                                │
└─────────────────────────────────────────────────────────────────────────┘

问题链：Entity → Strategy → ❌ → ❌ → 空回答
```

---

## 二、三种架构方案对比

### Option 1: MCP Tool Integration (最小改动)

```
思路：注册 medical_query 为 MCP Tool，Claude Desktop 作为 Agent

Claude Desktop (Agent)
    │
    │ 自主决策调用 medical_query
    │ 可能多次调用，自行迭代
    ▼
McpServer
    medical_query → { entities, retrievalResults, strategy }
    ❌ 不做LLM推理，让 Claude Desktop 自己做

优点: ✓ 最小改动，只需集成检索
      ✓ Claude Desktop 自主决策
缺点: ✗ 无结构化医学回答格式保证
      ✗ Claude Desktop 不保证遵循医学规范
```

### Option 2: Enhanced Pipeline Integration

```
思路：将 Medical 模块与 EnhancedRetrievalPipeline 深度集成

MedicalEnhancedRetrievalPipeline extends EnhancedRetrievalPipeline:
    executeMedical(query):
        1. extractMedicalEntities(query)
        2. this.analyze(strategy.primaryQuery) ← 使用 LLM
        3. this.retriever.retrieve(...)
        4. evaluateEvidence(results)
        5. assembleMedicalContext(...)

优点: ✓ 利用现有 EnhancedRetrievalPipeline
      ✓ 有 LLMCaller 注入点
缺点: ✗ EnhancedRetrievalPipeline 未被 MCP Server 使用
      ✗ 更复杂的架构
```

### Option 3: Standalone Medical Agent (最终选择)

```
思路：创建独立的 MedicalAgent 类，实现完整的 ReAct 循环

┌─────────────────────────────────────────────────────────────────────────┐
│                     MedicalAgent (ReAct Loop)                            │
└─────────────────────────────────────────────────────────────────────────┘

while (!satisfied && iteration < maxIterations)
    │
    │ ┌─────────────────────────────────────────────────────────────────┐
    │ │ THINK: LLM 分析当前状态                                          │ │
    │ │ llmCaller("分析医学查询...")                                     │ │
    │ └─────────────────────────────────────────────────────────────────┘
    │ ▼
    │ ┌─────────────────────────────────────────────────────────────────┐
    │ │ ACT: 执行动作                                                    │ │
    │ │ if need entities: extractMedicalEntities                       │ │
    │ │ if need retrieval: retrieval.query(strategy)                   │ │
    │ │ if need specific info: query specific terms                    │ │
    │ └─────────────────────────────────────────────────────────────────┘
    │ ▼
    │ ┌─────────────────────────────────────────────────────────────────┐
    │ │ OBSERVE: 评估结果                                                │ │
    │ │ evaluateEvidence(results)                                       │ │
    │ └─────────────────────────────────────────────────────────────────┘
    │ ▼
    │ ┌─────────────────────────────────────────────────────────────────┐
    │ │ DECIDE: LLM 决策                                                 │ │
    │ │ llmCaller("结果是否足够？")                                      │ │
    │ │ → { satisfied: boolean, nextAction: string }                   │ │
    │ └─────────────────────────────────────────────────────────────────┘
    │ iteration++
end while

ANSWER: llmCaller("基于文献生成医学回答...", entities, results)

优点: ✓ 完整的 Agent 循环
      ✓ 自主决策、迭代优化
      ✓ 符合医学规范的结构化输出
缺点: ✗ 最大改动量
      ✗ 需要配置 LLM API
```

---

## 三、完整架构设计

### 3.1 系统集成架构

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    COMPLETE INTEGRATION ARCHITECTURE                     │
└─────────────────────────────────────────────────────────────────────────┘

MCP Client (Claude Desktop)
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                              McpServer                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│   tools: [                                                                │
│     medical_agent,      ← NEW: 完整 Agent                                │
│     medical_query,      ← 简化版(仅检索)                                  │
│     query,              ← existing                                       │
│     ingest_document,    ← existing                                       │
│   ]                                                                       │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          MedicalAgent                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│   Dependencies (injected):                                                │
│   • llmCaller: (prompt) => Promise<string>  ← Claude/OpenAI API          │
│   • retrieval: McpRetrievalService          ← Existing                   │
│   • medicalModule: EntityRecognizer etc.    ← Existing                   │
│                                                                           │
│   Sub-modules:                                                            │
│   • MedicalReasoner     ← LLM 推理逻辑                                    │
│   • AgentExecutor       ← ReAct 循环                                      │
│   • AgentState          ← 状态管理                                        │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
        │
        ├────────────────────────┐
        ▼                        ▼
┌───────────────────┐    ┌───────────────────┐
│ McpRetrievalService│    │   LLMCaller       │
│                   │    │                   │
│ .query(primaryQuery│    │ Options:          │
│   , { topK, ... }) │    │ A. Claude API     │
│                   │    │ B. OpenAI API      │
│ → RetrievalResult[]│    │ C. Ollama(local)  │
└───────────────────┘    └───────────────────┘
```

### 3.2 Agent 循环详细设计

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    MEDICAL AGENT EXECUTION FLOW                          │
└─────────────────────────────────────────────────────────────────────────┘

输入: { query: "糖尿病患者合并肾功能不全，二甲双胍是否还能用" }
                                    │
                                    ▼ ITERATION 1
┌─────────────────────────────────────────────────────────────────────────┐
│ THINK:                                                                   │
│ "用户询问二甲双胍肾功能禁忌，我需要识别实体并检索指南..."                │
│                                                                          │
│ entities = extractMedicalEntities(query)                                │
│ → { drugs: [二甲双胍], diseases: [糖尿病, CKD], indicators: [eGFR] }    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ ACT: retrieve                                                            │
│                                                                          │
│ strategy = buildQueryStrategy(entities)                                 │
│ → { primaryQuery: "二甲双胍 肾功能不全 禁忌",                            │
│     expandedTerms: ["Metformin", "格华止", "eGFR阈值", ...],            │
│     prioritySources: ["ADA 2024", "KDIGO 2024"] }                       │
│                                                                          │
│ results = retrieval.query(strategy.primaryQuery, { topK: 10 })          │
│ → [ADA 2024 Section 9片段, KDIGO 2024 CKD指南片段, ...]                │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ OBSERVE:                                                                 │
│                                                                          │
│ evidence = evaluateEvidence(results)                                    │
│ → { grade: "B", sourceType: "临床指南", isCurrent: true }              │
│                                                                          │
│ 内容检查: ADA指南包含 "eGFR<30禁用，30-45慎用"                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ DECIDE:                                                                  │
│                                                                          │
│ llmCaller("检索结果是否足够回答用户问题？")                              │
│ → { satisfied: true, reason: "ADA指南明确说明eGFR阈值" }                │
└─────────────────────────────────────────────────────────────────────────┘
                                    │ satisfied = true
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ ANSWER:                                                                  │
│                                                                          │
│ llmCaller(generateAnswerPrompt(entities, results))                      │
│                                                                          │
│ 输出:                                                                    │
│ ## 结论                                                                  │
│ 二甲双胍在肾功能不全患者中使用需谨慎，具体取决于eGFR水平。             │
│                                                                          │
│ ## 详细说明                                                              │
│ 根据ADA 2024指南：                                                       │
│ • eGFR ≥45: 可正常使用                                                  │
│ • eGFR 30-45: 慎用，需减量                                              │
│ • eGFR <30: 禁用                                                        │
│                                                                          │
│ ## 证据等级                                                              │
│ Grade B - ADA指南推荐                                                   │
│                                                                          │
│ ## 注意事项                                                              │
│ 本回答仅供参考，请遵医嘱                                                │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.3 LLM 集成选项

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    LLM INTEGRATION OPTIONS                               │
└─────────────────────────────────────────────────────────────────────────┘

Option A: OpenAI API
────────────────────
const llmCaller = async (prompt) => {
  const response = await openai.chat.completions.create({
    model: 'gpt-4-turbo',
    messages: [{ role: 'user', content: prompt }]
  });
  return response.choices[0].message.content;
};

依赖: OPENAI_API_KEY (已有)
优点: ✓ 简单，已有 key
缺点: ✗ 医学专业推理不如 Claude

Option B: Claude API (推荐)
───────────────────────────
const llmCaller = async (prompt) => {
  const response = await anthropic.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }]
  });
  return response.content[0].text;
};

依赖: ANTHROPIC_API_KEY (新增)
优点: ✓ 最适合医学专业推理
缺点: ✗ 需要新 API key

Option C: Local LLM
───────────────────
const llmCaller = async (prompt) => {
  const response = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    body: JSON.stringify({ model: 'llama3', prompt })
  });
  return response.json().response;
};

依赖: 本地 Ollama
优点: ✓ 无 API 成本，隐私
缺点: ✗ 医学推理质量差
```

---

## 四、文件结构规划

```
src/medical/agent/
├── index.ts                    # 导出
├── MedicalAgent.ts             # 核心 Agent 类
├── AgentState.ts               # 状态管理
├── AgentPrompts.ts             # LLM Prompt 模板
├── AgentExecutor.ts            # ReAct 循环执行
├── MedicalReasoner.ts          # LLM 推理逻辑
├── RetrievalIntegration.ts     # 检索集成
├── types.ts                    # Agent 类型定义
└── agent.test.ts               # 测试

src/config/
└── llm-config.ts               # LLM API 配置 (新增)

src/mcp/
├── server.ts                   # 注册 medical_agent tool (修改)
└── medical-agent-handler.ts    # Agent handler (新增)
```

---

## 五、实现路线图

```
Phase 1: 基础集成 (检索 + MCP注册) ───────────────────────────
Tasks:
├── 1.1 注册 medical_query 到 McpServer
├── 1.2 实现 MedicalQueryHandler
├── 1.3 集成 McpRetrievalService.query()
├── 1.4 测试基本检索流程

Phase 2: LLM 集成 ────────────────────────────────────────────
Tasks:
├── 2.1 创建 LLMCaller 工厂
├── 2.2 添加 ANTHROPIC_API_KEY 配置
├── 2.3 实现 MedicalReasoner
├── 2.4 实现 AgentPrompts

Phase 3: Agent 循环 ──────────────────────────────────────────
Tasks:
├── 3.1 实现 MedicalAgent 类
├── 3.2 实现 AgentExecutor (ReAct loop)
├── 3.3 实现 AgentState
├── 3.4 实现 medical_agent MCP tool

Phase 4: 测试与文档 ──────────────────────────────────────────
Tasks:
├── 4.1 单元测试 Agent 循环
├── 4.2 集成测试 MCP 调用
├── 4.3 端到端医学场景测试
├── 4.4 使用文档

Estimated effort: 3-5 days
```

---

## 六、关键决策记录

| 决策点 | 选择 | 原因 |
|--------|------|------|
| Agent架构 | Standalone MedicalAgent | 完整的ReAct循环，自主决策 |
| LLM选择 | Claude API (推荐) | 医学专业推理质量最高 |
| 检索集成 | McpRetrievalService | 已有成熟实现，Small-to-Big策略 |
| MCP工具 | 双工具设计 | medical_agent(完整) + medical_query(简化) |

---

## 七、前置条件

1. **上传医学指南文档**
   - ADA Standards 2024 (Section 9: Pharmacologic Approaches)
   - KDIGO CKD Guidelines 2024
   - ESC/ESH Hypertension Guidelines 2023
   - ATA Thyroid Guidelines 2023

2. **配置 LLM API**
   - 添加 ANTHROPIC_API_KEY 或 OPENAI_API_KEY
   - 或配置本地 Ollama

---

## 八、探索结论

**问题**：Medical 模块只是工具，缺少检索集成、LLM推理、Agent循环

**方案**：Standalone MedicalAgent + ReAct循环 + Claude API

**核心改动**：
- 新建 `src/medical/agent/` 目录
- 注入 LLMCaller + McpRetrievalService
- 注册 MCP tool `medical_agent`

**下一步**：退出探索模式，开始实现 tasks