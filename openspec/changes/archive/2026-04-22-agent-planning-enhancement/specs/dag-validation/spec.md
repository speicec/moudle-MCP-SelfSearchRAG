## ADDED Requirements

### Requirement: Task ID uniqueness validation
The system SHALL validate that all task IDs are unique.

#### Scenario: Duplicate ID detection
- **WHEN** two tasks have same id
- **THEN** validation returns error type "duplicate_task_id"
- **AND** suggestion includes renaming duplicate task

#### Scenario: Unique IDs pass
- **WHEN** all task IDs are unique
- **THEN** validation passes structure completeness check
- **AND** no duplicate_task_id error generated

### Requirement: Dependency existence validation
The system SHALL validate that all dependency references exist.

#### Scenario: Missing dependency detection
- **WHEN** task dependency references non-existent task ID
- **THEN** validation returns error type "missing_dependency"
- **AND** suggestion includes removing or adding missing task

#### Scenario: All dependencies exist
- **WHEN** all task dependencies reference existing tasks
- **THEN** validation passes dependency existence check
- **AND** no missing_dependency error generated

### Requirement: Circular dependency detection
The system SHALL detect circular dependencies in task graph.

#### Scenario: Direct circular dependency
- **WHEN** task A depends on task B and task B depends on task A
- **THEN** validation returns error type "circular_dependency"
- **AND** cyclePath shows [A, B, A]

#### Scenario: Indirect circular dependency
- **WHEN** task A → B → C → A dependency chain exists
- **THEN** validation returns error type "circular_dependency"
- **AND** cyclePath shows [A, B, C, A]

#### Scenario: No circular dependency
- **WHEN** task graph has no cycles
- **THEN** validation passes circular dependency check
- **AND** DFS traversal completes without detecting cycle

### Requirement: Self dependency detection
The system SHALL detect tasks that depend on themselves.

#### Scenario: Self dependency detected
- **WHEN** task dependencies include own ID
- **THEN** validation returns error type "self_dependency"
- **AND** auto-correction removes self-dependency

#### Scenario: No self dependency
- **WHEN** no task depends on itself
- **THEN** validation passes self dependency check
- **AND** no self_dependency error generated

### Requirement: Parallel group internal dependency validation
The system SHALL validate parallel groups have no internal dependencies.

#### Scenario: Internal dependency detected
- **WHEN** task in parallelGroup depends on another task in same group
- **THEN** validation returns error type "parallel_internal_dependency"
- **AND** auto-correction removes task from parallel group

#### Scenario: No internal dependency
- **WHEN** parallel group tasks have no mutual dependencies
- **THEN** validation passes parallel internal check
- **AND** group remains valid for parallel execution

### Requirement: Parallel type limit validation
The system SHALL validate parallel group respects type limits.

#### Scenario: Retrieve type limit exceeded
- **WHEN** parallelGroup contains > 3 retrieve tasks
- **THEN** validation returns warning type "same_type_parallel_limit"
- **AND** suggestion includes splitting parallel group

#### Scenario: Type limit respected
- **WHEN** parallelGroup respects PARALLEL_TYPE_LIMITS
- **THEN** validation passes type limit check
- **AND** no same_type_parallel_limit warning generated

### Requirement: Priority order validation
The system SHALL validate task priority respects dependencies.

#### Scenario: Priority order violation
- **WHEN** dependency task priority ≥ dependent task priority
- **THEN** validation returns warning type "priority_order_violation"
- **AND** auto-correction adjusts dependency task priority

#### Scenario: Priority order correct
- **WHEN** all dependency tasks have lower priority than dependent tasks
- **THEN** validation passes priority order check
- **AND** no priority_order_violation warning generated

### Requirement: Tool type validation
The system SHALL validate task types are known tool types.

#### Scenario: Unknown tool type
- **WHEN** task.type not in valid tool types list
- **THEN** validation returns error type "unknown_tool_type"
- **AND** suggestion includes valid type list

#### Scenario: Known tool type
- **WHEN** task.type is valid AgentActionType
- **THEN** validation passes tool type check
- **AND** no unknown_tool_type error generated

### Requirement: Required parameter validation
The system SHALL validate task params have required parameters.

#### Scenario: Missing required param
- **WHEN** task params missing parameter listed in TOOL_PARAM_SCHEMA.required
- **THEN** validation returns error type "missing_required_param"
- **AND** suggestion includes adding missing param

#### Scenario: Required params present
- **WHEN** task params contain all required parameters
- **THEN** validation passes required param check
- **AND** no missing_required_param error generated

### Requirement: DAG statistics calculation
The system SHALL calculate DAG statistics for analysis.

#### Scenario: Task count calculation
- **WHEN** DAG validation completes
- **THEN** stats.taskCount equals number of tasks
- **AND** taskCount available for execution planning

#### Scenario: Max depth calculation
- **WHEN** DAG validation completes
- **THEN** stats.maxDepth equals longest dependency chain
- **AND** maxDepth indicates execution stages

#### Scenario: Critical path calculation
- **WHEN** DAG validation completes
- **THEN** stats.criticalPathLength equals maxDepth + 1
- **AND** criticalPathLength estimates minimum execution time

### Requirement: Auto-correction execution
The system SHALL apply auto-corrections for fixable errors.

#### Scenario: Self-dependency correction
- **WHEN** self_dependency error detected
- **THEN** auto-correction removes self-reference from dependencies
- **AND** corrected DAG re-validated

#### Scenario: Priority correction
- **WHEN** priority_order_violation warning detected
- **THEN** auto-correction adjusts dependency task priority
- **AND** corrected DAG re-validated

#### Scenario: Parallel group correction
- **WHEN** parallel_internal_dependency error detected
- **THEN** auto-correction removes conflicting task from parallel group
- **AND** corrected DAG re-validated

#### Scenario: Uncorrectable error handling
- **WHEN** circular_dependency or missing_dependency error detected
- **THEN** auto-correction not applied
- **AND** system returns validation failure with fallback suggestion