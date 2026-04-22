# TaskPlanner Prompt 设计详解

## 一、核心设计思路

### 1.1 Planning 流程概览

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    TaskPlanner 设计目标                                       │
└─────────────────────────────────────────────────────────────────────────────┘

  输入                    处理                      输出
  ════                    ════                      ════

  Query                 LLM分解                 Task DAG
  Entities  ─────────▶  规则启发  ─────────▶  执行计划
  Context               依赖分析                优先级排序
```

### 1.2 核心挑战与解决策略

| 挑战 | 问题描述 | 解决策略 |
|------|----------|----------|
| 任务复杂度判断 | 简单查询不应过度Planning | 复杂度分级 + 预判断机制 |
| 并行机会识别 | 如何判断哪些任务可并行 | 依赖分析 + 无依赖标记并行 |
| Planning成本控制 | Planning本身有LLM调用成本 | 模板匹配优先 + 简单查询跳过 |

---

## 二、复杂度分级系统

### 2.1 分级标准

| 级别 | 特征 | 示例 | Planning策略 |
|------|------|------|--------------|
| simple | 单一实体，单一意图 | "二甲双胍禁忌症" | 跳过Planning，直接ReAct |
| moderate | 2-3实体，单一意图 | "糖尿病患者二甲双胍禁忌" | 单次Planning，简单DAG |
| complex | 多实体，对比/综合意图 | "二甲双胍和利拉鲁肽哪个更适合" | 多阶段Planning，允许Re-planning |
| structured | 明确的筛选条件 | "2024年ADA指南中二甲双胍推荐" | 确定性模板，无LLM Planning |

### 2.2 复杂度判断 Prompt

```typescript
const COMPLEXITY_ASSESSMENT_PROMPT = `
你是一个医学查询复杂度评估器。请评估以下查询的复杂度。

## 查询内容
"${query}"

## 已识别实体
- 疾病: ${entities.diseases.map(d => d.canonicalName).join(', ') || '无'}
- 莉物: ${entities.drugs.map(d => d.canonicalName).join(', ') || '无'}
- 指标: ${entities.indicators.map(i => i.canonicalName).join(', ') || '无'}
- 关系: ${entities.relations.map(r => r.type).join(', ') || '无'}

## 复杂度分级标准

| 级别 | 特征 | 示例 |
|------|------|------|
| simple | 单一实体，单一意图 | "二甲双胍禁忌症" |
| moderate | 2-3实体，单一意图 | "糖尿病患者二甲双胍禁忌" |
| complex | 多实体，对比/综合意图 | "二甲双胍和利拉鲁肽哪个更适合肾功能不全患者" |
| structured | 明确的筛选条件 | "2024年ADA指南中关于二甲双胍的推荐" |

## 请输出
仅输出一个复杂度级别: simple | moderate | complex | structured
`;
```

### 2.3 复杂度处理策略

```typescript
function handleComplexity(level: ComplexityLevel): PlanningStrategy {
  switch (level) {
    case 'simple':
      // 跳过Planning，直接使用现有ReAct流程
      return { 
        enablePlanning: false, 
        directExecute: true,
        fallbackToReAct: true 
      };
    
    case 'moderate':
      // 单次Planning，简单DAG
      return { 
        enablePlanning: true, 
        maxTasks: 3, 
        allowReplan: false,
        preferTemplate: true 
      };
    
    case 'complex':
      // 多阶段Planning，允许Re-planning
      return { 
        enablePlanning: true, 
        maxTasks: 6, 
        allowReplan: true,
        maxReplanRounds: 2 
      };
    
    case 'structured':
      // 结构化Planning，确定性流程
      return { 
        enablePlanning: true, 
        template: 'structured_search',
        skipLLMPlanning: true 
      };
  }
}
```

---

## 三、意图分析 Prompt

### 3.1 意图分析维度

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    意图分析维度矩阵                                            │
└─────────────────────────────────────────────────────────────────────────────┘

  维度1: 查询类型（多选）
  ─────────────────────────────────────────────────────────────────────────────
    □ 信息查询类    - 了解某药/某病信息
    □ 决策支持类    - 选择药物/治疗方案
    □ 安全检查类    - 禁忌/相互作用
    □ 解释理解类    - 为什么...
    □ 对比评估类    - A vs B

  维度2: 查询焦点
  ─────────────────────────────────────────────────────────────────────────────
    主要关注点     - 核心实体（需高优先级检索）
    次要关注点     - 辅助实体（可并行检索）

  维度3: 期望答案形式
  ─────────────────────────────────────────────────────────────────────────────
    简单结论       - Yes/No + 原因
    详细说明       - 步骤 + 证据
    对比表格       - 多选项比较
    流程指导       - 操作步骤

  维度4: 检索需求预测
  ─────────────────────────────────────────────────────────────────────────────
    必须检索       - 缺失则无法回答
    建议检索       - 提升答案质量
    可选检索       - 补充信息

  维度5: 特殊处理需求
  ─────────────────────────────────────────────────────────────────────────────
    calculateIndicator     - 是否需要计算指标（如eGFR分级）
    checkInteraction       - 是否需要检查相互作用
    checkContraindication  - 是否需要禁忌判断
    requireYearFilter      - 是否需要引用指南年份
```

