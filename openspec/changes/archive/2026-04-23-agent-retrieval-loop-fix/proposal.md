# Change Proposal: Agent检索循环Bug修复

## Metadata

| Field | Value |
|-------|-------|
| Status | Proposed |
| Created | 2026-04-23 |
| Priority | Critical |
| Impact | High - 影响所有Agent查询的性能和正确性 |

## Problem Statement

当前Agent执行存在**4个连锁Bug**,导致:
1. 检索耗时过长(330秒+,本应<10秒)
2. 空查询崩溃(500错误)
3. 统计显示错误(检索数量:0,实际有9个文档)
4. LLM决策解析错误(action='retrieve'循环)

### 实际案例

**用户查询**: "糖尿病"
**预期耗时**: < 10秒
**实际耗时**: 336925ms (5分37秒)
**错误结果**: 500 Internal Server Error (空查询崩溃)
**前端显示**: 检索数量: 0 (实际找到9个文档)

### 日志证据

```
[agent] [think] LLM decision: action='retrieve', confidence=0.7
[agent] [decide] satisfied=true, retrievalCount=9
[agent] [complete] Max iterations reached ← 只在这里停止!
[ChatRoute] Using Agent rewritten query: "" ← 空查询!
[HybridRetriever] Starting hybrid search for: ""
ERROR: query: "绯栧翱鐗?" ← UTF-8乱码
statusCode: 500
```

## Root Cause Analysis

### Bug #1: Agent循环不终止 (330秒耗时)

**位置**: `src/medical/agent/AgentState.ts:154-161`

```typescript
export function canContinue(state: AgentState): boolean {
  return (
    state.status !== 'completed' &&
    state.status !== 'failed' &&
    !isMaxIterationsReached(state) &&
    !state.error
    // ❌ 缺少: !state.satisfied
  );
}
```

**问题**: `satisfied=true` 后循环仍继续,因为 `canContinue` 不检查 `state.satisfied`  
**影响**: 每轮LLM调用约110秒 × 3轮 ≈ 330秒总耗时  
**证据**: 日志显示 `[decide] satisfied=true` 后仍然进入下一轮迭代

### Bug #2: LLM决策解析错误

**位置**: `src/medical/agent/MedicalReasoner.ts:178-200`

```typescript
private parseDecision(response: string): ReasoningDecision {
  const lowerResponse = response.toLowerCase();
  
  let action = 'answer';
  if (lowerResponse.includes('retrieve') || ...) {
    action = 'retrieve'; // ❌ 匹配到REASON中的'retrieve'
  }
  
  const confidenceMatch = response.match(/confidence[:\s]+(\d+\.?\d*)/i);
  const confidence = confidenceMatch?.[1] ? parseFloat(confidenceMatch[1]) : 0.7;
  // ❌ "CONFIDENCE: 0" → 提取不到 → 默认0.7
  
  return { action, reason: response.slice(0, 200), confidence };
}
```

**问题**: 
- 使用简单 `includes('retrieve')`,匹配到REASON文本中的'retrieve'
- confidence正则失败后默认0.7,而非解析的0

**LLM响应格式**:
```
ACTION: retrieve
REASON: 当前信息不足以构成...需要进一步检索...
CONFIDENCE: 0
```

**解析错误**:
- REASON包含"检索"字样 → 错误匹配为 `action='retrieve'`
- "CONFIDENCE: 0" 正则失败 → 默认返回 0.7

### Bug #3: ReAct模式空查询崩溃

**位置**: 
- `src/medical/agent/AgentExecutor.ts:344` (executeReactMode)
- `src/server/routes/chat.ts:398-400` (retrievalQuery)

**问题链条**:

1. **ReAct模式不调用collectQueryRewriting**
```typescript
// executePlanningMode (有调用)
const queryStrategy = this.context.buildQueryStrategy(entities);
this.collector.collectQueryRewriting(queryStrategy); ← Planning调用

// executeReactMode (❌ 缺少)
private async executeReactMode(query, entities, ...) {
  // ❌ 没有调用 collectQueryRewriting!
  while (canContinue(state)) { ... }
}
```

2. **queryRewriting保持空字符串**
```typescript
// RetrievalVisualization.ts:83
private queryRewriting: QueryRewriting = { 
  primaryQuery: '', // ← 初始空字符串
  expandedTerms: [] 
};
```

3. **chat.ts使用空查询检索**
```typescript
let retrievalQuery = query;
if (agentResult?.visualization?.queryRewriting) {
  retrievalQuery = agentResult.visualization.queryRewriting.primaryQuery; 
  // ← 空字符串 ''
}

const { results } = await retriever.retrieveWithMetadata(retrievalQuery);
// ← 空查询崩溃!
```

