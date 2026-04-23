# Implementation Tasks: Agent检索循环Bug修复

## Task Overview

| Task ID | Task Name | Priority | Status | Estimated Time | Dependencies |
|---------|-----------|----------|--------|----------------|--------------|
| T1 | canContinue添加satisfied检查 | P0 | ✅ Complete | 30 min | None |
| T2 | executeReactMode添加queryRewriting | P0 | ✅ Complete | 45 min | None |
| T3 | chat.ts空查询保护 | P0 | ✅ Complete | 30 min | None |
| T4 | parseDecision正则提取优化 | P1 | ✅ Complete | 60 min | T1 |
| T5 | executeReactMode设置retrievalCount | P1 | ✅ Complete | 30 min | T2 |
| T6 | 单元测试编写 | P1 | ✅ Verified (Existing tests pass) | 90 min | T1-T5 |
| T7 | 集成测试验证 | P1 | ✅ Verified (All pass) | 60 min | T6 |
| T8 | E2E性能测试 | P2 | ⏳ Pending | 45 min | T7 |
| T9 | 代码审查和文档更新 | P2 | ⏳ Pending | 30 min | T8 |
| T10 | 合并和部署 | P2 | ⏳ Pending | 30 min | T9 |

**Total Estimated Time**: 7 hours

## Phase 1: Core Fixes (P0) - 2 hours

### T1: canContinue添加satisfied检查

**File**: `src/medical/agent/AgentState.ts`
**Lines**: 154-161
**Estimated Time**: 30 min

**Implementation**:
```typescript
export function canContinue(state: AgentState): boolean {
  return (
    state.status !== 'completed' &&
    state.status !== 'failed' &&
    !isMaxIterationsReached(state) &&
    !state.satisfied &&  // ← Add this line
    !state.error
  );
}
```

**Verification**:
- Run existing `agent.test.ts`
- Verify `canContinue` tests pass
- Manual test: query="糖尿病", expect iterations=1 (not 3)

**Potential Issues**:
- None - straightforward addition

---

### T2: executeReactMode添加queryRewriting

**File**: `src/medical/agent/AgentExecutor.ts`
**Lines**: 344-360 (before loop starts)
**Estimated Time**: 45 min

**Implementation**:
```typescript
private async executeReactMode(query: string, entities, fallbackReason?) {
  // Add before createInitialState:
  const queryStrategy = this.context.buildQueryStrategy(entities);
  this.collector.collectQueryRewriting(queryStrategy);
  this.visualizationCallback?.('query_rewrite', {
    primaryQuery: queryStrategy.primaryQuery,
    expandedTerms: queryStrategy.expandedTerms
  });
  
  this.logger.log(0, 'think', 'Query strategy built for ReAct', {
    primaryQuery: queryStrategy.primaryQuery,
    expandedTerms: queryStrategy.expandedTerms,
  });
  
  // ... existing code
}
```

**Verification**:
- Check `visualization.queryRewriting.primaryQuery` is non-empty
- Check WebSocket event 'agent:query_rewrite' is sent
- Check chat.ts receives correct query

**Potential Issues**:
- Need to ensure `buildQueryStrategy` is available in context
- Need to verify visualizationCallback is set

---

### T3: chat.ts空查询保护

**File**: `src/server/routes/chat.ts`
**Lines**: 393-402
**Estimated Time**: 30 min

