---
capability: mcp-query-tool
version: 1.2
created: 2026-04-21
updated: 2026-04-23
---

# Spec: MCP Query Tool

## 概述

MCP 查询工具是 Medical Agent 的核心检索接口，支持 Small-to-Big 检索、Planning 模式和性能优化。

## Requirements

### Requirement: MCP query tool uses HierarchicalStore
The MCP query tool SHALL use HierarchicalStore as its data source for retrieval.

#### Scenario: Query retrieves from stored chunks
- **WHEN** MCP query tool receives a query_text parameter
- **THEN** system searches in HierarchicalStore's small chunks and returns matching results

#### Scenario: Store has no data
- **WHEN** HierarchicalStore has zero chunks
- **THEN** MCP query tool returns empty results array with message indicating no documents indexed

### Requirement: MCP query returns Small-to-Big format
The MCP query tool SHALL return results in Small-to-Big retrieval format.

#### Scenario: Results include parent chunk content
- **WHEN** query returns results
- **THEN** each result includes `parentChunkContent` containing the full parent chunk text

#### Scenario: Results include context window
- **WHEN** query returns results
- **THEN** each result includes `contextWindow` with extracted context around matched small chunk

#### Scenario: Results include similarity score
- **WHEN** query returns results
- **THEN** each result includes `similarityScore` (0.0 to 1.0) calculated from embedding cosine similarity

#### Scenario: Results include source document ID
- **WHEN** query returns results
- **THEN** each result includes `sourceDocumentId` identifying the source document

### Requirement: MCP query tool supports query options
The MCP query tool SHALL support standard query options.

#### Scenario: TopK limits results
- **WHEN** user provides top_k parameter (default: 5)
- **THEN** system returns at most top_k results

#### Scenario: Threshold filters low-similarity results
- **WHEN** user provides threshold parameter
- **THEN** system only returns results with similarityScore >= threshold

### Requirement: MCP query uses local embedding
The MCP query tool SHALL use the same embedding service as HTTP Server.

#### Scenario: Query embedding dimension matches stored chunks
- **WHEN** query embedding is generated
- **THEN** embedding dimension matches stored chunk embeddings (384 for multilingual-e5-small)

#### Scenario: Embedding service fails
- **WHEN** embedding service fails to generate query embedding
- **THEN** MCP query tool returns error with message describing the failure

### Requirement: Rule-based decision optimization
The system SHALL use rule-based decision instead of LLM decide for efficiency.

#### Scenario: Rule-based decide enabled by default
- **WHEN** agent executes decide phase
- **THEN** system checks rule thresholds instead of calling LLM
- **AND** rules checked in order: retrieval_count, high_similarity, entity_coverage, absolute_contraindication

#### Scenario: retrieval_count rule satisfied
- **WHEN** retrieval results count >= minRetrievalCount (default: 3)
- **THEN** decide returns satisfied=true
- **AND** no LLM call required

#### Scenario: high_similarity rule satisfied
- **WHEN** max similarity score > minSimilarityScore (default: 0.7)
- **THEN** decide returns satisfied=true
- **AND** no LLM call required

#### Scenario: entity_coverage rule satisfied
- **WHEN** entity coverage ratio >= minEntityCoverage (default: 0.8)
- **THEN** decide returns satisfied=true
- **AND** no LLM call required

#### Scenario: Configurable thresholds
- **WHEN** custom thresholds provided
- **THEN** system uses custom values instead of defaults
- **AND** thresholds: minRetrievalCount, minSimilarityScore, minEntityCoverage

### Requirement: Early termination for absolute contraindications
The system SHALL terminate early when absolute contraindication detected.

#### Scenario: Absolute contraindication early termination
- **WHEN** SafetyLayer detects absolute contraindication
- **THEN** agent skips ReAct loop
- **AND** directly generates answer from safety assessment

#### Scenario: Early termination answer structure
- **WHEN** early termination occurs
- **THEN** answer includes contraindication description
- **AND** answer includes safety recommendation
- **AND** warnings indicate rule-based generation

#### Scenario: LLM call count reduction
- **WHEN** early termination occurs
- **THEN** LLM call count reduced to 0 for decide phase
- **AND** execution time significantly reduced

### Requirement: Enhanced evidence evaluation
The system SHALL evaluate evidence with enhanced multi-dimensional scoring.

#### Scenario: Source authority classification
- **WHEN** evidence source evaluated
- **THEN** system classifies authority level: international, national, local
- **AND** international sources: ADA, KDIGO, ESC, ATA (weight: 1.0)
- **AND** national sources: CDS, CSH, CETA (weight: 0.8)

#### Scenario: Time weight calculation
- **WHEN** evidence year evaluated
- **THEN** system applies linear decay (5% per year)
- **AND** minimum weight: 0.5
- **AND** undefined year default: 0.7

#### Scenario: Consistency check
- **WHEN** multiple sources evaluated
- **THEN** system checks keyword conflicts
- **AND** positive keywords: 推荐, 建议, 可用
- **AND** negative keywords: 禁用, 不推荐, 避免

#### Scenario: Composite score calculation
- **WHEN** evidence evaluation complete
- **THEN** composite score calculated with weights
- **AND** GRADE: 40%, Authority: 20%, Time: 20%, Consistency: 10%, Applicability: 10%

#### Scenario: Low quality evidence warning
- **WHEN** composite score < 0.5 or consistency < 0.5
- **THEN** warnings added to answer
- **AND** warning indicates low evidence quality or conflicts

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

## Deprecated Requirements

### Requirement: MCP query uses InMemoryVectorStore
**Status**: REMOVED
**Reason**: InMemoryVectorStore was created empty and never populated with data. All actual data resides in HierarchicalStore.
**Migration**: Use HierarchicalStore with SmallToBigRetriever instead, which provides Small-to-Big retrieval with context windows.

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