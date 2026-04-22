---
capability: retrieval-visualization
version: 1.0
created: 2026-04-22
---

# Spec: Retrieval Visualization

## 概述

检索可视化能力负责展示查询重写、实体匹配和执行路径，帮助用户理解 Agent 的决策过程。

## ADDED Requirements

### Requirement: Original query display
The system SHALL display the original user query in visualization output.

#### Scenario: Query captured at input
- **WHEN** Agent receives user query
- **THEN** originalQuery field populated with exact input string
- **AND** query displayed verbatim in visualization

### Requirement: Keyword match display
The system SHALL display matched relation keywords in visualization.

#### Scenario: Relation keywords matched
- **WHEN** query contains relation keywords (contraindication, precaution, interaction, indication)
- **THEN** keywordMatches field lists each matched keyword with type
- **AND** match position recorded for each keyword

#### Scenario: No keywords matched
- **WHEN** query contains no relation keywords
- **THEN** keywordMatches field empty array
- **AND** visualization indicates no keywords found

### Requirement: Entity match display
The system SHALL display matched entities with canonical names.

#### Scenario: Disease entities matched
- **WHEN** diseases recognized from query
- **THEN** entityMatches.diseases lists each matchedTerm → canonicalName mapping
- **AND** confidence score displayed for each match

#### Scenario: Drug entities matched
- **WHEN** drugs recognized from query
- **THEN** entityMatches.drugs lists each matchedTerm → canonicalName mapping
- **AND** classification category displayed

#### Scenario: Indicator with value matched
- **WHEN** indicator with value recognized (e.g., "eGFR=35")
- **THEN** entityMatches.indicators includes matchedTerm, canonicalName, and value
- **AND** unit displayed if detected

### Requirement: Query rewriting display
The system SHALL display optimized query after rewriting.

#### Scenario: Query rewritten by planner
- **WHEN** query-planner optimizes retrieval query
- **THEN** queryRewriting.primaryQuery displays optimized string
- **AND** queryRewriting.expandedTerms lists expansion terms

#### Scenario: Filters applied
- **WHEN** year or source filters applied
- **THEN** queryRewriting.filters displays yearRange and sources
- **AND** user understands filtering criteria

### Requirement: Execution path display
The system SHALL display execution path from input to final answer.

#### Scenario: Planning mode selected
- **WHEN** complexity assessment selects Planning mode
- **THEN** executionPath.mode shows "planning"
- **AND** executionPath.reason shows complexity level and rationale

#### Scenario: ReAct mode selected
- **WHEN** complexity assessment selects ReAct mode
- **THEN** executionPath.mode shows "react"
- **AND** executionPath.reason shows "simple" complexity

#### Scenario: Template matched
- **WHEN** template matching succeeds
- **THEN** executionPath.matchedTemplate shows template name
- **AND** execution path shows: Planning → Template → DAG Execution

### Requirement: Brief visualization format
The system SHALL provide brief visualization for MCP Tool output.

#### Scenario: Brief format structure
- **WHEN** MCP Tool formats result
- **THEN** brief visualization appears before "结论" section
- **AND** format uses compact single-line display

#### Scenario: Brief query display
- **WHEN** brief visualization generated
- **THEN** originalQuery shown on one line
- **AND** entities shown as bullet list with names only

#### Scenario: Brief path display
- **WHEN** brief visualization generated
- **THEN** execution path shown as arrow-connected stages
- **AND** retrieval result count shown as single number

### Requirement: Full visualization format
The system SHALL provide full visualization for Logger report.

#### Scenario: Full format structure
- **WHEN** AgentLogger generates report
- **THEN** full visualization includes per-phase JSON data
- **AND** format uses multi-section detailed display

#### Scenario: Full phase details
- **WHEN** full visualization generated
- **THEN** each phase shows timestamp, durationMs, and input/output JSON
- **AND** template matching attempts logged with pass/fail status

#### Scenario: Full DAG task details
- **WHEN** DAG execution logged
- **THEN** each task shows id, type, status, durationMs, actual query, and resultCount
- **AND** parallel groups and task dependencies shown

### Requirement: Template matching attempt logging
The system SHALL log all template matching attempts in full visualization.

#### Scenario: All templates tried
- **WHEN** template matching phase completes
- **THEN** log shows every template attempted
- **AND** each attempt shows match result and rejection reason

#### Scenario: Template match success
- **WHEN** template matches successfully
- **THEN** log shows template name with ✓ indicator
- **AND** match criteria shown for successful template

#### Scenario: Template match failure
- **WHEN** template fails to match
- **THEN** log shows template name with ✗ indicator
- **AND** specific rejection reason shown (e.g., "indicators.length > 0")