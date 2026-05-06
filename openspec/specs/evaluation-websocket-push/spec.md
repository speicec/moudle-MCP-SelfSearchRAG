---
capability: evaluation-websocket-push
version: 1.0
created: 2026-05-09
---

# Spec: Evaluation WebSocket Push

## 概述

评估 WebSocket 推送能力负责在评估完成后通过 WebSocket 广播结果，实现实时更新。

## Requirements

### Requirement: WebSocket broadcasts evaluation complete events
The system SHALL broadcast evaluation:complete WebSocket event when evaluation finishes.

#### Scenario: Evaluation complete event emission
- **WHEN** MedicalEvaluationPipeline completes evaluation
- **THEN** system broadcasts WebSocket event with type "evaluation:complete"
- **AND** event includes evaluationId and traceId

#### Scenario: Event includes dimension scores
- **WHEN** evaluation:complete event is broadcast
- **THEN** event includes dimensionScores object with 8 dimension values
- **AND** dimensionScores contains: faithfulness, contextRelevance, answerRelevance, medicalAccuracy, safetyAssessment, evidenceTraceability, completeness, terminologyAccuracy

#### Scenario: Event includes layer scores
- **WHEN** evaluation:complete event is broadcast
- **THEN** event includes layerScores object with 3 layer values
- **AND** layerScores contains: layer1 (基础 RAGAS), layer2 (医疗核心), layer3 (医疗增强)

#### Scenario: Event includes overall metrics
- **WHEN** evaluation:complete event is broadcast
- **THEN** event includes overallScore (weighted average)
- **AND** event includes riskLevel (safe/caution/warning/danger)
- **AND** event includes timestamp

#### Scenario: Event excludes large data
- **WHEN** evaluation:complete event is broadcast
- **THEN** event does NOT include details or verdicts arrays
- **AND** event payload stays under 2KB for performance

### Requirement: WebSocket targets session for broadcast
The system SHALL broadcast evaluation events to appropriate WebSocket connections.

#### Scenario: Broadcast to session connection
- **WHEN** evaluation completes for a specific sessionId
- **THEN** system broadcasts evaluation:complete to connections associated with that session
- **AND** other connections do not receive the event

#### Scenario: Global broadcast fallback
- **WHEN** sessionId is not available or no connection matches
- **THEN** system broadcasts to all connected WebSocket clients
- **AND** Dashboard displays the latest evaluation result

### Requirement: Evaluation broadcast triggers alert check
The system SHALL check alert thresholds after evaluation completes.

#### Scenario: Safety score triggers alert
- **WHEN** evaluation:complete event is being prepared
- **AND** safetyAssessment score < 0.5
- **THEN** AlertHandler.checkAndAlert() is called
- **AND** SAFETY_CRITICAL alert is triggered

#### Scenario: Faithfulness score triggers alert
- **WHEN** evaluation:complete event is being prepared
- **AND** faithfulness score < 0.5
- **THEN** AlertHandler triggers FAITHFULNESS_LOW alert

#### Scenario: Medical accuracy triggers alert
- **WHEN** evaluation:complete event is being prepared
- **AND** medicalAccuracy score < 0.6
- **THEN** AlertHandler triggers MEDICAL_ACCURACY alert