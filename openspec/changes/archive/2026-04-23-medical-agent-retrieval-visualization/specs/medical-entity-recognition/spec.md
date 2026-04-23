---
capability: medical-entity-recognition
version: 1.0
created: 2026-04-22
delta: true
---

# Delta Spec: Medical Entity Recognition

## MODIFIED Requirements

### Requirement: Extended contraindication intent detection
The system SHALL detect contraindication checking intent beyond "禁忌" keyword.

#### Scenario: Decision support contraindication detection
- **WHEN** query matches patterns: "能否使用", "可以服用", "能不能用", "是否可以", "适合用"
- **THEN** specialNeeds.checkContraindication set to true
- **AND** intentAnalysis includes 'safety_check' query type

#### Scenario: Decision support with drug and indicator
- **WHEN** query contains drug + indicator value + decision pattern
- **THEN** checkContraindication flag set
- **AND** retrievalNeeds for both drug and indicator set to 'required'

#### Scenario: Original "禁忌" keyword detection preserved
- **WHEN** query contains "禁忌" keyword
- **THEN** checkContraindication set to true (existing behavior preserved)
- **AND** relation match of type 'contraindication' included

### Requirement: Decision support query type classification
The system SHALL classify decision support queries with safety implications.

#### Scenario: Decision support triggers safety check
- **WHEN** query matches decision pattern with contraindication-relevant entities
- **THEN** queryTypes includes both 'decision_support' and 'safety_check'
- **AND** expectedAnswerFormat set to 'recommendation'

#### Scenario: Pure decision support without safety
- **WHEN** decision pattern without contraindication-relevant entities
- **THEN** queryTypes includes 'decision_support' only
- **AND** specialNeeds.checkContraindication remains false