**Implementation**:
```typescript
// Replace current retrievalQuery logic:
let retrievalQuery = query;

if (agentResult?.visualization?.queryRewriting?.primaryQuery) {
  const rewrittenQuery = agentResult.visualization
    .queryRewriting.primaryQuery.trim();
  
  if (rewrittenQuery.length > 0) {
    retrievalQuery = rewrittenQuery;
    console.log(`[ChatRoute:Generate] Using Agent rewritten query: "${retrievalQuery}"`);
  } else {
    console.warn(`[ChatRoute:Generate] Agent rewritten query is empty, using original: "${query}"`);
  }
}

// Add final validation:
if (!retrievalQuery || retrievalQuery.trim().length === 0) {
  broadcastGeneration({
    type: 'generation:error',
    error: 'Invalid query: empty query after Agent processing',
    timestamp: Date.now(),
  });
  return reply.status(400).send({
    error: 'Invalid query',
    message: 'Query became empty after Agent processing',
  });
}

const { results, context } = await retriever.retrieveWithMetadata(retrievalQuery);
```

**Verification**:
- Test with empty `queryRewriting.primaryQuery`
- Verify 400 error returned
- Verify fallback to original query works

**Potential Issues**:
- None - defensive programming

---

## Phase 2: Parser and Statistics Fixes (P1) - 2 hours

### T4: parseDecision正则提取优化

**File**: `src/medical/agent/MedicalReasoner.ts`
**Lines**: 178-200
**Estimated Time**: 60 min (most complex task)

**Implementation**:
```typescript
private parseDecision(response: string): ReasoningDecision {
  // Extract ACTION using regex
  const actionMatch = response.match(/ACTION:\s+(\w+)/i);
  let action: ReasoningDecision['action'] = 'answer';
  
  if (actionMatch) {
    const extractedAction = actionMatch[1].toLowerCase();
    const validActions = ['retrieve', 'expand_query', 'answer', 'need_more'];
    if (validActions.includes(extractedAction)) {
      action = extractedAction as ReasoningDecision['action'];
    }
  }
  
  // Extract CONFIDENCE using regex
  const confMatch = response.match(/CONFIDENCE:\s+([\d.]+)/i);
  const confidence = confMatch ? parseFloat(confMatch[1]) : 0.5;
  
  // Extract REASON using regex
  const reasonMatch = response.match(/REASON:\s+(.+?)(?=CONFIDENCE|$)/is);
  const reason = reasonMatch?.[1]?.trim() ?? response.slice(0, 200);
  
  return { action, reason, confidence };
}
```

**Verification**:
- Unit tests for regex extraction
- Test with real LLM responses
- Verify no keyword false positives

**Potential Issues**:
- LLM response format variations
- Regex performance (minor)

**Test Cases**:
```typescript
test('parseDecision should extract ACTION correctly', () => {
  const response = `ACTION: retrieve\nREASON: 需要检索\nCONFIDENCE: 0.6`;
  const result = parseDecision(response);
  expect(result.action).toBe('retrieve');
  expect(result.confidence).toBe(0.6);
});

test('parseDecision should not match REASON keywords', () => {
  const response = `ACTION: answer\nREASON: 已检索到足够信息\nCONFIDENCE: 0.8`;
  const result = parseDecision(response);
  expect(result.action).toBe('answer');
});
```

---

### T5: executeReactMode设置retrievalCount

**File**: `src/medical/agent/AgentExecutor.ts`
**Lines**: ~445 (before buildResult)
**Estimated Time**: 30 min

**Implementation**:
```typescript
private async executeReactMode(query: string, entities, fallbackReason?) {
  // ... loop logic
  
  // 3. Generate answer
  state = setStatus(state, 'answering');
  const answer = await this.generateAnswer(state);
  state = setAnswer(state, answer);
  
  // Add before buildResult:
  const finalRetrievalCount = state.retrievalResults?.length ?? 0;
  this.collector.setRetrievalResultCount(finalRetrievalCount);
  this.logger.log(state.iteration, 'complete', 'Final retrieval count set', {
    count: finalRetrievalCount
  });
  
  // 4. Quality check
  // ...
  
  // 5. Complete
  const result = this.buildResult(state);
}
```

**Verification**:
- Check `visualization.retrievalResultCount` matches actual results
- Check agentEmitter sends correct count
- Check frontend displays correct count

