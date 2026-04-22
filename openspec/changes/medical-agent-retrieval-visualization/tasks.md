## 1. Core Bug Fixes

- [ ] 1.1 Fix Planning mode query optimization - modify `AgentExecutor.executePlanningMode()` to call `buildQueryStrategy()` before planning, pass optimized query to DAG tasks
- [ ] 1.2 Extend intent detection in `IntentAnalyzer.ts` - add decision support contraindication patterns ("能否使用", "可以服用", "能不能用", "是否可以", "适合用")
- [ ] 1.3 Add `decision_support_with_indicator` template in `TemplateMatcher.ts` - match decision_support + drug + indicator value queries, use optimized query in retrieve tasks

## 2. Visualization Infrastructure

- [ ] 2.1 Create `RetrievalVisualization.ts` - define types: RetrievalVisualization, VisualizationCollector class with collectXxx() methods
- [ ] 2.2 Create `TraceVisualizer.ts` - define ExecutionTrace type, TraceNode structure, phase-based trace collection
- [ ] 2.3 Extend `types.ts` - add RetrievalVisualization and ExecutionTrace optional fields to AgentResult

## 3. AgentLogger Integration

- [ ] 3.1 Add AgentLogger to AgentExecutor - create logger instance in constructor, replace console.log calls with logger.logXxx() methods
- [ ] 3.2 Add VisualizationCollector to AgentExecutor - create collector instance, call collectXxx() at each phase
- [ ] 3.3 Integrate AgentLogger with full visualization - add buildFullVisualization() output to toMarkdown()

## 4. MCP Tool Output Enhancement

- [ ] 4.1 Add brief visualization to `formatAgentResultAsMarkdown()` - insert "🔍 检索分析" section before "结论"
- [ ] 4.2 Add brief visualization to `formatPlanningResultAsMarkdown()` - include execution path and DAG summary
- [ ] 4.3 Add retrieval result count tracking - modify TaskExecutor to record result count per retrieve task

## 5. Template Matching Logging

- [ ] 5.1 Add template attempt logging to TemplateMatcher - record each template tried with match result and rejection reason
- [ ] 5.2 Pass template attempts to VisualizationCollector - collect template matching phase data for full visualization

## 6. Tests

- [ ] 6.1 Update IntentAnalyzer tests - add test cases for extended contraindication detection patterns
- [ ] 6.2 Update TemplateMatcher tests - add test cases for decision_support_with_indicator template
- [ ] 6.3 Add RetrievalVisualization tests - test collectXxx() methods and formatBrief/formatFull outputs
- [ ] 6.4 Add TraceVisualizer tests - test phase-based trace structure and timing calculations
- [ ] 6.5 Add AgentExecutor integration tests - test Planning mode with optimized query, verify visualization in result
- [ ] 6.6 Run full test suite - ensure all existing tests pass, fix any regressions

## 7. Documentation

- [ ] 7.1 Update medical-agent-guide.md - document new visualization output format and phases
- [ ] 7.2 Add inline comments - explain key changes in executePlanningMode(), matchTemplate(), detectSpecialNeeds()