### 3.2 意图分析 Prompt

```typescript
const INTENT_ANALYSIS_PROMPT = `
你是一个医学查询意图分析器。请分析用户查询的深层意图。

## 查询内容
"${query}"

## 已识别实体
${JSON.stringify(entities, null, 2)}

## 请分析以下维度

### 1. 查询类型（多选）
- [ ] 信息查询类（了解某药/某病信息）
- [ ] 决策支持类（选择药物/治疗方案）
- [ ] 安全检查类（禁忌/相互作用）
- [ ] 解释理解类（为什么...）
- [ ] 对比评估类（A vs B）

### 2. 查询焦点
- 主要关注点: <实体名称>
- 次要关注点: <实体名称>

### 3. 用户期望的答案形式
- 简单结论（Yes/No + 原因）
- 详细说明（步骤+证据）
- 对比表格（多选项比较）
- 流程指导（操作步骤）

### 4. 检索需求预测
- 必须检索: <关键词列表>
- 建议检索: <关键词列表>
- 可选检索: <关键词列表>

### 5. 特殊处理需求
- 是否需要计算指标（如eGFR分级）
- 是否需要检查相互作用
- 是否需要禁忌判断
- 是否需要引用指南年份

## 输出格式
{
  "queryTypes": ["<类型1>", "<类型2>"],
  "focus": {
    "primary": "<实体>",
    "secondary": ["<实体1>", "<实体2>"]
  },
  "expectedFormat": "<答案形式>",
  "retrievalNeeds": {
    "required": ["<关键词>"],
    "recommended": ["<关键词>"],
    "optional": ["<关键词>"]
  },
  "specialNeeds": {
    "calculateIndicator": true/false,
    "checkInteraction": true/false,
    "checkContraindication": true/false,
    "requireYearFilter": true/false
  }
}
`;
```

---

## 四、TaskPlanner 主 Prompt

### 4.1 可用工具定义

| 工具 | 用途 | 输入 | 输出 | 执行成本 |
|------|------|------|------|----------|
| extract_entities | 提取医学实体 | query | MedicalEntities | 低（词典匹配） |
| retrieve | 检索相关文档 | query, domain, topK | DocumentChunks | 中（向量搜索） |
| expand_query | 扩展查询词 | entities | expandedTerms | 低（LLM调用） |
| evaluate_evidence | 评估证据质量 | chunks, entities | EvidenceScores | 中（LLM调用） |
| calculate_indicator | 计算临床指标 | indicator, value | CalculatedResult | 低（公式计算） |
| check_interaction | 检查药物相互作用 | drug1, drug2 | InteractionResult | 中（词典+LLM） |
| check_contraindication | 检查禁忌关系 | drug, condition | ContraindicationResult | 中（词典+LLM） |
| generate_answer | 生成最终答案 | entities, evidence | MedicalAnswer | 高（LLM调用） |