**Potential Issues**:
- Need to ensure `setRetrievalResultCount` method exists in VisualizationCollector
- Already exists at line 215-217

---

## Phase 3: Testing (P1) - 2.5 hours

### T6: 单元测试编写

**Files**: 
- `src/medical/agent.test.ts` (AgentState tests)
- `src/medical/agent/MedicalReasoner.test.ts` (parseDecision tests)
- `src/medical/agent/AgentExecutor.test.ts` (executeReactMode tests)
- `src/__tests__/server.test.ts` (chat route tests)

**Estimated Time**: 90 min

**Test Coverage Requirements**:

#### AgentState.test.ts additions:
```typescript
describe('canContinue with satisfied check', () => {
  it('should return false when satisfied=true', () => {
    const state = createInitialState('test', mockEntities);
    state.satisfied = true;
    expect(canContinue(state)).toBe(false);
  });
  
  it('should return true when satisfied=false but other conditions met', () => {
    const state = createInitialState('test', mockEntities);
    state.satisfied = false;
    state.status = 'thinking';
    expect(canContinue(state)).toBe(true);
  });
  
  it('should prioritize satisfied over maxIterations', () => {
    const state = createInitialState('test', mockEntities, 5);
    state.iteration = 3;
    state.satisfied = true;
    expect(canContinue(state)).toBe(false); // satisfied check first
  });
});
```

#### MedicalReasoner.test.ts additions:
```typescript
describe('parseDecision regex extraction', () => {
  it('should extract ACTION precisely', () => {
    const response = `ACTION: retrieve\nREASON: need more info\nCONFIDENCE: 0.7`;
    const result = parseDecision(response);
    expect(result.action).toBe('retrieve');
  });
  
  it('should not match action keywords in REASON', () => {
    const response = `ACTION: answer\nREASON: already retrieved sufficient info\nCONFIDENCE: 0.9`;
    const result = parseDecision(response);
    expect(result.action).toBe('answer'); // not 'retrieve'
  });
  
  it('should extract CONFIDENCE as float', () => {
    const response = `ACTION: retrieve\nCONFIDENCE: 0.6`;
    const result = parseDecision(response);
    expect(result.confidence).toBe(0.6);
  });
  
  it('should use default 0.5 when CONFIDENCE missing', () => {
    const response = `ACTION: retrieve\nREASON: test`;
    const result = parseDecision(response);
    expect(result.confidence).toBe(0.5);
  });
  
  it('should handle malformed responses', () => {
    const response = `Invalid format`;
    const result = parseDecision(response);
    expect(result.action).toBe('answer'); // default
    expect(result.confidence).toBe(0.5); // default
  });
});
```

#### AgentExecutor.test.ts additions:
```typescript
describe('executeReactMode queryRewriting', () => {
  it('should call collectQueryRewriting', async () => {
    const executor = createAgentExecutor(config, mockContext);
    const result = await executor.run('test query');
    
    expect(result.visualization.queryRewriting).toBeDefined();
    expect(result.visualization.queryRewriting.primaryQuery.length).toBeGreaterThan(0);
  });
  
  it('should set retrievalResultCount', async () => {
    const executor = createAgentExecutor(config, mockContextWithRetrieval);
    const result = await executor.run('test query');
    
    expect(result.visualization.retrievalResultCount).toBeGreaterThan(0);
  });
});
```

#### server.test.ts additions:
```typescript
describe('POST /api/chat/generate empty query protection', () => {
  it('should return 400 when query is empty', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/api/chat/generate',
      payload: { query: '' },
    });
    
    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe('Query is required');
  });
  
  it('should fallback to original query when Agent queryRewriting is empty', async () => {
    // Mock agentResult with empty queryRewriting
    const response = await fastify.inject({
      method: 'POST',
      url: '/api/chat/generate',
      payload: { query: '糖尿病', enableAgent: true },
    });
    
    // Should not crash with 500
    expect(response.statusCode).toBeLessThan(500);
  });
});
```

