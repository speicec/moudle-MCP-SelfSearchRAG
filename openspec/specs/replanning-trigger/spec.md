---
capability: replanning-trigger
version: 1.0
created: 2026-04-22
---

# Spec: Replanning Trigger

## 概述

重规划触发能力负责检查覆盖率阈值、证据质量阈值和执行状态阈值，决定是否触发重规划。

## ADDED Requirements

### Requirement: Coverage threshold check
The system SHALL check retrieval coverage against thresholds.

#### Scenario: Entity coverage calculation
- **WHEN** retrieval completes
- **THEN** system calculates entitiesCovered / totalEntities
- **AND** coverage < 0.8 triggers replanning consideration

#### Scenario: Critical entity missing check
- **WHEN** primary focus entity not in covered entities
- **THEN** system triggers CRITICAL urgency replanning
- **AND** supplemental task focus includes missing entity

#### Scenario: Missing entities limit
- **WHEN** missingEntities.length > 1
- **THEN** system triggers replanning
- **AND** supplemental tasks target missing entities

### Requirement: Evidence quality threshold check
The system SHALL check evidence quality against thresholds.

#### Scenario: High confidence ratio check
- **WHEN** evidence evaluation completes
- **THEN** system calculates highConfidenceDocs / totalDocs
- **AND** ratio < 0.3 triggers MEDIUM urgency replanning

#### Scenario: Grade level check
- **WHEN** average evidence grade calculated
- **THEN** grade < 'C' triggers replanning consideration
- **AND** supplemental tasks add guideline retrieval

#### Scenario: Guideline source check
- **WHEN** guidelineCount < 1
- **THEN** system triggers replanning with guideline focus
- **AND** supplemental task adds guideline retrieval

### Requirement: Execution status threshold check
The system SHALL check execution status against thresholds.

#### Scenario: Failed task ratio check
- **WHEN** execution completes
- **THEN** system calculates failedTasks / totalTasks
- **AND** ratio > 0.2 triggers HIGH urgency replanning

#### Scenario: Critical task failure check
- **WHEN** retrieve task fails
- **THEN** system triggers CRITICAL urgency replanning
- **AND** supplemental task retries or uses alternative

#### Scenario: Retry exhausted check
- **WHEN** task retry count exhausted
- **THEN** system triggers replanning with alternative strategy
- **AND** fallbackStrategy.type determines alternative action

### Requirement: Composite score calculation
The system SHALL calculate composite satisfaction score.

#### Scenario: Score components
- **WHEN** composite score calculated
- **THEN** score = coverageScore(40%) + evidenceScore(25%) + executionScore(15%) + answerScore(20%)
- **AND** score range is 0-1

#### Scenario: Score threshold check
- **WHEN** composite score < 0.65
- **THEN** system triggers replanning
- **AND** supplemental tasks target weakest components

#### Scenario: Score meets threshold
- **WHEN** composite score ≥ 0.65
- **THEN** system proceeds to answer generation
- **AND** replanning not triggered

### Requirement: Replanning limit enforcement
The system SHALL enforce replanning iteration limits.

#### Scenario: Round limit check
- **WHEN** replanning round ≥ maxReplanRounds (2)
- **THEN** system stops replanning
- **AND** uses current best results for answer

#### Scenario: Task limit check
- **WHEN** totalSupplementalTasks > maxSupplementalTasks (3)
- **THEN** system rejects additional replanning
- **AND** logs limit reached reason

#### Scenario: Convergence check
- **WHEN** two consecutive rounds show < 0.05 score improvement
- **THEN** system stops replanning
- **AND** returns with convergence reason

### Requirement: Replanning cooldown
The system SHALL enforce cooldown period between replanning rounds.

#### Scenario: Cooldown activation
- **WHEN** replanning round completes
- **THEN** cooldown period (500ms) starts
- **AND** next replanning waits for cooldown

#### Scenario: Cooldown check
- **WHEN** replanning requested during cooldown
- **THEN** request queued until cooldown ends
- **AND** queued request processed after cooldown

### Requirement: Urgency-based priority
The system SHALL prioritize replanning by urgency level.

#### Scenario: CRITICAL urgency handling
- **WHEN** trigger includes CRITICAL urgency
- **THEN** replanning executes immediately (0ms delay)
- **AND** supplemental tasks added without limit check bypass

#### Scenario: HIGH urgency handling
- **WHEN** trigger includes HIGH urgency
- **THEN** replanning executes with 100ms delay
- **AND** supplemental tasks prioritized

#### Scenario: MEDIUM urgency handling
- **WHEN** trigger includes MEDIUM urgency
- **THEN** replanning executes with 300ms delay
- **AND** standard supplemental task flow

#### Scenario: LOW urgency handling
- **WHEN** trigger includes LOW urgency
- **THEN** replanning optional (may skip)
- **AND** 500ms delay if executed