**证据**: 日志显示 `[ChatRoute] Using Agent rewritten query: ""`

### Bug #4: 统计数量显示错误

**位置**: `src/server/agent-emitter.ts:203`

```typescript
emitComplete(result: AgentResult): void {
  this.emit('complete', {
    agentResult: {
      satisfied: result.satisfied,
      retrievalCount: result.visualization?.retrievalResultCount ?? 0,
      // ← ReAct模式下 retrievalResultCount = 0
      totalTimeMs: result.stats.totalTimeMs,
      iterations: result.stats.iterations,
      llmCallCount: result.stats.llmCalls,
    },
  });
}
```

**问题根源**:
- `collectExecutionPhase` 只在Planning模式调用(统计DAG检索结果)
- ReAct模式不调用 `collectExecutionPhase`
- ReAct模式也不调用 `setRetrievalResultCount`
- `retrievalResultCount` 保持初始值 0

**矛盾**:
- Agent日志: `找到 9 个相关文档`
- 前端显示: `检索数量: 0`

**数据流错误**:
```
state.retrievalResults (有9个文档) 
  → ❌ 不传递给 collector
  → retrievalResultCount = 0
  → agentEmitter.emitComplete() 发送 0
  → 前端显示 "检索数量: 0"
```

## Proposed Solution

### Core Fix Strategy

采用**分层修复策略**,按优先级顺序:

