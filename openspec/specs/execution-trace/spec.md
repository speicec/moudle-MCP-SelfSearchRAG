---
capability: execution-trace
version: 1.0
created: 2026-04-22
---

# Spec: Execution Trace

## 概述

白箱链路追踪能力记录 Agent 执行的每个阶段决策过程，提供完整的可审计执行链路。

## Requirements

### Requirement: Phase-based trace structure
The system SHALL organize execution trace into distinct phases.

#### Scenario: Phase sequence
- **WHEN** Agent executes query
- **THEN** trace includes phases: input, entityRecognition, complexityAssessment, modeSelection, planning, execution, answer
- **AND** each phase has unique identifier and timestamp

#### Scenario: Phase timing
- **WHEN** phase completes
- **THEN** phase record includes startTime and endTime
- **AND** durationMs calculated from timestamps

### Requirement: Input phase trace
The system SHALL record input phase details.

#### Scenario: Input captured
- **WHEN** Agent receives query
- **THEN** inputPhase.input shows raw query string
- **AND** inputPhase.timestamp recorded

#### Scenario: Input phase output
- **WHEN** input phase completes
- **THEN** output shows query string
- **AND** no processing applied at this phase

### Requirement: Entity recognition phase trace
The system SHALL record entity recognition details.

#### Scenario: Entity recognition input
- **WHEN** entity recognition phase starts
- **THEN** input shows query string
- **AND** recognizer name recorded (DictionaryMatcher)

#### Scenario: Entity recognition output
- **WHEN** entity recognition phase completes
- **THEN** output shows full MedicalEntities JSON
- **AND** match positions included for each entity

#### Scenario: Threshold extraction logged
- **WHEN** threshold extraction performed
- **THEN** extracted thresholds shown in output
- **AND** source text for each threshold recorded

### Requirement: Complexity assessment phase trace
The system SHALL record complexity assessment details.

#### Scenario: Complexity input
- **WHEN** complexity assessment phase starts
- **THEN** input shows MedicalEntities
- **AND** assessor name recorded (ComplexityJudge)

#### Scenario: Complexity output
- **WHEN** complexity assessment phase completes
- **THEN** output shows full ComplexityAssessment JSON
- **AND** needsPlanning flag and reason recorded

### Requirement: Mode selection phase trace
The system SHALL record mode selection decision.

#### Scenario: Mode selection input
- **WHEN** mode selection phase starts
- **THEN** input shows complexity result and config.enablePlanning
- **AND** decision context recorded

#### Scenario: Mode selection output
- **WHEN** mode selection phase completes
- **THEN** output shows selected mode ('react' or 'planning')
- **AND** decision reason recorded

#### Scenario: Planning fallback recorded
- **WHEN** Planning mode fails and falls back to ReAct
- **THEN** trace shows mode change from planning to react
- **AND** fallback error message recorded

### Requirement: Planning phase trace
The system SHALL record planning phase details.

#### Scenario: Intent analysis logged
- **WHEN** intent analysis performed
- **THEN** intent analysis output (IntentAnalysis JSON) recorded
- **AND** queryTypes and specialNeeds shown

#### Scenario: Template matching logged
- **WHEN** template matching performed
- **THEN** all template attempts recorded with pass/fail
- **AND** matched template or validation errors shown

#### Scenario: DAG construction logged
- **WHEN** DAG constructed
- **THEN** DAG structure (TaskDAG JSON) recorded
- **AND** retrieve task params.query shown

### Requirement: Execution phase trace
The system SHALL record execution details per mode.

#### Scenario: ReAct iteration logged
- **WHEN** ReAct mode executes iteration
- **THEN** iteration record shows action type, query used, result count, satisfied flag
- **AND** iteration number and timestamp recorded

#### Scenario: DAG task execution logged
- **WHEN** DAG task executes
- **THEN** task record shows id, type, status, durationMs
- **AND** actual retrieval query and result count recorded

#### Scenario: Replanning logged
- **WHEN** replanning triggered
- **THEN** replanning decision JSON recorded
- **AND** triggers and supplemental tasks shown

### Requirement: Answer generation phase trace
The system SHALL record answer generation details.

#### Scenario: Answer input
- **WHEN** answer generation phase starts
- **THEN** input shows entities and retrievalResults
- **AND** safetyAssessment and evidenceEvaluation included

#### Scenario: Answer output
- **WHEN** answer generation phase completes
- **THEN** output shows MedicalAnswer preview
- **AND** generation duration recorded

### Requirement: Trace summary
The system SHALL provide execution summary.

#### Scenario: Total duration
- **WHEN** execution completes
- **THEN** summary shows totalDurationMs
- **AND** duration calculated from first to last phase

#### Scenario: Mode and task count
- **WHEN** execution completes
- **THEN** summary shows executionMode and totalTaskCount
- **AND** replanningRounds shown if applicable

#### Scenario: LLM call count
- **WHEN** execution completes
- **THEN** summary shows llmCallCount
- **AND** count derived from phases that used LLM