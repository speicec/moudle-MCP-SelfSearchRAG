## Context

### 现有医疗基础设施（未被使用）

```
src/medical/
├── dictionaries/
│   ├── relations.ts      ← 禁忌阈值定义 (METFORMIN_CONTRAINDICATIONS)
│   ├── indicators.ts     ← 指标单位参考
│   └── drugs/            ← 药物分类
├── evidence-evaluator.ts ← GRADE 计算 (evaluateMultipleSources)
└── entity-recognizer.ts  ← 数值提取 (extractIndicatorValue)
```

### Agent 当前流程

```
MedicalAgent.execute()
    │
    ├─ extractMedicalEntities(query)  → 只提取实体名，丢失运算符
    ├─ Agent Loop (Think → Act → Observe → Decide)
    │   └─ Observe: 只收集 retrievalResults，不调用 evidence-evaluator
    ├─ generateMedicalAnswer()
    │   └─ parseAnswer: GRADE 从 LLM 输出提取 ← 问题所在
    └
```

## Goals / Non-Goals

**Goals:**
1. Agent 循环前执行禁忌阈值匹配
2. OBSERVE 阶段调用 EvidenceEvaluator
3. Answer 生成综合三层信息，GRADE 计算而非提取
4. 提取完整阈值条件（含运算符）

**Non-Goals:**
- 不修改 LLM 提示词模板（AgentPrompts.ts）
- 不扩展词典内容（只使用现有 relations.ts）
- 不改变 Agent 循环核心结构（Think/Act/Observe/Decide）

## Decisions

### Decision 1: ThresholdExtractor 架构

```
输入: "eGFR < 30 mL/min/1.73m² 禁用二甲双胍"
输出: ThresholdCondition[] = [
  {
    indicator: "indicator_egfr",
    operator: "<",
    value: 30,
    unit: "mL/min/1.73m²",
    isValidUnit: true  ← 与 indicators.ts 验证
  }
]
```

**实现位置**: `src/medical/threshold-extractor.ts`

**核心逻辑**:
```typescript
const OPERATOR_PATTERN = /[<>=≤≥]/;
const VALUE_PATTERN = /(\d+\.?\d*)/;
const UNIT_PATTERN = /(mL\/min|mmol\/L|mg\/dL|%)/i;

export function extractThresholds(text: string): ThresholdCondition[] {
  // 1. 先匹配指标名 (利用现有 matchIndicators)
  // 2. 在指标附近 ±30 字符查找运算符+数值+单位
  // 3. 单位验证 (与 indicators.ts 单位比对)
}
```

### Decision 2: MedicalSafetyLayer 输出结构

```typescript
interface SafetyAssessment {
  severity: 'absolute' | 'relative' | 'interaction' | 'safe';
  thresholdMatch?: {
    condition: ThresholdCondition;   // 匹配的条件
    relation: ContraindicationRelation; // 对应的禁忌规则
  };
  interactions?: DrugInteractionRelation[];
  recommendation: string;
  sourceGlossary: string[];  // 引用的指南来源 (ADA, KDIGO 等)
}
```

**预检查流程**:
```
Query
  │
  ├─ extractMedicalEntities() → entities
  ├─ extractThresholds() → thresholdConditions
  ├─ checkContraindications(entities.drugs, thresholdConditions)
  │   └─ 遍历 relations.ts，匹配 threshold 条件
  ├─ checkInteractions(entities.drugs)
  │   └─ 遍历 relations.ts DRUG_INTERACTIONS
  └
  → SafetyAssessment
```

### Decision 3: EvidenceEvaluator 集成位置

**集成点**: AgentState 的 OBSERVE 阶段

```typescript
// AgentLoop.executeAction() 中
case 'retrieve':
  const results = await retriever.retrieve(query);
  
  // 新增: 评估证据质量
  const evaluations = evaluateMultipleSources(
    results.map(r => r.source)
  );
  
  state.evidenceEvaluation = evaluations;  // 存入 AgentState
```

### Decision 4: 三层综合优先级

```
┌─────────────────────────────────────────────────────────────────┐
│                    SYNTHESIS PRIORITY                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  severity = "absolute"                                          │
│  → 结论 = 禁忌判断 (词典优先)                                   │
│  → details = 禁忌原因 + 替代方案                                │
│  → 不再引用检索结果的用药建议                                    │
│                                                                 │
│  severity = "relative"                                          │
│  → 结论 = 慎用 + 检索调整建议                                   │
│  → details = 阈值说明 + 剂量调整 + 监测要求                     │
│                                                                 │
│  severity = "interaction"                                       │
│  → 结论 = 相互作用警告                                          │
│  → details = 受影响药物 + 处理建议                              │
│                                                                 │
│  severity = "safe"                                              │
│  → 结论 = 检索结果综合                                          │
│  → evidenceGrade = calculateOverallGrade(evaluations)           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Decision 5: GRADE 计算方式改变

**之前**:
```typescript
// MedicalReasoner.parseAnswer
private extractGrade(response: string): GradeLevel {
  if (response.includes('GRADE A')) return 'A';  // ← 从 LLM 输出提取
}
```

**之后**:
```typescript
// MedicalReasoner.parseAnswer
evidenceGrade: {
  grade: calculateOverallGrade(state.evidenceEvaluation), // ← 从计算获得
  sourceType: state.evidenceEvaluation[0]?.literatureType,
}
```

## Risks / Trade-offs

### Risk 1: 预检查增加延迟
- **影响**: 每次查询多一次词典匹配
- **缓解**: 词典规模小（<100条），O(n)匹配足够快

### Risk 2: 阈值提取精度
- **影响**: 用户输入格式多样，正则可能漏匹配
- **缓解**: 常见格式测试 + 运算符 Unicode 支持（≤≥）

### Trade-off: LLM 提示词不变
- **选择**: 保持 AgentPrompts.ts 不变，答案生成逻辑在 parseAnswer 综合
- **原因**: 提示词改动影响面大，综合逻辑可验证