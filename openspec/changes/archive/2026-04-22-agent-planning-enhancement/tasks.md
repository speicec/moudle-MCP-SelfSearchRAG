## 1. Type Definitions

- [x] 1.1 Create `src/medical/agent/ExecutionTypes.ts` with core type definitions
  - Define TaskDAG, AgentTask, TaskResult, ExecutorState interfaces
  - Define ComplexityLevel, TriggerReason, ReplanningDecision types
  - Export PARALLEL_TYPE_LIMITS and TOOL_PARAM_SCHEMA constants

- [x] 1.2 Extend `src/medical/types.ts` for indicator value parsing
  - Add value, minValue, maxValue fields to IndicatorMatch
  - Add thresholdZone field for clinical significance
  - Add ThresholdCondition type for contraindication checks

## 2. DAG Validator

- [x] 2.1 Create `src/medical/agent/DAGValidator.ts` core validation functions
  - Implement validateDAG() with all validation rules
  - Implement detectCircularDependencies() using DFS algorithm
  - Implement calculateDAGStats() for statistics

- [x] 2.2 Implement auto-correction functions in DAGValidator
  - Implement removeDependency(), adjustPriority(), fixParallelInternalDep()
  - Implement renameDuplicateTask(), splitParallelGroup()
  - Implement autoCorrectDAG() for automatic fix application

- [x] 2.3 Add DAGValidator unit tests
  - Test circular dependency detection (direct and indirect)
  - Test parallel group validation (internal and cross-group)
  - Test auto-correction scenarios

## 3. Context Manager

- [x] 3.1 Create `src/medical/agent/ContextManager.ts` core implementation
  - Implement addEntry() with token counting
  - Implement compressionOrTruncate() logic
  - Implement buildContext() for final assembly

- [x] 3.2 Implement token counting utilities
  - Add tiktoken integration or estimation fallback
  - Implement countTokens() helper function
  - Add token budget configuration (maxTokens, reserveForOutput)

- [x] 3.3 Add ContextManager unit tests
  - Test add/remove entry scenarios
  - Test truncation priority ordering
  - Test compression trigger threshold

## 4. Complexity Judge

- [x] 4.1 Create `src/medical/agent/ComplexityJudge.ts`
  - Implement assessComplexity() rule-based logic
  - Implement entity count threshold check (≤1 = simple)
  - Implement intent detection for structured queries

- [x] 4.2 Add ComplexityJudge LLM prompt for ambiguous cases
  - Create COMPLEXITY_ASSESSMENT_PROMPT template
  - Implement fallback LLM call when rules insufficient
  - Add caching for complexity results

- [x] 4.3 Add ComplexityJudge unit tests
  - Test simple/moderate/complex/structured classification
  - Test entity count threshold scenarios
  - Test structured query pattern detection

## 5. Intent Analyzer

- [x] 5.1 Create `src/medical/agent/IntentAnalyzer.ts`
  - Implement analyzeIntent() with query type classification
  - Implement retrieval need prediction (required/recommended/optional)
  - Implement special needs detection flags

- [x] 5.2 Create INTENT_ANALYSIS_PROMPT template
  - Define query type analysis sections
  - Define focus and retrieval needs sections
  - Define special needs detection section

- [x] 5.3 Add IntentAnalyzer unit tests
  - Test query type classification (information/decision/safety/comparison)
  - Test primary focus entity detection
  - Test special needs flag scenarios

## 6. Template Matcher

- [x] 6.1 Create `src/medical/agent/TemplateMatcher.ts`
  - Implement matchTemplate() with pattern matching rules
  - Define STRUCTURED_TEMPLATES constant with 4 base templates
  - Implement template to DAG conversion

- [x] 6.2 Define base structured templates
  - guideline_year_filter template (3 tasks)
  - drug_contraindication template (3 tasks)
  - drug_comparison template (5 tasks, 3 parallel)
  - indicator_drug_query template (5 tasks, 2 parallel)

- [x] 6.3 Add TemplateMatcher unit tests
  - Test each template matching scenario
  - Test no-match fallback scenario
  - Test template DAG output structure

## 7. Task Planner

