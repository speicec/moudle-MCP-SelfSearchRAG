## ADDED Requirements

### Requirement: Frontend displays GRADE evidence level
The system SHALL display GRADE evidence level (A/B/C/D) in EvidenceCard component based on backend-provided evaluation.

#### Scenario: GRADE A evidence displayed
- **WHEN** backend returns evidenceEvaluation with grade = 'A'
- **THEN** EvidenceCard displays "GRADE A" badge with "高质量证据" label
- **AND** badge color is success (green)

#### Scenario: GRADE B evidence displayed
- **WHEN** backend returns evidenceEvaluation with grade = 'B'
- **THEN** EvidenceCard displays "GRADE B" badge with "中等质量" label
- **AND** badge color is primary

#### Scenario: GRADE C evidence displayed
- **WHEN** backend returns evidenceEvaluation with grade = 'C'
- **THEN** EvidenceCard displays "GRADE C" badge with "低质量" label
- **AND** badge color is warning

#### Scenario: GRADE D evidence displayed
- **WHEN** backend returns evidenceEvaluation with grade = 'D'
- **THEN** EvidenceCard displays "GRADE D" badge with "极低质量" label
- **AND** badge color is muted

### Requirement: Frontend displays literature type
The system SHALL display literature type label in EvidenceCard component.

#### Scenario: RCT literature type displayed
- **WHEN** backend returns evidenceEvaluation with literatureType = 'rct'
- **THEN** EvidenceCard displays "随机对照试验" label
- **AND** label icon is ShieldCheck

#### Scenario: Meta analysis literature type displayed
- **WHEN** backend returns evidenceEvaluation with literatureType = 'meta_analysis'
- **THEN** EvidenceCard displays "Meta分析/系统评价" label

#### Scenario: Guideline literature type displayed
- **WHEN** backend returns evidenceEvaluation with literatureType = 'guideline'
- **THEN** EvidenceCard displays "临床指南" label

#### Scenario: Observational study displayed
- **WHEN** backend returns evidenceEvaluation with literatureType = 'observational'
- **THEN** EvidenceCard displays "观察性研究" label

#### Scenario: Case report displayed
- **WHEN** backend returns evidenceEvaluation with literatureType = 'case_report'
- **THEN** EvidenceCard displays "病例报告" label

#### Scenario: Expert opinion displayed
- **WHEN** backend returns evidenceEvaluation with literatureType = 'expert_opinion'
- **THEN** EvidenceCard displays "专家意见" label

### Requirement: Frontend displays source authority level
The system SHALL display source authority level in EvidenceCard component.

#### Scenario: International authority displayed
- **WHEN** backend returns evidenceEvaluation with sourceAuthority = 'international'
- **THEN** EvidenceCard displays "国际指南" indicator
- **AND** indicator shows organization abbreviation (ADA/KDIGO/ESC)

#### Scenario: National authority displayed
- **WHEN** backend returns evidenceEvaluation with sourceAuthority = 'national'
- **THEN** EvidenceCard displays "国家指南" indicator
- **AND** indicator shows organization abbreviation (CDS/中华医学会)

#### Scenario: Local authority displayed
- **WHEN** backend returns evidenceEvaluation with sourceAuthority = 'local'
- **THEN** EvidenceCard displays "本地/其他" indicator

### Requirement: Frontend displays time decay warning
The system SHALL display time decay warning when evidence is outdated.

#### Scenario: Recent evidence no warning
- **WHEN** backend returns evidenceEvaluation with timeWeight >= 0.9
- **THEN** EvidenceCard does not display time warning

#### Scenario: Moderately old evidence warning
- **WHEN** backend returns evidenceEvaluation with timeWeight between 0.7 and 0.9
- **THEN** EvidenceCard displays "建议确认更新版" warning with amber color

#### Scenario: Old evidence warning
- **WHEN** backend returns evidenceEvaluation with timeWeight < 0.7 or expirationWarning exists
- **THEN** EvidenceCard displays expirationWarning text
- **AND** warning icon is AlertTriangle

### Requirement: Frontend falls back to similarity score when no GRADE data
The system SHALL fall back to similarityScore-based grading when backend does not provide GRADE evaluation.

#### Scenario: No GRADE data fallback
- **WHEN** backend returns result without evidenceEvaluation field
- **THEN** EvidenceCard uses getEvidenceQuality(similarityScore) to determine grade
- **AND** displays "匹配度" label instead of "GRADE" label

#### Scenario: Partial GRADE data fallback
- **WHEN** backend returns evidenceEvaluation with only grade field (no literatureType)
- **THEN** EvidenceCard displays grade badge
- **AND** does not display literature type section

### Requirement: Frontend EvidencePanel shows GRADE distribution
The system SHALL display GRADE distribution summary in EvidencePanel header.

#### Scenario: GRADE distribution calculation
- **WHEN** EvidencePanel receives results with evidenceEvaluation
- **THEN** panel header shows grade distribution: A:2, B:3, C:1, D:0

#### Scenario: Average composite score display
- **WHEN** EvidencePanel receives results with compositeScore
- **THEN** panel header shows average composite score with decimal precision

#### Scenario: Mixed GRADE and fallback distribution
- **WHEN** some results have GRADE and some use fallback
- **THEN** panel shows two separate distributions
- **AND** indicates which results use fallback grading