## ADDED Requirements

### Requirement: Evaluation auto-trigger after Agent queries
The system SHALL automatically trigger RAGAS evaluation after each Agent-enabled query completes.

#### Scenario: Agent query triggers evaluation
- **WHEN** `/api/chat/generate` endpoint is called with `enableAgent=true`
- **AND** Agent execution completes successfully
- **THEN** system submits evaluation task to AgentEvaluationService
- **AND** evaluation task does not block HTTP response

#### Scenario: Non-Agent query skips evaluation
- **WHEN** `/api/chat/generate` endpoint is called with `enableAgent=false`
- **THEN** system does not trigger evaluation

#### Scenario: Evaluation failure does not affect response
- **WHEN** evaluation submission fails
- **THEN** system logs warning message
- **AND** HTTP response is returned normally without error

### Requirement: Evaluation execution mode selection
The system SHALL select appropriate evaluation execution mode based on Redis availability.

#### Scenario: Queue mode with Redis available
- **WHEN** Redis connection is available
- **THEN** system uses Bull queue for async evaluation
- **AND** evaluation tasks are processed by EvaluationWorker

#### Scenario: Background mode without Redis
- **WHEN** Redis connection is not available
- **THEN** system calls MedicalEvaluationPipeline directly in background
- **AND** evaluation does not block HTTP response (Promise not awaited)

### Requirement: Evaluation submission includes context
The system SHALL include necessary context when submitting evaluation tasks.

#### Scenario: Submission includes AgentResult
- **WHEN** evaluation is triggered
- **THEN** submission includes AgentResult (query, answer, retrievalContext)
- **AND** submission includes sessionId for WebSocket targeting
- **AND** submission includes onSuccess callback for result handling

### Requirement: Environment variable controls evaluation
The system SHALL respect ENABLE_RAGAS_EVALUATION environment variable.

#### Scenario: Evaluation enabled by default
- **WHEN** ENABLE_RAGAS_EVALUATION is not set
- **THEN** evaluation auto-trigger is enabled

#### Scenario: Evaluation disabled by env var
- **WHEN** ENABLE_RAGAS_EVALUATION is set to "false"
- **THEN** system skips evaluation trigger for all queries