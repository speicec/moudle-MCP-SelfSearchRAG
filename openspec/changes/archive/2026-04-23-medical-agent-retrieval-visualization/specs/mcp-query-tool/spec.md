---
capability: mcp-query-tool
version: 1.0
created: 2026-04-22
delta: true
---

# Delta Spec: MCP Query Tool

## MODIFIED Requirements

### Requirement: MCP output includes retrieval visualization
The system SHALL include retrieval visualization in MCP Tool output before conclusion.

#### Scenario: Brief visualization in result
- **WHEN** MCP Tool formats result for display
- **THEN** "🔍 检索分析" section appears before "结论" section
- **AND** visualization shows original query, entities, optimized query, execution path

#### Scenario: Visualization structure
- **WHEN** visualization section generated
- **THEN** section includes: 原始查询, 识别结果, 优化查询, 执行路径, 检索结果
- **AND** each field uses compact one-line format

### Requirement: Planning result structure with visualization
The system SHALL return structured planning results with visualization data.

#### Scenario: DAG visualization in result
- **WHEN** planning mode enabled
- **THEN** result includes executedDAG with task details
- **AND** each task shows id, type, status, and query used

#### Scenario: Execution trace in result
- **WHEN** execution completes
- **THEN** result includes executionTrace with phase summaries
- **AND** trace shows mode selection decision and reason

## ADDED Requirements

### Requirement: AgentLogger integration
The system SHALL integrate AgentLogger in AgentExecutor.

#### Scenario: Logger replaces console.log
- **WHEN** AgentExecutor runs
- **THEN** structured logging via AgentLogger used instead of console.log
- **AND** log level controlled by enableTraceLogging config

#### Scenario: Full visualization in Logger report
- **WHEN** AgentLogger.toMarkdown() called
- **THEN** full visualization section included
- **AND** detailed phase JSON and template attempts shown

### Requirement: Retrieval result count display
The system SHALL display retrieval result count in output.

#### Scenario: Result count in brief visualization
- **WHEN** retrieval completes
- **THEN** brief visualization shows "检索结果: N条相关文献"
- **AND** count reflects total matching documents

#### Scenario: Per-task result count in DAG
- **WHEN** DAG task is retrieve type
- **THEN** executedDAG shows resultCount per task
- **AND** count reflects documents retrieved by that task