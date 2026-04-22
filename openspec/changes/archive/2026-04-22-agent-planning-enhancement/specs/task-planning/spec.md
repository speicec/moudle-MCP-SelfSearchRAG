## ADDED Requirements

### Requirement: Complexity level assessment
The system SHALL assess query complexity before deciding on planning strategy.

#### Scenario: Simple query detection
- **WHEN** query contains only 1 entity (disease/drug/indicator)
- **THEN** system returns complexity level "simple"
- **AND** system skips planning phase

#### Scenario: Moderate complexity detection
- **WHEN** query contains 2-3 entities with single intent
- **THEN** system returns complexity level "moderate"
- **AND** system enables single-pass planning

#### Scenario: Complex query detection
- **WHEN** query contains multiple entities with comparison or synthesis intent
- **THEN** system returns complexity level "complex"
- **AND** system enables multi-stage planning with replanning support

#### Scenario: Structured query detection
- **WHEN** query contains explicit filter conditions (year, source)
- **THEN** system returns complexity level "structured"
- **AND** system uses deterministic template planning

### Requirement: Intent analysis
The system SHALL analyze query intent to determine retrieval strategy.

#### Scenario: Query type classification
- **WHEN** intent analysis is performed
- **THEN** system identifies query types (information_query, decision_support, safety_check, comparison)
- **AND** system outputs expected answer format

#### Scenario: Retrieval need prediction
- **WHEN** intent analysis completes
- **THEN** system categorizes retrieval needs as required, recommended, or optional
- **AND** system identifies primary and secondary focus entities

#### Scenario: Special need detection
- **WHEN** intent analysis detects special requirements
- **THEN** system flags needs: calculateIndicator, checkInteraction, checkContraindication, requireYearFilter

### Requirement: Template matching
The system SHALL match structured queries to deterministic templates.

#### Scenario: Guideline year filter template match
- **WHEN** query requires year filter (specialNeeds.requireYearFilter = true)
- **THEN** system matches guideline_year_filter template
- **AND** system generates DAG without LLM planning call

#### Scenario: Drug contraindication template match
- **WHEN** query checks contraindication with single drug and no indicator
- **THEN** system matches drug_contraindication template
- **AND** system generates DAG without LLM planning call

#### Scenario: Drug comparison template match
- **WHEN** query type includes "comparison" and contains ≥2 drugs
- **THEN** system matches drug_comparison template
- **AND** system generates DAG with parallel retrieval groups

#### Scenario: Indicator drug query template match
- **WHEN** query checks contraindication with drug and indicator value
- **THEN** system matches indicator_drug_query template
- **AND** system generates DAG with indicator calculation task

### Requirement: Task DAG generation
The system SHALL generate Task DAG from planning analysis.

#### Scenario: Task definition
- **WHEN** DAG is generated
- **THEN** each task has unique id, type, params, dependencies, and priority
- **AND** task types are valid AgentActionType values

#### Scenario: Dependency specification
- **WHEN** task dependencies are defined
- **THEN** dependency tasks exist in task list
- **AND** no circular dependencies exist

#### Scenario: Parallel group identification
- **WHEN** DAG is generated
- **THEN** parallelGroups contains tasks with no mutual dependencies
- **AND** parallel groups do not exceed type limits (retrieve: 3, check_interaction: 1)

#### Scenario: Priority assignment
- **WHEN** task priorities are assigned
- **THEN** dependent tasks have lower priority than dependency tasks
- **AND** priority values range from 1 (retrieval) to 7 (answer generation)

### Requirement: Task parameter validation
The system SHALL validate task parameters against tool schema.

#### Scenario: Required parameter validation
- **WHEN** task params are validated
- **THEN** required parameters per TOOL_PARAM_SCHEMA are present
- **AND** missing required parameters cause validation error

#### Scenario: Parameter type validation
- **WHEN** task params are validated
- **THEN** parameter types match schema definitions
- **AND** invalid types cause validation warning