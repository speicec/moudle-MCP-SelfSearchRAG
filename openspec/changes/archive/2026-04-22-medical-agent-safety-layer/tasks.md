## 1. ThresholdExtractor 实现

- [x] 1.1 创建 `src/medical/threshold-extractor.ts`，定义 ThresholdCondition 类型
- [x] 1.2 实现 extractThresholds(text: string): ThresholdCondition[]
- [x] 1.3 实现运算符正则匹配（含 Unicode ≤≥）
- [x] 1.4 实现单位验证（与 indicators.ts 单位比对）
- [x] 1.5 编写 threshold-extractor.test.ts 测试文件

## 2. MedicalSafetyLayer 实现

- [x] 2.1 创建 `src/medical/safety-layer.ts`，定义 SafetyAssessment 类型
- [x] 2.2 实现 checkContraindications(drugs, thresholds): ContraindicationMatch[]
- [x] 2.3 实现 checkInteractions(drugs): DrugInteractionRelation[]
- [x] 2.4 实现 performSafetyCheck(entities, thresholds): SafetyAssessment
- [x] 2.5 添加指南来源引用（ADA, KDIGO 等）
- [x] 2.6 编写 safety-layer.test.ts 测试文件

## 3. Agent 类型扩展

- [x] 3.1 在 `src/medical/agent/types.ts` 添加 safetyAssessment?: SafetyAssessment
- [x] 3.2 在 AgentState 添加 evidenceEvaluation?: EvidenceEvaluation[]
- [x] 3.3 添加 ThresholdCondition 类型导出

## 4. MedicalAgent 集成

- [x] 4.1 在 MedicalAgent.execute() 开头调用 performSafetyCheck
- [x] 4.2 将 SafetyAssessment 存入 AgentState
- [x] 4.3 在 OBSERVE 阶段调用 evaluateMultipleSources
- [x] 4.4 将 EvidenceEvaluation 存入 AgentState

## 5. MedicalReasoner 三层综合

- [x] 5.1 修改 generateMedicalAnswer 参数，接收 safetyAssessment 和 evidenceEvaluation
- [x] 5.2 修改 parseAnswer，根据 severity 决定结论优先级
- [x] 5.3 修改 evidenceGrade 生成，使用 calculateOverallGrade 计算
- [x] 5.4 添加三层综合测试用例

## 6. entity-recognizer 扩展

- [x] 6.1 在 entity-recognizer.ts 导出 extractThresholds
- [x] 6.2 增强 extractIndicatorValue 支持运算符提取（已在 threshold-extractor.ts 实现）
- [x] 6.3 更新 entity-recognizer.test.ts（threshold-extractor.test.ts 已覆盖）

## 7. 集成测试

- [x] 7.1 编写 MedicalAgent 预检查集成测试
- [x] 7.2 编写三层综合端到端测试
- [x] 7.3 验证 GRADE 计算正确性
- [x] 7.4 验证禁忌匹配覆盖现有 relations.ts