---
capability: task-planning
version: 1.0
created: 2026-04-22
delta: true
---

# Delta Spec: Task Planning

## MODIFIED Requirements

### Requirement: Planning mode uses optimized query
The system SHALL use optimized retrieval query in Planning mode DAG tasks.

#### Scenario: Query optimization applied before planning
- **WHEN** Planning mode selected
- **THEN** buildQueryStrategy(entities) called before plan()
- **AND** optimized query passed to DAG task generation

#### Scenario: Retrieve task uses optimized query
- **WHEN** DAG retrieve task created
- **THEN** task.params.query uses optimized primaryQuery
- **AND** task.params.query not equal to raw user input

#### Scenario: Template DAG uses optimized query
- **WHEN** template generates DAG
- **THEN** retrieve task params use query-planner optimized query
- **AND** entity canonical names included in retrieval query

### Requirement: LLM fallback with optimized query
The system SHALL pass optimized query when LLM planning fallback enabled.

#### Scenario: LLM planning prompt includes optimized query
- **WHEN** LLM planning fallback triggered
- **THEN** TASK_PLANNER_PROMPT includes optimized query suggestion
- **AND** LLM instructed to use optimized terms

#### Scenario: No LLM available fallback
- **WHEN** enableLLMFallback=false and no template matched
- **THEN** system uses hardcoded DAG with optimized query
- **AND** DAG created from query-planner result

## ADDED Requirements

### Requirement: Decision support template matching
The system SHALL match decision support queries with indicator values.

#### Scenario: Decision support with indicator template match
- **WHEN** queryTypes includes 'decision_support'
- **AND** drugs.length >= 1
- **AND** indicators with value present
- **THEN** system matches 'decision_support_with_indicator' template
- **AND** system generates DAG with parallel retrieval

#### Scenario: Template priority ordering
- **WHEN** multiple templates could match
- **THEN** decision_support_with_indicator has priority over indicator_drug_query
- **AND** priority order: decision_support_with_indicator > indicator_drug_query > drug_contraindication

#### Scenario: Decision support template DAG structure
- **WHEN** decision_support_with_indicator template matched
- **THEN** DAG includes parallel retrieve tasks for drug and indicator
- **AND** DAG includes calculate_indicator and check_contraindication tasks