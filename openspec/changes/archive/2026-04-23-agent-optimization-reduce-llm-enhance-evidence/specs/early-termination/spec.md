---
capability: early-termination
version: 1.0
created: 2026-04-23
---

# Spec: Early Termination

## ADDED Requirements

### Requirement: Absolute contraindication bypass
The system SHALL skip ReAct loop when SafetyLayer identifies absolute contraindication, directly generating answer from safety assessment.

#### Scenario: Absolute contraindication detected
- **WHEN** safetyAssessment.severity === 'absolute'
- **THEN** system skips ReAct loop entirely
- **AND** no retrieval is performed
- **AND** no LLM think() or decide() calls are made
- **AND** answer is generated from safetyAssessment.recommendation

#### Scenario: Absolute contraindication with multiple drugs
- **WHEN** safetyAssessment.severity === 'absolute'
- **AND** contraindicationMatches.length > 1
- **THEN** system generates answer listing all contraindications
- **AND** answer includes severity and source guidelines

### Requirement: Safety-based answer generation
The system SHALL generate structured medical answer from SafetyAssessment without requiring retrieval.

#### Scenario: Answer from safety assessment
- **WHEN** generateAnswerFromSafety() is called
- **THEN** answer.conclusion uses safetyAssessment.recommendation
- **AND** answer.details.points include contraindication descriptions
- **AND** answer.evidenceGrade.grade = 'B' (guideline-based)
- **AND** answer.sources include safetyAssessment.sourceGlossary
- **AND** answer.warnings include standard medical disclaimer

### Requirement: Relative contraindication normal flow
The system SHALL NOT trigger early termination for relative contraindications.

#### Scenario: Relative contraindication continues
- **WHEN** safetyAssessment.severity === 'relative'
- **THEN** system continues normal ReAct loop
- **AND** retrieves additional evidence
- **AND** safetyAssessment is used as context for answer generation

### Requirement: Interaction warning normal flow
The system SHALL NOT trigger early termination for drug interactions.

#### Scenario: Drug interaction continues
- **WHEN** safetyAssessment.severity === 'interaction'
- **THEN** system continues normal ReAct loop
- **AND** retrieves interaction details
- **AND** interaction info is included in answer

### Requirement: Early termination metrics
The system SHALL track early termination events for monitoring.

#### Scenario: Early termination logged
- **WHEN** early termination is triggered
- **THEN** system logs termination reason (absolute contraindication)
- **AND** logs time saved compared to full ReAct loop
- **AND** logs query and entities involved