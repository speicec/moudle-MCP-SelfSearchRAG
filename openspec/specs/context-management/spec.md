---
capability: context-management
version: 1.0
created: 2026-04-22
---

# Spec: Context Management

## 概述

上下文管理能力负责 Token 计数、上下文窗口限制和优先级截断。

## ADDED Requirements

### Requirement: Token counting
The system SHALL count tokens for all context content.

#### Scenario: Entry token calculation
- **WHEN** context entry is added
- **THEN** system calculates token count for entry content
- **AND** token count stored in entry.tokens field

#### Scenario: Total token tracking
- **WHEN** entries are added or removed
- **THEN** system updates currentTokens total
- **AND** currentTokens reflects sum of all entry tokens

#### Scenario: Token estimation accuracy
- **WHEN** token count is calculated
- **THEN** estimation error ≤ 10% of actual tokens
- **AND** tiktoken library used for accurate counting

### Requirement: Context window limit
The system SHALL enforce maximum context window size.

#### Scenario: Window limit configuration
- **WHEN** ContextManager is initialized
- **THEN** maxTokens set to model context window minus output reserve
- **AND** reserveForOutput ≥ 4000 tokens

#### Scenario: Add entry within limit
- **WHEN** adding entry and currentTokens + entry.tokens ≤ maxTokens
- **THEN** entry added successfully
- **AND** currentTokens updated

#### Scenario: Add entry exceeds limit
- **WHEN** adding entry and currentTokens + entry.tokens > maxTokens
- **THEN** system triggers compression or truncation
- **AND** entry added after adjustment

### Requirement: Priority-based truncation
The system SHALL truncate low-priority entries when limit exceeded.

#### Scenario: Truncation trigger
- **WHEN** currentTokens > maxTokens
- **THEN** system removes lowest priority entries
- **AND** removal continues until currentTokens ≤ maxTokens

#### Scenario: Priority ordering
- **WHEN** truncating entries
- **THEN** entries sorted by priority descending
- **AND** guideline sources have highest priority (priority = 1)

#### Scenario: Minimum context retention
- **WHEN** truncation occurs
- **THEN** at least 1 high-confidence entry retained
- **AND** primary focus entity evidence not removed

### Requirement: Context compression
The system SHALL compress low-confidence entries before truncation.

#### Scenario: Compression trigger
- **WHEN** compressionThreshold (80%) reached
- **THEN** system compresses entries with priority < 0.5
- **AND** compression reduces token count by 30-50%

#### Scenario: Compression format
- **WHEN** entry is compressed
- **THEN** content replaced with summary (≤ 100 tokens)
- **AND** source metadata preserved

#### Scenario: Compression fallback
- **WHEN** compression insufficient
- **THEN** system proceeds to truncation
- **AND** compression result logged for analysis

### Requirement: Context assembly
The system SHALL assemble final context for LLM prompt.

#### Scenario: Context build
- **WHEN** context assembly requested
- **THEN** entries formatted with source citations
- **AND** format: `[来源: documentName]\ncontent`

#### Scenario: Context ordering
- **WHEN** context assembled
- **THEN** entries ordered by priority
- **AND** highest priority entries at beginning

#### Scenario: Context metadata
- **WHEN** context assembled
- **THEN** total tokens, entry count, truncated flag included
- **AND** metadata used for LLM call configuration