### 4.2 任务规划规则

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    任务规划规则矩阵                                            │
└─────────────────────────────────────────────────────────────────────────────┘

  规则1: 任务分解原则
  ─────────────────────────────────────────────────────────────────────────────
    • 每个任务对应单一工具调用
    • 任务目标明确，输入输出清晰
    • 任务粒度适中，避免过度分解
    • 最大任务数限制: complex=6, moderate=3

  规则2: 依赖关系判断
  ─────────────────────────────────────────────────────────────────────────────
    • 数据依赖    - 后任务需要前任务输出 → 必须串行
    • 无依赖      - 两个任务独立处理 → 可以并行
    • 条件依赖    - 根据前任务结果决定执行 → 条件分支

  规则3: 并行优化
  ─────────────────────────────────────────────────────────────────────────────
    • 尽量识别并行机会
    • 并行任务处理独立实体
    • 避免资源竞争（外部API限流）
    • 最大并行度: retrieve=3, externalAPI=2

  规则4: 优先级设置
  ─────────────────────────────────────────────────────────────────────────────
    • 核心检索任务     - priority = 1-2
    • 辅助检索任务     - priority = 3-4
    • 评估/分析任务    - priority = 5-6
    • 答案生成任务     - priority = 7
```

### 4.3 TaskPlanner Prompt

```typescript
const TASK_PLANNER_PROMPT = `
你是一个医学任务规划器。请分析查询并生成任务执行计划。

## 输入信息

### 用户查询
"${query}"

### 已识别实体
| 类型 | 名称 | 别名 |
|------|------|------|
| 疾病 | ${entities.diseases.map(d => `${d.canonicalName} (${d.aliases.join('/')})`).join('\n') || '无'} |
| 莉物 | ${entities.drugs.map(d => `${d.canonicalName} (${d.aliases.join('/')})`).join('\n') || '无'} |
| 指标 | ${entities.indicators.map(i => `${i.canonicalName}${i.value ? `=${i.value}` : ''}`).join('\n') || '无'} |
| 关系 | ${entities.relations.map(r => r.matchedTerm).join('\n') || '无'} |

### 用户意图分析
${intentAnalysis}

### 查询复杂度
${complexity}

## 可用工具及其用途

| 工具 | 用途 | 输入 | 输出 |
|------|------|------|------|
| extract_entities | 提取医学实体 | query | MedicalEntities |
| retrieve | 检索相关文档 | query, domain, topK | DocumentChunks |
| expand_query | 扩展查询词 | entities | expandedTerms |
| evaluate_evidence | 评估证据质量 | chunks, entities | EvidenceScores |
| calculate_indicator | 计算临床指标 | indicator, value | CalculatedResult |
| check_interaction | 检查药物相互作用 | drug1, drug2 | InteractionResult |
| check_contraindication | 检查禁忌关系 | drug, condition | ContraindicationResult |
| generate_answer | 生成最终答案 | entities, evidence | MedicalAnswer |

## 任务规划规则

### 规则1: 任务分解原则
- 每个任务对应单一工具调用
- 任务目标明确，输入输出清晰
- 任务粒度适中，避免过度分解

### 规则2: 依赖关系判断
- 数据依赖: 后任务需要前任务的输出作为输入 → 必须串行
- 无依赖: 两个任务独立处理不同数据 → 可以并行
- 条件依赖: 后任务根据前任务结果决定是否执行 → 条件分支

### 规则3: 并行优化
- 尽量识别并行机会，减少总执行时间
- 并行任务应处理独立实体（如疾病检索和药物检索）
- 避免资源竞争（如同时调用外部API）

### 规则4: 优先级设置
- 核心检索任务: priority = 1-2 (高优先级)
- 辅助检索任务: priority = 3-4 (中优先级)
- 评估/分析任务: priority = 5-6 (低优先级)
- 答案生成任务: priority = 7 (最后执行)

## 任务规划示例

### 示例1: 简单禁忌查询
查询: "二甲双胍禁忌症"
任务计划:
{
  "tasks": [
    {"id": "t1", "type": "retrieve", "params": {"query": "二甲双胍禁忌症"}, "dependencies": [], "priority": 1},
    {"id": "t2", "type": "generate_answer", "params": {}, "dependencies": ["t1"], "priority": 7}
  ],
  "parallelGroups": []
}

### 示例2: 多实体并行检索
查询: "糖尿病患者二甲双胍和利拉鲁肽哪个更适合"
任务计划:
{
  "tasks": [
    {"id": "t1", "type": "retrieve", "params": {"query": "糖尿病治疗指南"}, "dependencies": [], "priority": 1},
    {"id": "t2", "type": "retrieve", "params": {"query": "二甲双胍适应症禁忌症"}, "dependencies": [], "priority": 1},
    {"id": "t3", "type": "retrieve", "params": {"query": "利拉鲁肽适应症禁忌症"}, "dependencies": [], "priority": 1},
    {"id": "t4", "type": "check_interaction", "params": {"drugs": ["二甲双胍", "利拉鲁肽"]}, "dependencies": [], "priority": 2},
    {"id": "t5", "type": "evaluate_evidence", "params": {}, "dependencies": ["t1","t2","t3"], "priority": 5},
    {"id": "t6", "type": "generate_answer", "params": {"mode": "comparison"}, "dependencies": ["t5"], "priority": 7}
  ],
  "parallelGroups": [["t1", "t2", "t3", "t4"]]
}

### 示例3: 指标条件查询
查询: "eGFR=35的肾功能不全患者能用二甲双胍吗"
任务计划:
{
  "tasks": [
    {"id": "t1", "type": "retrieve", "params": {"query": "二甲双胍肾功能禁忌"}, "dependencies": [], "priority": 1},
    {"id": "t2", "type": "retrieve", "params": {"query": "eGFR阈值指南"}, "dependencies": [], "priority": 1},
    {"id": "t3", "type": "check_contraindication", "params": {"drug": "二甲双胍", "indicator": "eGFR", "value": 35}, "dependencies": ["t1", "t2"], "priority": 3},
    {"id": "t4", "type": "generate_answer", "params": {}, "dependencies": ["t3"], "priority": 7}
  ],
  "parallelGroups": [["t1", "t2"]]
}

## 请生成任务计划

根据以上输入和规则，请生成 JSON 格式的任务计划：

{
  "tasks": [
    {
      "id": "<task_id>",
      "type": "<tool_type>",
      "params": { <tool_parameters> },
      "dependencies": ["<dependent_task_ids>"],
      "priority": <1-7>,
      "expectedOutput": "<output_description>",
      "fallbackStrategy": "<if_task_fails>"
    }
  ],
  "parallelGroups": [["<parallel_task_ids>"]],
  "executionStrategy": {
    "maxConcurrency": <number>,
    "timeoutPerTask": <milliseconds>,
    "retryCount": <number>,
    "replanThreshold": <confidence_score>
  },
  "estimatedComplexity": {
    "totalTasks": <number>,
    "maxDepth": <dag_depth>,
    "parallelOpportunities": <number>
  }
}

请确保:
1. 所有依赖关系正确（被依赖的任务必须先定义）
2. parallelGroups中的任务确实无依赖冲突
3. priority值合理（依赖任务priority应低于被依赖任务）
4. 包含fallbackStrategy以防任务失败
`;
```

---

## 五、结构化查询模板

### 5.1 确定性模板定义

```typescript
const STRUCTURED_TEMPLATES: Record<string, TaskDAGTemplate> = {
  // 指南年份过滤查询
  guideline_year_filter: {
    tasks: [
      { id: 't1', type: 'retrieve', params: { yearFilter: true }, dependencies: [], priority: 1 },
      { id: 't2', type: 'evaluate_evidence', params: {}, dependencies: ['t1'], priority: 5 },
      { id: 't3', type: 'generate_answer', params: {}, dependencies: ['t2'], priority: 7 }
    ],
    parallelGroups: []
  },

  // 莉物禁忌检查
  drug_contraindication: {
    tasks: [
      { id: 't1', type: 'retrieve', params: { queryType: 'contraindication' }, dependencies: [], priority: 1 },
      { id: 't2', type: 'check_contraindication', params: {}, dependencies: ['t1'], priority: 3 },
      { id: 't3', type: 'generate_answer', params: { format: 'safety' }, dependencies: ['t2'], priority: 7 }
    ],
    parallelGroups: []
  },

  // 莉物对比查询
  drug_comparison: {
    tasks: [
      { id: 't1', type: 'retrieve', params: { entity: 'drug1' }, dependencies: [], priority: 1 },
      { id: 't2', type: 'retrieve', params: { entity: 'drug2' }, dependencies: [], priority: 1 },
      { id: 't3', type: 'check_interaction', params: {}, dependencies: [], priority: 2 },
      { id: 't4', type: 'evaluate_evidence', params: {}, dependencies: ['t1', 't2'], priority: 5 },
      { id: 't5', type: 'generate_answer', params: { format: 'comparison' }, dependencies: ['t3', 't4'], priority: 7 }
    ],
    parallelGroups: [['t1', 't2', 't3']]
  },

  // 指标+莉物综合查询
  indicator_drug_query: {
    tasks: [
      { id: 't1', type: 'retrieve', params: { entity: 'drug' }, dependencies: [], priority: 1 },
      { id: 't2', type: 'retrieve', params: { entity: 'indicator' }, dependencies: [], priority: 1 },
      { id: 't3', type: 'calculate_indicator', params: {}, dependencies: ['t2'], priority: 2 },
      { id: 't4', type: 'check_contraindication', params: {}, dependencies: ['t1', 't3'], priority: 3 },
      { id: 't5', type: 'generate_answer', params: {}, dependencies: ['t4'], priority: 7 }
    ],
    parallelGroups: [['t1', 't2']]
  }
};
```

### 5.2 模板匹配规则

```typescript
function matchTemplate(intentAnalysis: IntentAnalysis, entities: MedicalEntities): TaskDAGTemplate | null {
  // 年份过滤优先
  if (intentAnalysis.specialNeeds.requireYearFilter) {
    return STRUCTURED_TEMPLATES.guideline_year_filter;
  }
  
  // 指标+莉物组合
  if (intentAnalysis.specialNeeds.checkContraindication && 
      entities.drugs.length === 1 && 
      entities.indicators.length > 0) {
    return STRUCTURED_TEMPLATES.indicator_drug_query;
  }
  
  // 莉物对比
  if (intentAnalysis.queryTypes.includes('对比评估类') && 
      entities.drugs.length >= 2) {
    return STRUCTURED_TEMPLATES.drug_comparison;
  }
  
  // 单莉物禁忌
  if (intentAnalysis.specialNeeds.checkContraindication &&
      entities.drugs.length === 1 &&
      entities.indicators.length === 0) {
    return STRUCTURED_TEMPLATES.drug_contraindication;
  }
  
  // 无匹配模板，使用LLM Planning
  return null;
}
```

---

## 六、Re-planning Prompt

```typescript
const REPLANNING_PROMPT = `
你是一个医学任务动态调整器。当前任务执行结果不满足要求，请分析并调整计划。

## 原始查询
"${query}"

## 原始任务计划
${JSON.stringify(originalPlan, null, 2)}

## 执行结果摘要

### 已完成任务
| 任务ID | 类型 | 成功 | 输出摘要 |
|--------|------|------|----------|
${completedTasks.map(t => `| ${t.id} | ${t.type} | ${t.success ? '✓' : '✗'} | ${t.outputSummary} |`).join('\n')}

### 失败任务
${failedTasks.map(t => `- ${t.id}: ${t.error}`).join('\n') || '无'}

### 检索覆盖度分析
- 检索到的文档数: ${retrievalStats.total}
- 覆盖实体数: ${retrievalStats.entitiesCovered}
- 高置信度文档数: ${retrievalStats.highConfidence}
- 缺失实体: ${retrievalStats.missingEntities.join(', ') || '无'}

### 答案生成测试结果
- 置信度: ${answerTest.confidence}
- 覆盖度: ${answerTest.coverage}
- 问题: ${answerTest.issues.join(', ')}

## 不满足的原因分析
${unsatisfiedReason}

## 请生成补充任务计划

基于现有执行结果，生成补充任务：

{
  "supplementalTasks": [
    {
      "id": "s1",
      "type": "<tool_type>",
      "params": { <params> },
      "reason": "<为什么需要这个任务>",
      "dependencies": ["<依赖的原任务ID>"],
      "priority": <number>
    }
  ],
  "tasksToRetry": [
    {
      "id": "<原任务ID>",
      "adjustedParams": { <新参数> },
      "reason": "<为什么调整参数>"
    }
  ],
  "tasksToSkip": ["<可以跳过的任务ID>"],
  "revisedExecutionStrategy": {
    "maxConcurrency": <number>,
    "additionalTimeout": <milliseconds>
  }
}

请确保补充任务:
1. 针对缺失实体或有问题的部分
2. 利用已完成任务的结果
3. 不重复已成功的任务
4. 总补充任务数不超过3个
`;
```

---

## 七、完整Planning流程

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    TaskPlanner 完整执行流程                                    │
└─────────────────────────────────────────────────────────────────────────────┘

  Query + Entities
         │
         ▼
  ┌─────────────────────┐
  │  复杂度预判断        │  ← COMPLEXITY_ASSESSMENT_PROMPT
  │  (轻量LLM调用)       │     约150 tokens
  └─────────────────────┘
         │
         ├──── simple ────────────────────▶ 直接ReAct执行（跳过Planning）
         │
         ▼
  ┌─────────────────────┐
  │  意图分析           │  ← INTENT_ANALYSIS_PROMPT
  │                     │     约300 tokens
  └─────────────────────┘
         │
         ▼
  ┌─────────────────────┐
  │  模板匹配           │  ← STRUCTURED_TEMPLATES（无LLM调用）
  │                     │
  │  是否匹配确定性模板？│
  └─────────────────────┘
         │
         ├──── 匹配 ─────────────────────▶ 使用模板DAG（无LLM调用）
         │
         ▼
  ┌─────────────────────┐
  │  LLM Planning       │  ← TASK_PLANNER_PROMPT
  │                     │     约700 tokens
  └─────────────────────┘
         │
         ▼
  ┌─────────────────────┐
  │  DAG验证            │  ← 规则验证（无LLM调用）
  │                     │     详细设计见下一文档
  └─────────────────────┘
         │
         ├──── valid=false ──────────────▶ 修正计划或重新Planning
         │
         ▼
  ┌─────────────────────┐
  │  TaskExecutor       │
  │                     │
  │  DAG遍历执行        │
  │  并行调度           │
  │  结果收集           │
  └─────────────────────┘
         │
         ▼
  ┌─────────────────────┐
  │  结果检查           │  ← 阈值判断（见下一文档）
  │                     │
  │  覆盖度评估         │
  │  置信度计算         │
  └─────────────────────┘
         │
         ├──── satisfied ────────────────▶ generate_answer
         │
         ▼
  ┌─────────────────────┐
  │  Re-planning        │  ← REPLANNING_PROMPT
  │                     │     约400 tokens
  └─────────────────────┘
         │
         └────────────────────────────────▶ 回到TaskExecutor
```

