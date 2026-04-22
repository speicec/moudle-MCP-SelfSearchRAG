## ADDED Requirements

### Requirement: Threshold Extraction
系统能从用户查询中提取完整的临床阈值条件，包含指标、运算符、数值和单位。

#### Scenario: 提取简单阈值
- **WHEN** 用户输入 "eGFR < 30 禁用二甲双胍"
- **THEN** 系统提取 ThresholdCondition = { indicator: "indicator_egfr", operator: "<", value: 30 }

#### Scenario: 提取带单位阈值
- **WHEN** 用户输入 "血糖 > 7.8 mmol/L"
- **THEN** 系统提取 ThresholdCondition = { indicator: "indicator_glucose", operator: ">", value: 7.8, unit: "mmol/L", isValidUnit: true }

#### Scenario: 多阈值提取
- **WHEN** 用户输入 "eGFR=45，HbA1c 8.5%"
- **THEN** 系统提取两个 ThresholdCondition

### Requirement: Safety Pre-Check
在 Agent 循环开始前，系统执行禁忌阈值匹配和药物相互作用检测。

#### Scenario: 绝对禁忌匹配
- **WHEN** 患者指标 eGFR=25，查询 "二甲双胍用法"
- **THEN** SafetyAssessment.severity = "absolute"，recommendation = "禁用二甲双胍"

#### Scenario: 相对禁忌匹配
- **WHEN** 患者指标 eGFR=40，查询 "二甲双胍用法"
- **THEN** SafetyAssessment.severity = "relative"，recommendation = "慎用，需减量"

#### Scenario: 无禁忌
- **WHEN** 患者指标 eGFR=60，查询 "二甲双胍用法"
- **THEN** SafetyAssessment.severity = "safe"

#### Scenario: 药物相互作用
- **WHEN** 查询包含 "二甲双胍 + 西咪替丁"
- **THEN** SafetyAssessment.severity = "interaction"，interactions 包含相互作用详情

### Requirement: Evidence Evaluation Integration
OBSERVE 阶段调用 EvidenceEvaluator，输出证据质量评估。

#### Scenario: 多源证据评估
- **WHEN** 检索返回 3 条结果（RCT、指南、专家意见）
- **THEN** evidenceEvaluation 包含 3 个 EvidenceEvaluation，overallGrade = "A"

#### Scenario: 指南时效性检查
- **WHEN** 检索结果包含 2020 年 ADA 指南
- **THEN** EvidenceEvaluation.isTimely = true（5年内）

### Requirement: Three-Layer Answer Synthesis
答案生成综合 SafetyAssessment、RetrievalResults、EvidenceEvaluation 三层信息。

#### Scenario: 禁忌优先
- **WHEN** SafetyAssessment.severity = "absolute"
- **THEN** conclusion 使用 SafetyAssessment.recommendation，不再引用检索的用药建议

#### Scenario: GRADE 从计算获得
- **WHEN** evidenceEvaluation 存在
- **THEN** evidenceGrade.grade = calculateOverallGrade(evidenceEvaluation)，不从 LLM 输出提取

#### Scenario: 相对禁忌综合
- **WHEN** SafetyAssessment.severity = "relative"
- **THEN** conclusion = "慎用"，details 包含阈值说明 + 检索的调整建议