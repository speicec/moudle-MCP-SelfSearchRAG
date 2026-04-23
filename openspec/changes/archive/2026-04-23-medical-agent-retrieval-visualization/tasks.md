## 1. Core Bug Fixes

- [x] 1.1 Fix Planning mode query optimization - modify `AgentExecutor.executePlanningMode()` to call `buildQueryStrategy()` before planning, pass optimized query to DAG tasks
- [x] 1.2 Extend intent detection in `IntentAnalyzer.ts` - add decision support contraindication patterns ("能否使用", "可以服用", "能不能用", "是否可以", "适合用")
- [x] 1.3 Add `decision_support_with_indicator` template in `TemplateMatcher.ts` - match decision_support + drug + indicator value queries, use optimized query in retrieve tasks

## 2. Visualization Infrastructure

- [x] 2.1 Create `RetrievalVisualization.ts` - define types: RetrievalVisualization, VisualizationCollector class with collectXxx() methods
- [x] 2.2 Create `TraceVisualizer.ts` - define ExecutionTrace type, TraceNode structure, phase-based trace collection
- [x] 2.3 Extend `types.ts` - add RetrievalVisualization and ExecutionTrace optional fields to AgentResult

## 3. AgentLogger Integration

- [x] 3.1 Add AgentLogger to AgentExecutor - create logger instance in constructor, replace console.log calls with logger.logXxx() methods
- [x] 3.2 Add VisualizationCollector to AgentExecutor - create collector instance, call collectXxx() at each phase
- [x] 3.3 Integrate AgentLogger with full visualization - add buildFullVisualization() output to toMarkdown()

## 4. MCP Tool Output Enhancement

- [x] 4.1 Add brief visualization to `formatAgentResultAsMarkdown()` - insert "🔍 检索分析" section before "结论"
- [x] 4.2 Add brief visualization to `formatPlanningResultAsMarkdown()` - include execution path and DAG summary
- [x] 4.3 Add retrieval result count tracking - modify TaskExecutor to record result count per retrieve task

## 5. Template Matching Logging

- [x] 5.1 Add template attempt logging to TemplateMatcher - record each template tried with match result and rejection reason
- [x] 5.2 Pass template attempts to VisualizationCollector - collect template matching phase data for full visualization

## 6. Tests

- [x] 6.1 Update IntentAnalyzer tests - add test cases for extended contraindication detection patterns
- [x] 6.2 Update TemplateMatcher tests - add test cases for decision_support_with_indicator template

## 7. Documentation

- [x] 7.1 Update medical-agent-guide.md - document new visualization output format and phases
- [x] 7.2 Add inline comments - explain key changes in executePlanningMode(), matchTemplate(), detectSpecialNeeds()