---

## 八、LLM调用成本分析

### 8.1 调用成本矩阵

| 场景 | LLM调用次数 | Token消耗 | 延迟估算 |
|------|-------------|-----------|----------|
| 简单查询(跳过Planning) | 0次 | 0 tokens | 0ms |
| 模板匹配 | 1次复杂度判断 | ~150 tokens | ~200ms |
| LLM Planning | 2次(复杂度+Planning) | ~850 tokens | ~1.5s |
| Re-planning | +1次 | ~400 tokens | ~500ms |
| Reflection循环 | +1次 | ~300 tokens | ~400ms |

### 8.2 成本优化策略

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Planning成本优化决策树                                      │
└─────────────────────────────────────────────────────────────────────────────┘

                    查询进入
                        │
                        ▼
              ┌─────────────────────┐
              │  实体数量判断        │
              │  (纯规则，无LLM)     │
              │                     │
              │  diseases + drugs   │
              │  + indicators ≤ 1   │
              └─────────────────────┘
                        │
              ┌─────────┴─────────┐
              │                   │
           ≤1实体             >1实体
              │                   │
              ▼                   ▼
        跳过Planning      ┌─────────────────────┐
        (零成本)          │  复杂度LLM判断       │
                        │  (轻量: ~150 tokens) │
                        └─────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
               simple/moderate    complex/structured
                    │                   │
                    ▼                   ▼
              模板匹配优先       LLM Planning
              (无LLM调用)        (重量: ~700 tokens)
