## Why

当前 Medical Agent 的"医疗身份"薄弱，核心问题是：**Agent 拥有完整的医疗基础设施（禁忌词典、证据评估器、阈值关系），但 Agent 循环并未主动使用这些模块**。

具体表现：
1. **禁忌阈值匹配**: `relations.ts` 中有精确的禁忌条件（如 eGFR < 30 禁用二甲双胍），但 Agent 从未匹配患者指标值
2. **GRADE 被动提取**: `evidence-evaluator.ts` 能计算证据等级，但 Agent 从 LLM 输出中被动提取而非主动计算
3. **数值提取不完整**: `entity-recognizer.ts` 能提取数值，但丢失运算符（<, >, =）和单位验证

这导致 Agent 行为更像"通用 RAG + 医学提示词"，而非真正的"医学推理 Agent"。

## What Changes

引入 **MedicalSafetyLayer** - Agent 循环前的预检查层，主动运用医疗知识：

```
原有流程:
Query → Entity Recognition → Agent Loop → Answer

新流程:
Query → Entity Recognition → Threshold Extraction → MedicalSafetyLayer → Agent Loop → Synthesis Answer
         │                                              │                    │
         └─ 扩展: 提取 {indicator, operator, value}     └─ 词典判断优先      └─ 三层综合
```

核心变更：
1. **ThresholdExtractor**: 扩展 entity-recognizer，提取完整阈值条件
2. **MedicalSafetyLayer**: 预检查层，输出 SafetyAssessment
3. **EvidenceEvaluator 集成**: OBSERVE 阶段调用，输出 EvidenceEvaluation
4. **三层综合 Answer**: 词典判断 > 检索补充 > 证据质量

## Capabilities

### New Capabilities
- `safety-layer`: 预检查层，禁忌阈值匹配 + 药物相互作用检测
- `threshold-extractor`: 扩展 entity-recognizer，提取完整阈值条件
- `evidence-integration`: EvidenceEvaluator 与 Agent 循环集成

### Modified Capabilities
- `answer-generation`: MedicalReasoner.parseAnswer 综合三层信息，GRADE 从计算而非提取

## Impact

### 新增文件
- `src/medical/safety-layer.ts` - MedicalSafetyLayer 主逻辑
- `src/medical/threshold-extractor.ts` - ThresholdExtractor 扩展

### 修改文件
- `src/medical/entity-recognizer.ts` - 添加 ThresholdExtractor 导出
- `src/medical/agent/MedicalAgent.ts` - 预检查 + EvidenceEvaluator 集成
- `src/medical/agent/MedicalReasoner.ts` - parseAnswer 三层综合
- `src/medical/agent/types.ts` - AgentState 新增 safetyAssessment、evidenceEvaluation

### 依赖
- 现有 `relations.ts` 禁忌词典 - 被实际调用
- 现有 `evidence-evaluator.ts` - 被实际调用
- 现有 `indicators.ts` - 单位验证