- [x] 7.1 Create `src/medical/agent/TaskPlanner.ts` main implementation
  - Implement plan() orchestrating judge→intent→template→LLM flow
  - Implement buildTaskDAG() from planning results
  - Implement identifyParallelGroups() dependency analysis

- [x] 7.2 Create TASK_PLANNER_PROMPT template
  - Define tool descriptions and parameters
  - Define planning rules (decomposition, dependency, parallel, priority)
  - Include example outputs for common patterns

- [x] 7.3 Implement DAG output parsing
  - Implement parsePlanningResponse() JSON extraction
  - Implement dependency validation during parsing
  - Add fallback for malformed responses

- [x] 7.4 Add TaskPlanner unit tests
  - Test simple query skip scenario
  - Test template match vs LLM planning flow
  - Test complex query DAG generation

## 8. Replanning Engine

- [x] 8.1 Create `src/medical/agent/ReplanningEngine.ts` core implementation
  - Implement evaluateReplanningNeed() with threshold checks
  - Implement calculateCompositeScore() multi-dimensional scoring
  - Implement checkReplanningLimits() iteration limits

- [x] 8.2 Implement trigger threshold checks
  - Entity coverage threshold (≥0.8)
  - High confidence ratio threshold (≥0.3)
  - Failed task ratio threshold (≤0.2)
  - Critical task failure immediate trigger

- [x] 8.3 Create REPLANNING_PROMPT template
  - Define execution result summary sections
  - Define supplemental task generation format
  - Include task retry and skip options

- [x] 8.4 Add ReplanningEngine unit tests
  - Test trigger scenarios (coverage/evidence/execution)
  - Test urgency level determination
  - Test limit enforcement (rounds/tasks/convergence)

## 9. Task Executor

- [x] 9.1 Create `src/medical/agent/TaskExecutor.ts` core implementation
  - Implement execute() with DAG traversal
  - Implement executeParallelGroup() with Promise.all
  - Implement executeSequentialTasks() with dependency ordering

- [x] 9.2 Implement task execution functions
  - Implement executeTask() with retry mechanism
  - Implement collectResult() for result aggregation
  - Implement handleFailure() with fallback strategies

- [x] 9.3 Implement state tracking
  - Implement updateExecutorState() for transitions
  - Implement trackProgress() for logging
  - Implement buildExecutionSummary() for final report

- [x] 9.4 Add TaskExecutor unit tests
  - Test parallel execution with concurrency limits
  - Test sequential execution with dependencies
  - Test retry and fallback scenarios

## 10. Agent Executor Integration

- [x] 10.1 Modify `src/medical/agent/AgentExecutor.ts` for dual mode
  - Add enablePlanning parameter to run()
  - Implement planning flow when enabled
  - Implement fallback to ReAct when disabled or failed

- [x] 10.2 Add mode switching logic
  - Implement chooseExecutionMode() based on complexity
  - Add mode configuration (enablePlanning, maxReplanRounds)
  - Implement seamless fallback on planning failure

- [x] 10.3 Add integration tests
  - Test full planning flow execution
  - Test ReAct fallback scenario
  - Test mixed mode scenarios

## 11. MCP Tool Enhancement

- [x] 11.1 Modify `src/medical/agent-mcp-tool.ts` for planning mode
  - Add medical_agent_plan tool definition
  - Add enable_planning parameter schema
  - Add max_replan_rounds and confidence_threshold parameters

- [x] 11.2 Update tool result structure
  - Add executed DAG to result
  - Add replanning history to result
  - Add complexity level and template match disclosure

- [x] 11.3 Update MCP server registration
  - Register new medical_agent_plan tool
  - Update existing medical_agent tool for backward compatibility
  - Add tool parameter validation

- [x] 11.4 Add MCP tool integration tests
  - Test planning mode tool call
  - Test backward compatibility with existing tools
  - Test error handling and fallback disclosure

## 12. Documentation

- [x] 12.1 Update docs/medical-agent-guide.md
  - Add planning mode usage section
  - Add complexity level explanation
  - Add configuration parameters guide

- [x] 12.2 Add API documentation
  - Document medical_agent_plan tool parameters
  - Document result structure changes
  - Add usage examples for planning mode