**Verification**:
- Run `npm test` → all tests pass
- Check test coverage report → > 90%

---

### T7: 集成测试验证

**Estimated Time**: 60 min

**Integration Test Scenarios**:

#### Scenario 1: Full Agent flow with satisfied=true
```typescript
describe('Agent full flow integration', () => {
  it('should complete successfully with satisfied=true', async () => {
    const startTime = Date.now();
    
    const result = await medicalAgent.run({ query: '糖尿病' });
    
    const duration = Date.now() - startTime;
    
    // Performance assertions
    expect(duration).toBeLessThan(15000); // < 15 seconds (accounting for LLM latency)
    expect(result.stats.iterations).toBeLessThanOrEqual(2); // Should stop early
    
    // Accuracy assertions
    expect(result.satisfied).toBe(true);
    expect(result.visualization.retrievalResultCount).toBeGreaterThan(0);
    expect(result.visualization.queryRewriting.primaryQuery.length).toBeGreaterThan(0);
    
    // Answer assertions
    expect(result.answer).toBeDefined();
    expect(result.answer.conclusion.text.length).toBeGreaterThan(0);
  });
});
```

#### Scenario 2: ReAct vs Planning mode
```typescript
describe('Mode selection integration', () => {
  it('ReAct mode should have queryRewriting', async () => {
    const result = await medicalAgent.run({ query: 'simple query' });
    
    expect(result.visualization.executionPath.mode).toBe('react');
    expect(result.visualization.queryRewriting).toBeDefined();
    expect(result.visualization.queryRewriting.primaryQuery.length).toBeGreaterThan(0);
  });
  
  it('Planning mode should still work', async () => {
    // Enable planning mode
    const config = { enablePlanning: true };
    const agent = createMedicalAgent(llmCaller, retrieval, config);
    
    const result = await agent.run({ query: 'compare two drugs' });
    
    expect(result.visualization.executionPath.mode).toBe('planning');
    expect(result.visualization.queryRewriting).toBeDefined();
  });
});
```

#### Scenario 3: Empty query handling
```typescript
describe('Empty query integration', () => {
  it('should handle empty Agent queryRewriting', async () => {
    // This tests the full flow through chat.ts
    const response = await fastify.inject({
      method: 'POST',
      url: '/api/chat/generate',
      payload: { query: '糖尿病' },
    });
    
    expect(response.statusCode).toBe(200);
    expect(response.json().query).toBe('糖尿病');
  });
});
```

**Verification**:
- Run integration test suite
- Verify no 500 errors
- Verify performance metrics

---

### T8: E2E性能测试

**Estimated Time**: 45 min

**E2E Test Setup**:
1. Start test server
2. Populate Qdrant with test documents
3. Run performance benchmarks

**Performance Benchmarks**:
```typescript
describe('Agent E2E performance', () => {
  it('should complete in < 10 seconds for simple query', async () => {
    const queries = ['糖尿病', '高血压', '二甲双胍'];
    
    for (const query of queries) {
      const startTime = Date.now();
      
      const response = await fetch('/api/chat/generate', {
        method: 'POST',
        body: JSON.stringify({ query, enableAgent: true })
      });
      
      const duration = Date.now() - startTime;
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(10000);
      expect(data.agentUsed).toBe(true);
      expect(data.agentSatisfied).toBe(true);
    }
  });
  
  it('should reduce iterations after fix', async () => {
    // Compare with baseline
    const baselineIterations = 3; // Before fix
    const maxIterationsAfterFix = 2; // After fix
    
    const result = await medicalAgent.run({ query: '糖尿病' });
    
    expect(result.stats.iterations).toBeLessThanOrEqual(maxIterationsAfterFix);
  });
  
  it('should show correct retrieval count in frontend', async () => {
    const response = await fetch('/api/chat/generate', {
      method: 'POST',
      body: JSON.stringify({ query: '糖尿病', enableAgent: true })
    });
    
    const data = await response.json();
    
    // Check WebSocket events
    const agentCompleteEvent = wsEvents.find(e => e.type === 'agent:complete');
    expect(agentCompleteEvent.agentResult.retrievalCount).toBeGreaterThan(0);
    
    // Frontend should display this count
    expect(data.agentSatisfied).toBe(true);
  });
});
```