1. **P0**: 修复循环终止条件 (Bug #1)
2. **P0**: 添加空查询保护 (Bug #3 - chat.ts)
3. **P1**: 修复LLM解析逻辑 (Bug #2)
4. **P1**: ReAct模式设置retrievalCount (Bug #4)

### Implementation Plan

#### Fix #1: canContinue添加satisfied检查

**文件**: `src/medical/agent/AgentState.ts`

```typescript
export function canContinue(state: AgentState): boolean {
  return (
    state.status !== 'completed' &&
    state.status !== 'failed' &&
    !isMaxIterationsReached(state) &&
    !state.satisfied && // ← 添加这一行
    !state.error
  );
}
```

**验证**: 
- satisfied=true 后立即退出循环
- 预期耗时从330秒降至<10秒

#### Fix #2: ReAct模式添加queryRewriting

**文件**: `src/medical/agent/AgentExecutor.ts`

```typescript
private async executeReactMode(query, entities, fallbackReason?) {
  // 在循环开始前添加:
  const queryStrategy = this.context.buildQueryStrategy(entities);
  this.collector.collectQueryRewriting(queryStrategy);
  this.visualizationCallback?.('query_rewrite', {
    primaryQuery: queryStrategy.primaryQuery,
    expandedTerms: queryStrategy.expandedTerms
  });
  
  // ... 原有循环逻辑
}
```

#### Fix #3: chat.ts空查询保护

**文件**: `src/server/routes/chat.ts`

```typescript
// Determine query for retrieval
let retrievalQuery = query;
if (agentResult?.visualization?.queryRewriting?.primaryQuery) {
  const rewrittenQuery = agentResult.visualization
    .queryRewriting.primaryQuery.trim();
  if (rewrittenQuery.length > 0) { // ← 验证非空!
    retrievalQuery = rewrittenQuery;
  }
}

// 确保查询非空
if (!retrievalQuery || retrievalQuery.trim().length === 0) {
  return reply.status(400).send({ error: 'Invalid query' });
}
```

#### Fix #4: LLM决策精确解析

**文件**: `src/medical/agent/MedicalReasoner.ts`

```typescript
private parseDecision(response: string): ReasoningDecision {
  // 精确提取 ACTION (使用正则而非includes)
  const actionMatch = response.match(/ACTION:\s+(\w+)/i);
  let action: ReasoningDecision['action'] = 'answer';
  if (actionMatch) {
    action = actionMatch[1].toLowerCase() as ReasoningDecision['action'];
  }
  
  // 精确提取 CONFIDENCE
  const confMatch = response.match(/CONFIDENCE:\s+([\d.]+)/i);
  const confidence = confMatch ? parseFloat(confMatch[1]) : 0.5;
  
  // 提取 REASON
  const reasonMatch = response.match(/REASON:\s+(.+?)(?=CONFIDENCE|$)/i);
  const reason = reasonMatch?.[1]?.trim() ?? response.slice(0, 200);
  
  return { action, reason, confidence };
}
```

#### Fix #5: ReAct模式设置retrievalCount

**文件**: `src/medical/agent/AgentExecutor.ts`

```typescript
// executeReactMode中,在buildResult前添加:
private async executeReactMode(...) {
  // ... 循环逻辑
  
  // 3. 生成回答前,设置retrievalCount
  const finalRetrievalCount = state.retrievalResults?.length ?? 0;
  this.collector.setRetrievalResultCount(finalRetrievalCount);
  
  // 生成回答
  state = setStatus(state, 'answering');
  const answer = await this.generateAnswer(state);
  state = setAnswer(state, answer);
  
  // ... buildResult
}
```

## Success Criteria

### Performance

- ✅ Agent执行耗时 < 10秒 (当前330秒)
- ✅ LLM调用次数 ≤ 2次 (当前3次)
- ✅ 无空查询崩溃 (当前500错误)

### Accuracy

- ✅ 检索数量显示正确 (9个而非0)
- ✅ LLM action解析准确率 > 95% (当前错误率>50%)
- ✅ satisfied判断生效 (当前不生效)

### Functional

- ✅ ReAct模式生成queryRewriting
- ✅ 空查询被拒绝(400而非500)
- ✅ 循环在satisfied=true后终止

## Test Strategy

### Unit Tests

1. **canContinue测试**
   - satisfied=true → 返回false
   - satisfied=false → 返回true

2. **parseDecision测试**
   - 输入: "ACTION: retrieve\nREASON: 检索\nCONFIDENCE: 0"
   - 输出: action='retrieve', confidence=0
   - 输入: "ACTION: answer\nREASON: 已有足够信息\nCONFIDENCE: 0.9"
   - 输出: action='answer', confidence=0.9

3. **空查询保护测试**
   - primaryQuery="" → 使用原始query
   - primaryQuery="有效查询" → 使用rewritten

### Integration Tests

1. **ReAct模式完整流程**
   - 查询: "糖尿病"
   - 验证:
     - queryRewriting.primaryQuery非空
     - retrievalCount > 0
     - 耗时 < 10秒
     - satisfied=true后终止

2. **空查询崩溃场景**
   - 模拟visualization.queryRewriting.primaryQuery=""
   - 验证返回400而非500

### E2E Tests

```typescript
test('Agent performance fix', async () => {
  const startTime = Date.now();
  const result = await medicalAgent.run({ query: '糖尿病' });
  const duration = Date.now() - startTime;
  
  expect(duration).toBeLessThan(10000); // < 10秒
  expect(result.satisfied).toBe(true);
  expect(result.visualization.retrievalResultCount).toBeGreaterThan(0);
  expect(result.visualization.queryRewriting.primaryQuery.length).toBeGreaterThan(0);
});
```

## Impact Assessment

### High Risk Changes

| Change | Risk | Mitigation |
|--------|------|------------|
| canContinue添加satisfied | 中等 - 可能影响其他循环逻辑 | 充分单元测试覆盖所有状态组合 |
| parseDecision正则提取 | 低 - 更精确的解析 | 保持向后兼容,添加fallback |
| ReAct添加queryRewriting | 低 - 只影响可视化 | 不改变核心执行逻辑 |

### Breaking Changes

- ❌ 无Breaking Changes
- ✅ 所有修改都是Bug修复,不影响API契约

### Dependencies

- 无外部依赖
- 无跨模块影响
- 纯内部逻辑修复

## Alternatives Considered

### Alternative #1: 降低maxIterations

**方案**: 将maxIterations从3降至1  
**优点**: 快速减少耗时  
**缺点**: 
- ❌治标不治本,仍然会错误循环
- ❌降低复杂查询的处理能力  
**结论**: ❌ 不采用

### Alternative #2: 提高confidenceThreshold

**方案**: 提高阈值到0.9,强制提前终止  
**优点**: 减少迭代次数  
**缺点**:
- ❌ 治标不治本,satisfied逻辑仍然错误
- ❌ 降低答案质量(过早终止)  
**结论**: ❌ 不采用

### Alternative #3: 禁用ReAct模式

**方案**: 强制使用Planning模式  
**优点**: Planning模式已有queryRewriting  
**缺点**:
- ❌ Planning模式未稳定
- ❌ 简单查询也会触发复杂规划流程  
**结论**: ❌ 不采用

## Timeline

- **Week 1**: 修复Bug #1和#3 (P0)
- **Week 2**: 修复Bug #2和#4 (P1)
- **Week 3**: 测试验证和部署

## Open Questions

1. ❓ ReAct模式的satisfied判断逻辑是否需要优化?
2. ❓ confidence默认值应该是多少? (当前0.7,建议改为0.5)
3. ❓ 是否需要添加retrieval结果去重逻辑?

## References

- Issue日志: [ChatRoute:Generate] 糖尿病查询耗时336秒
- 相关文档: `docs/medical-agent-guide.md`
- 代码位置: `src/medical/agent/AgentExecutor.ts`, `MedicalReasoner.ts`, `AgentState.ts`