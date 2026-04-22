## ADDED Requirements

### Requirement: Planning mode MCP tool
The system SHALL provide MCP tool with planning mode option.

#### Scenario: Enable planning mode
- **WHEN** medical_agent_plan tool called with enable_planning=true
- **THEN** system uses PlanAndExecute flow
- **AND** returns structured result with planning details

#### Scenario: Disable planning mode
- **WHEN** medical_agent_plan tool called with enable_planning=false or omitted
- **THEN** system uses existing ReAct flow
- **AND** maintains backward compatibility

#### Scenario: Planning mode parameters
- **WHEN** medical_agent_plan tool called
- **THEN** parameters include: query, enable_planning, max_replan_rounds, confidence_threshold
- **AND** all parameters optional except query

### Requirement: Planning result structure
The system SHALL return structured planning results.

#### Scenario: DAG in result
- **WHEN** planning mode enabled
- **THEN** result includes executed DAG structure
- **AND** DAG shows tasks and their execution order

#### Scenario: Replanning history
- **WHEN** replanning occurred during execution
- **THEN** result includes replanning history
- **AND** history shows rounds, triggers, and supplemental tasks

#### Scenario: Execution statistics
- **WHEN** execution completes
- **THEN** result includes stats: totalTasks, parallelTasks, totalDuration, llmCallCount
- **AND** statistics available for performance analysis

### Requirement: Complexity level disclosure
The system SHALL disclose query complexity assessment in result.

#### Scenario: Complexity level returned
- **WHEN** planning mode completes
- **THEN** result includes complexityLevel (simple/moderate/complex/structured)
- **AND** user understands why planning was used or skipped

#### Scenario: Template match disclosure
- **WHEN** template matching used
- **THEN** result includes matchedTemplate name
- **AND** user understands planning was template-based

### Requirement: Error handling with fallback
The system SHALL gracefully handle planning failures with fallback.

#### Scenario: Planning failure fallback
- **WHEN** planning phase fails (LLM error, invalid DAG)
- **THEN** system falls back to ReAct mode
- **AND** result includes fallbackReason field

#### Scenario: Replanning limit fallback
- **WHEN** replanning rounds exhausted
- **THEN** system proceeds with best available results
- **AND** result includes limitReached field with reason

#### Scenario: Context overflow fallback
- **WHEN** context exceeds limit even after compression
- **THEN** system truncates and proceeds
- **AND** result includes truncated flag with count