```

---

## 九、并发控制策略

### 9.1 并发限制配置

```typescript
interface ConcurrencyConfig {
  // 最大并行检索任务数
  maxParallelRetrieval: number;  // 建议: 3
  
  // 最大并行外部API调用数
  maxParallelExternalAPI: number; // 建议: 2
  
  // 同类型任务并行限制（避免资源竞争）
  sameTypeLimit: Record<AgentActionType, number>;
}

const DEFAULT_CONCURRENCY: ConcurrencyConfig = {
  maxParallelRetrieval: 3,     // 同时检索3个实体
  maxParallelExternalAPI: 2,   // 外部API有速率限制
  sameTypeLimit: {
    retrieve: 3,
    check_interaction: 1,      // 莉物相互作用API可能有限制
    check_contraindication: 1,
    calculate_indicator: 2,
    evaluate_evidence: 1,      // 评估需要完整检索结果
    generate_answer: 1
  }
};
```

### 9.2 失败恢复策略

```typescript
const FALLBACK_STRATEGIES: Record<AgentActionType, FallbackStrategy> = {
  retrieve: {
    type: 'retry',
    config: { retryCount: 2, retryDelay: 1000 }
  },
  
  check_interaction: {
    type: 'alternative',
    config: { 
      alternativeTask: { 
        type: 'retrieve', 
        params: { query: '莉物相互作用' } 
      } 
    }
  },
  
  calculate_indicator: {
    type: 'skip'  // 指标计算失败不影响答案生成
  },
  
  evaluate_evidence: {
    type: 'skip'  // 评估失败可使用默认评分
  },
  
  generate_answer: {
    type: 'abort'  // 答案生成失败必须处理
  }
};
```

---

## 十、后续深入设计

以下内容将在独立文档中详细设计：

1. **Re-planning 触发阈值设计** - 量化触发条件
2. **DAG验证自动化规则** - 无LLM调用的验证机制
3. **并行执行调度实现** - Promise调度策略

详见：
- `docs/agent-replanning-thresholds.md`
- `docs/agent-dag-validation.md`