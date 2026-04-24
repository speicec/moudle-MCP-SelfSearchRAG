---
capability: rule-based-decision
version: 1.0
created: 2026-04-23
---

# Spec: Rule-Based Decision

## ADDED Requirements

### Requirement: Rule-based satisfaction judgment
The system SHALL determine agent satisfaction status using rule-based logic instead of LLM calls, reducing latency and cost.

#### Scenario: Satisfied by retrieval count
- **WHEN** retrievalResults.length >= 3
- **THEN** system returns satisfied = true
- **AND** no LLM call is made for decide()

#### Scenario: Satisfied by high similarity
- **WHEN** maxSimilarityScore among retrievalResults > 0.7
- **THEN** system returns satisfied = true
- **AND** no LLM call is made for decide()

#### Scenario: Satisfied by entity coverage
- **WHEN** entity coverage ratio >= 0.8 (all identified entities appear in retrieval results)
- **THEN** system returns satisfied = true
- **AND** no LLM call is made for decide()

#### Scenario: Satisfied by absolute contraindication
- **WHEN** safetyAssessment.severity === 'absolute'
- **THEN** system returns satisfied = true
- **AND** no LLM call is made for decide()
- **AND** no further retrieval is needed

#### Scenario: Not satisfied by low retrieval count
- **WHEN** retrievalResults.length < 3
- **AND** maxSimilarityScore <= 0.7
- **AND** entity coverage < 0.8
- **AND** safetyAssessment.severity !== 'absolute'
- **THEN** system returns satisfied = false
- **AND** agent continues to next iteration

### Requirement: Fallback to max iterations
The system SHALL respect maxIterations limit as fallback when rules don't trigger satisfaction.

#### Scenario: Max iterations reached without satisfaction
- **WHEN** iteration >= maxIterations
- **AND** all rule conditions are false
- **THEN** system terminates loop
- **AND** generates answer with available results

### Requirement: Rule evaluation logging
The system SHALL log which rule triggered satisfaction for debugging and optimization.

#### Scenario: Rule hit logging
- **WHEN** decideByRules() returns true
- **THEN** system logs which rule(s) triggered satisfaction
- **AND** log includes rule name and threshold values

### Requirement: Configurable rule thresholds
The system SHALL allow configuration of rule thresholds for different deployment scenarios.

#### Scenario: Custom retrieval threshold
- **WHEN** AgentConfig.ruleThresholds.minRetrievalCount is set to 5
- **THEN** satisfied rule triggers when retrievalResults.length >= 5

#### Scenario: Default thresholds
- **WHEN** no custom thresholds configured
- **THEN** system uses defaults: minRetrievalCount=3, minSimilarity=0.7, minCoverage=0.8