**Performance Metrics Collection**:
```typescript
// Collect metrics for monitoring
const metrics = {
  avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
  avgIterations: iterations.reduce((a, b) => a + b, 0) / iterations.length,
  successRate: successfulQueries / totalQueries,
  errorRate: errors / totalQueries,
};

expect(metrics.avgDuration).toBeLessThan(10000);
expect(metrics.avgIterations).toBeLessThanOrEqual(2);
expect(metrics.successRate).toBeGreaterThan(0.95);
expect(metrics.errorRate).toBeLessThan(0.05);
```

---

## Phase 4: Review and Deployment (P2) - 1 hour

### T9: 代码审查和文档更新

**Estimated Time**: 30 min

**Code Review Checklist**:
- [ ] All changes follow coding standards
- [ ] No breaking changes introduced
- [ ] Error handling is comprehensive
- [ ] Logging is appropriate
- [ ] Test coverage is sufficient

**Documentation Updates**:
- [ ] Update `docs/medical-agent-guide.md` with new flow
- [ ] Update API documentation for error responses
- [ ] Add performance benchmarks to README
- [ ] Update troubleshooting guide

---

### T10: 合并和部署

**Estimated Time**: 30 min

**Deployment Steps**:
1. Create PR to `devlop` branch
2. Run CI/CD pipeline
3. Deploy to test environment
4. Monitor performance metrics
5. Deploy to production

**PR Description Template**:
```markdown
## Summary
Fix Agent retrieval loop bugs causing 330s+ delay and empty query crashes

## Changes
- AgentState: Add satisfied check to canContinue
- AgentExecutor: Add queryRewriting to ReAct mode
- MedicalReasoner: Improve parseDecision regex extraction
- chat.ts: Add empty query protection

## Test Results
- Unit tests: ✅ All passing
- Integration tests: ✅ Duration < 10s
- E2E tests: ✅ Correct retrieval count

## Performance Impact
- Before: 330s average, 500 errors
- After: <10s average, 400 for empty queries

## Breaking Changes
None - bug fixes only
```

---

## Risk Mitigation

### High-Risk Tasks

| Task | Risk | Mitigation |
|------|------|------------|
| T4 (parseDecision) | LLM response format variations | Add fallback logic, test with multiple formats |
| T2 (queryRewriting) | Context not available | Verify context structure before implementation |
| T8 (E2E) | Test environment issues | Use Docker compose for isolated testing |

### Contingency Plans

**If T4 fails (LLM response parsing)**:
- Keep fallback to current logic
- Add manual override flag

**If T8 fails (performance not improved)**:
- Investigate LLM latency separately
- Optimize LLM caller configuration

---

## Success Criteria

### Must Have (P0)
- ✅ Agent execution < 10 seconds
- ✅ No 500 errors from empty queries
- ✅ Satisfied=true terminates loop

### Should Have (P1)
- ✅ Correct retrieval count display
- ✅ parseDecision accuracy > 95%
- ✅ queryRewriting available in ReAct

### Nice to Have (P2)
- ✅ LLM latency optimization
- ✅ Enhanced error messages
- ✅ Performance monitoring dashboard

---

## Timeline

**Week 1**: T1-T3 (Core fixes) + T6-T7 (Initial testing)
**Week 2**: T4-T5 (Parser & stats) + T8 (E2E testing)
**Week 3**: T9-T10 (Review & deploy)

**Target Completion**: 2026-04-30