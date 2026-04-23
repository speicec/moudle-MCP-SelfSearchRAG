# Technical Design: Agent检索循环Bug修复

## Overview

本文档详细描述修复Agent检索循环4个连锁Bug的技术设计和实现细节。

## Architecture Context

### Current Agent Execution Flow

```
┌─────────────────────────────────────────────────────────────┐
│                   MedicalAgent Execution Flow                │
└─────────────────────────────────────────────────────────────┘

                    ┌────────────┐
                    │ User Query │
                    └──────┬─────┘
                           │
                           ▼
               ┌──────────────────────┐
               │ MedicalAgent.run()   │
               │  - extractEntities   │
               │  - buildQueryStrategy│
               └──────┬───────────────┘
                      │
                      ▼
        ┌─────────────────────────────┐
        │ AgentExecutor.run()         │
        │  - chooseExecutionMode      │
        │    (react vs planning)      │
        └──────┬──────────────────────┘
               │
               ├─────────────┬───────────────────┐
               │             │                   │
               ▼             ▼                   ▼
    ┌──────────────┐  ┌────────────────┐  ┌───────────────┐
    │ Planning     │  │ ReAct Loop     │  │ ❌ Current    │
    │ Mode         │  │ (Bug Location) │  │ Bugs          │
    └──────────────┘  └────────────────┘  └───────────────┘
                          │                      │
                          │                      │
                          ▼                      ▼
               ┌──────────────────┐    ┌─────────────────┐
               │ while(canContinue│    │ Bug #1:        │
               │  (state)) {      │    │ canContinue    │
               │                  │    │ 缺少satisfied  │
               │  THINK           │    │ 检查           │
               │  ACT             │    └─────────────────┘
               │  OBSERVE         │              │
               │  DECIDE          │              ▼
               │ }                │    ┌─────────────────┐
               └──────────────────┘    │ Bug #2:        │
                       │               │ parseDecision  │
                       │               │ 精确度不足     │
                       ▼               └─────────────────┘
             ┌────────────────┐               │
             │ buildResult    │               ▼
             │  - collector   │    ┌─────────────────┐
             │    .buildVis() │    │ Bug #3:        │
             └────────────────┘    │ ReAct缺少      │
                       │           │ queryRewriting │
                       │           └─────────────────┘
                       ▼                   │
            ┌─────────────────┐            ▼
            │ AgentResult     │  ┌─────────────────┐
            │  - answer       │  │ Bug #4:         │
            │  - visualization│  │ retrievalCount  │
            │    .retrieval.. │  │ = 0             │
            │    .queryRew..  │  └─────────────────┘
            └─────────────────┘
                       │
                       ▼
            ┌─────────────────┐
            │ chat.ts         │  ❌ 使用空query崩溃
            │  - retrieval    │  (Bug #3)
            │    Query=""     │
            └─────────────────┘
```

### Data Flow Issues

```
┌─────────────────────────────────────────────────────────────┐
│              Current Data Flow (有4个断裂点)                │
└─────────────────────────────────────────────────────────────┘

1. LLM Response → parseDecision
   ┌──────────────────────────────────────┐
   │ "ACTION: retrieve"                   │
   │ "REASON: ...检索..." ← ❌ 匹配这个  │
   │ "CONFIDENCE: 0" ← ❌ 正则失败       │
   └──────────────────────────────────────┘
                    │
                    ▼
   ┌──────────────────────────────────────┐
   │ parseDecision output:                │
   │  action = 'retrieve' (错误!)         │
   │  confidence = 0.7 (默认值!)          │
   └──────────────────────────────────────┘

2. satisfied → canContinue
   ┌──────────────────────────────────────┐
   │ AgentState.satisfied = true          │
   └──────────────────────────────────────┘
                    │
                    ▼
   ┌──────────────────────────────────────┐
   │ canContinue(state)                   │
   │  ❌ 不检查 state.satisfied          │
   │  → 返回 true (继续循环!)            │
   └──────────────────────────────────────┘

3. ReAct → queryRewriting
   ┌──────────────────────────────────────┐
   │ executeReactMode                     │
   │  ❌ 没有调用 collectQueryRewriting │
   └──────────────────────────────────────┘
                    │
                    ▼
   ┌──────────────────────────────────────┐
   │ VisualizationCollector               │
   │  queryRewriting.primaryQuery = ""   │
   └──────────────────────────────────────┘

4. retrievalResults → retrievalCount
   ┌──────────────────────────────────────┐
   │ state.retrievalResults (9个文档)    │
   └──────────────────────────────────────┘
                    │
                    ▼ (❌ 不传递给collector)
   ┌──────────────────────────────────────┐
   │ VisualizationCollector               │
   │  retrievalResultCount = 0 (初始值)  │
   └──────────────────────────────────────┘
                    │
                    ▼
   ┌──────────────────────────────────────┐
   │ agentEmitter.emitComplete           │
   │  retrievalCount: 0 ← 错误!          │
   └──────────────────────────────────────┘
```

## Detailed Fix Design

### Fix #1: AgentState.canContinue

**问题**: 循环不检查 `satisfied` 状态

**设计**: 添加 `!state.satisfied` 条件到 `canContinue`

**修改文件**: `src/medical/agent/AgentState.ts`

**修改位置**: Line 154-161

```typescript
// Before (当前代码)
export function canContinue(state: AgentState): boolean {
  return (
    state.status !== 'completed' &&
    state.status !== 'failed' &&
    !isMaxIterationsReached(state) &&
    !state.error
  );
}

// After (修复后)
export function canContinue(state: AgentState): boolean {
  return (
    state.status !== 'completed' &&
    state.status !== 'failed' &&
    !isMaxIterationsReached(state) &&
    !state.satisfied &&  // ✅ 添加satisfied检查
    !state.error
  );
}
```

**影响分析**:
- ✅ Positive: 循环在satisfied=true时立即终止
- ✅ Positive: 减少不必要的迭代和LLM调用
- ⚠️ Risk: 需要确保其他地方正确设置satisfied
- ✅ Mitigation: 单元测试验证所有状态组合

**测试验证**:
```typescript
describe('canContinue with satisfied', () => {
  it('should return false when satisfied=true', () => {
    const state = createInitialState('test', mockEntities);
    state.satisfied = true;
    expect(canContinue(state)).toBe(false);
  });
  
  it('should return true when satisfied=false', () => {
    const state = createInitialState('test', mockEntities);
    state.satisfied = false;
    expect(canContinue(state)).toBe(true);
  });
});
```

### Fix #2: MedicalReasoner.parseDecision

**问题**: 字符串匹配不精确,默认值不合理

**设计**: 使用正则精确提取ACTION和CONFIDENCE

**修改文件**: `src/medical/agent/MedicalReasoner.ts`

**修改位置**: Line 178-200

```typescript
// Before (当前代码)
private parseDecision(response: string): ReasoningDecision {
  const lowerResponse = response.toLowerCase();
  
  let action: ReasoningDecision['action'] = 'answer';
  if (lowerResponse.includes('retrieve') || lowerResponse.includes('检索')) {
    action = 'retrieve';  // ❌ 匹配到REASON中的'retrieve'
  } else if (lowerResponse.includes('expand') || ...) {
    action = 'expand_query';
  } else if (lowerResponse.includes('need_more') || ...) {
    action = 'need_more';
  }
  
  const confidenceMatch = response.match(/confidence[:\s]+(\d+\.?\d*)/i);
  const confidence = confidenceMatch && confidenceMatch[1] 
    ? parseFloat(confidenceMatch[1]) 
    : 0.7;  // ❌ 默认值太高
  
  return { action, reason: response.slice(0, 200), confidence };
}

// After (修复后)
private parseDecision(response: string): ReasoningDecision {
  // ✅ 精确提取 ACTION
  const actionMatch = response.match(/ACTION:\s+(\w+)/i);
  let action: ReasoningDecision['action'] = 'answer';
  
  if (actionMatch) {
    const extractedAction = actionMatch[1].toLowerCase();
    // 验证action是否合法
    const validActions = ['retrieve', 'expand_query', 'answer', 'need_more'];
    if (validActions.includes(extractedAction)) {
      action = extractedAction as ReasoningDecision['action'];
    }
  }
  
  // ✅ 精确提取 CONFIDENCE
  const confMatch = response.match(/CONFIDENCE:\s+([\d.]+)/i);
  const confidence = confMatch 
    ? parseFloat(confMatch[1]) 
    : 0.5;  // ✅ 降低默认值到0.5
  
  // ✅ 精确提取 REASON
  const reasonMatch = response.match(/REASON:\s+(.+?)(?=CONFIDENCE|$)/is);
  const reason = reasonMatch?.[1]?.trim() ?? response.slice(0, 200);
  
  return { action, reason, confidence };
}
```

**改进点**:
- ✅ 使用正则 `ACTION:\s+(\w+)` 精确提取
- ✅ 验证action是否在合法列表中
- ✅ confidence默认值降低到0.5
- ✅ REASON使用多行模式匹配,避免截断

**LLM响应格式规范**:
```
ACTION: <retrieve|expand_query|answer|need_more>
REASON: <详细分析文本,可能包含"检索"等关键词>
CONFIDENCE: <0.0-1.0>
```

**测试验证**:
```typescript
describe('parseDecision regex extraction', () => {
  it('should extract ACTION correctly', () => {
    const response = `ACTION: retrieve\nREASON: 需要检索\nCONFIDENCE: 0.6`;
    const result = parseDecision(response);
    expect(result.action).toBe('retrieve');
    expect(result.confidence).toBe(0.6);
  });
  
  it('should not match REASON keywords', () => {
    const response = `ACTION: answer\nREASON: 已检索到足够信息\nCONFIDENCE: 0.8`;
    const result = parseDecision(response);
    expect(result.action).toBe('answer'); // ✅ 不会错误匹配为retrieve
  });
  
  it('should use default confidence when missing', () => {
    const response = `ACTION: retrieve\nREASON: 测试`;
    const result = parseDecision(response);
    expect(result.confidence).toBe(0.5); // ✅ 默认值
  });
});
```

### Fix #3: ReAct模式添加queryRewriting

**问题**: ReAct模式不调用 `collectQueryRewriting`,导致空查询

**设计**: 在 `executeReactMode` 开始前添加查询策略收集

**修改文件**: `src/medical/agent/AgentExecutor.ts`

**修改位置**: Line 344 (executeReactMode开始)

```typescript
// Before (当前代码)
private async executeReactMode(query: string, entities, fallbackReason?) {
  // ❌ 没有queryRewriting相关代码
  
  // 1. 初始化状态
  let state = createInitialState(query, entities, this.config.maxIterations);
  
  // ... 安全检查
  
  // 2. 主循环
  while (canContinue(state)) { ... }
  
  // ...
}

// After (修复后)
private async executeReactMode(query: string, entities, fallbackReason?) {
  // ✅ 0. 构建查询策略 (新增)
  const queryStrategy = this.context.buildQueryStrategy(entities);
  this.collector.collectQueryRewriting(queryStrategy);
  this.visualizationCallback?.('query_rewrite', {
    primaryQuery: queryStrategy.primaryQuery,
    expandedTerms: queryStrategy.expandedTerms
  });
  
  this.logger.log(0, 'think', 'Query strategy built', {
    primaryQuery: queryStrategy.primaryQuery,
    expandedTerms: queryStrategy.expandedTerms,
  });
  
  // 1. 初始化状态
  let state = createInitialState(query, entities, this.config.maxIterations);
  
  // ... 原有安全检查
  
  // 2. 主循环
  while (canContinue(state)) { ... }
  
  // 3. ✅ 设置retrievalCount (新增)
  const finalRetrievalCount = state.retrievalResults?.length ?? 0;
  this.collector.setRetrievalResultCount(finalRetrievalCount);
  this.logger.log(state.iteration, 'complete', 'Final retrieval count', {
    count: finalRetrievalCount
  });
  
  // ... 原有buildResult
}
```

**新增逻辑**:
- Line 344-352: 添加queryStrategy构建和收集
- Line 446-449: 在buildResult前设置retrievalCount

**数据流修复**:
```
ReAct模式开始
  → buildQueryStrategy(entities)
  → collectQueryRewriting(queryStrategy)
  → queryRewriting.primaryQuery = "2型糖尿病"
  → VisualizationCollector有数据了!

循环结束
  → state.retrievalResults.length = 9
  → collector.setRetrievalResultCount(9)
  → retrievalResultCount = 9
  → agentEmitter发送正确的count
```

### Fix #4: chat.ts空查询保护

**问题**: 使用空字符串查询导致HybridRetriever崩溃

**设计**: 添加空查询验证,fallback到原始query

**修改文件**: `src/server/routes/chat.ts`

**修改位置**: Line 393-402

```typescript
// Before (当前代码)
let retrievalQuery = query;
if (agentResult?.visualization?.queryRewriting) {
  retrievalQuery = agentResult.visualization.queryRewriting.primaryQuery;
  // ❌ 可能是空字符串 ""
  console.log(`Using Agent rewritten query: "${retrievalQuery}"`);
}

const { results, context } = await retriever.retrieveWithMetadata(retrievalQuery);
// ❌ 空查询崩溃

// After (修复后)
let retrievalQuery = query;

if (agentResult?.visualization?.queryRewriting?.primaryQuery) {
  const rewrittenQuery = agentResult.visualization
    .queryRewriting.primaryQuery.trim();
  
  // ✅ 验证rewrittenQuery非空
  if (rewrittenQuery.length > 0) {
    retrievalQuery = rewrittenQuery;
    console.log(`Using Agent rewritten query: "${retrievalQuery}"`);
  } else {
    // ✅ Fallback到原始query
    console.warn(`Agent rewritten query is empty, using original: "${query}"`);
    retrievalQuery = query;
  }
}

// ✅ 最终空查询保护
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

**防护层级**:
1. Primary: 使用rewrittenQuery前验证非空
2. Fallback: 如果空,使用原始query
3. Final: 如果最终还是空,返回400错误

**测试验证**:
```typescript
describe('chat.ts empty query protection', () => {
  it('should use original query when rewritten is empty', async () => {
    const agentResult = {
      visualization: {
        queryRewriting: { primaryQuery: '', expandedTerms: [] }
      }
    };
    
    // Mock retriever
    const retriever = { retrieveWithMetadata: jest.fn() };
    
    await chatRoute(agentResult, retriever);
    
    expect(retriever.retrieveWithMetadata).toHaveBeenCalledWith('糖尿病'); // 原始query
  });
  
  it('should return 400 when both queries are empty', async () => {
    const query = '';
    const agentResult = { visualization: { queryRewriting: { primaryQuery: '' } } };
    
    const response = await chatRoute(query, agentResult);
    
    expect(response.statusCode).toBe(400);
    expect(response.error).toBe('Invalid query');
  });
});
```

## Integration Points

### AgentExecutor ↔ VisualizationCollector

```
executeReactMode 开始
  │
  ├─ collector.collectQueryRewriting(queryStrategy)
  │    → queryRewriting.primaryQuery = "..."
  │
  ├─ while (canContinue)
  │    └─ ACT → OBSERVE
  │         → state.retrievalResults.push(...)
  │
  └─ collector.setRetrievalResultCount(state.retrievalResults.length)
       → retrievalResultCount = 9
```

### AgentResult ↔ agentEmitter

```
AgentResult {
  visualization: {
    queryRewriting: { primaryQuery: "2型糖尿病", ... },
    retrievalResultCount: 9
  }
}
  │
  └─ agentEmitter.emitComplete(result)
       → WebSocket event: {
           type: 'agent:complete',
           agentResult: {
             satisfied: true,
             retrievalCount: 9, // ✅ 正确!
             totalTimeMs: 8000,
             iterations: 1
           }
         }
```

### agentEmitter ↔ Frontend

```
Frontend useRetrievalStore
  │
  └─ handleAgentComplete(agentResult)
       → agentResult.retrievalCount = 9
       → UI显示: "检索数量: 9" ✅ 正确!
```

## Performance Impact Analysis

### Before Fix

```
Agent执行流程 (330秒):
Iteration 1:
  THINK (LLM call) → 110秒
  parseDecision → action='retrieve' (错误!)
  ACT → retrieve (已有结果)
  OBSERVE → 找到9个文档
  DECIDE → satisfied=true
  
  ❌ canContinue检查不包含satisfied → 继续循环!

Iteration 2:
  THINK (LLM call) → 110秒
  parseDecision → action='retrieve' (错误!)
  ACT → retrieve (重复!)
  ...

Iteration 3:
  THINK (LLM call) → 110秒
  ...
  
Total: 330秒 + 空查询崩溃
```

### After Fix

```
Agent执行流程 (<10秒):
Iteration 1:
  THINK (LLM call) → 110秒 (需要优化LLM调用速度)
  parseDecision → action='retrieve' (正确解析)
  ACT → retrieve
  OBSERVE → 找到9个文档
  DECIDE → satisfied=true
  
  ✅ canContinue检查satisfied → false → 退出循环!

Final:
  buildResult → totalTimeMs: 110秒

后续优化:
  - LLM调用速度优化 (另开Change)
  - 缓存机制
  - 模型选择优化
```

## Edge Cases

### Case #1: ReAct模式无检索结果

**场景**: 查询无匹配,`state.retrievalResults.length = 0`

**处理**:
```typescript
// setRetrievalResultCount接受0
const finalRetrievalCount = state.retrievalResults?.length ?? 0;
this.collector.setRetrievalResultCount(finalRetrievalCount); // 0

// agentEmitter发送
retrievalCount: 0 // ✅ 正确显示"无结果"
```

### Case #2: Planning模式

**场景**: 使用Planning而非ReAct模式

**处理**:
- Planning模式已有 `collectExecutionPhase` 设置count
- Planning模式已有 `collectQueryRewriting`
- ✅ 无需额外修改

### Case #3: confidence解析失败

**场景**: LLM返回格式错误,无法解析confidence

**处理**:
```typescript
const confMatch = response.match(/CONFIDENCE:\s+([\d.]+)/i);
const confidence = confMatch 
  ? parseFloat(confMatch[1]) 
  : 0.5; // ✅ Fallback到保守值

// 不会因为解析失败而崩溃
```

### Case #4: queryRewriting生成失败

**场景**: `buildQueryStrategy`返回空字符串

**处理**:
```typescript
if (rewrittenQuery.length > 0) {
  retrievalQuery = rewrittenQuery;
} else {
  retrievalQuery = query; // ✅ Fallback到原始query
}
```

## Testing Strategy

### Unit Test Coverage

```
AgentState.test.ts
├─ canContinue
│  ├─ satisfied=true → false ✅
│  ├─ satisfied=false → true ✅
│  ├─ status=completed → false ✅
│  ├─ maxIterations reached → false ✅
│  └─ error set → false ✅

MedicalReasoner.test.ts
├─ parseDecision
│  ├─ 正确提取ACTION ✅
│  ├─ 不匹配REASON关键词 ✅
│  ├─ 正确提取CONFIDENCE ✅
│  ├─ confidence默认值 ✅
│  ├─ 格式错误fallback ✅
│  └─ action验证 ✅

AgentExecutor.test.ts
├─ executeReactMode
│  ├─ collectQueryRewriting调用 ✅
│  ├─ setRetrievalResultCount调用 ✅
│  ├─ satisfied终止循环 ✅

chat.test.ts
├─ retrievalQuery空查询保护
│  ├─ rewrittenQuery非空 → 使用 ✅
│  ├─ rewrittenQuery空 → fallback ✅
│  ├─ 全空 → 400错误 ✅
```

### Integration Test

```typescript
describe('Agent performance integration', () => {
  it('should complete in < 10 seconds', async () => {
    const startTime = Date.now();
    
    const result = await medicalAgent.run({ query: '糖尿病' });
    
    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(10000);
  });
  
  it('should stop when satisfied', async () => {
    const result = await medicalAgent.run({ query: '糖尿病' });
    
    expect(result.satisfied).toBe(true);
    expect(result.stats.iterations).toBeLessThanOrEqual(2);
  });
  
  it('should have correct retrievalCount', async () => {
    const result = await medicalAgent.run({ query: '糖尿病' });
    
    expect(result.visualization.retrievalResultCount).toBeGreaterThan(0);
    // 前端应该显示正确的count
  });
  
  it('should have non-empty queryRewriting', async () => {
    const result = await medicalAgent.run({ query: '糖尿病' });
    
    expect(result.visualization.queryRewriting.primaryQuery.length).toBeGreaterThan(0);
  });
});
```

### Regression Test

确保修复不影响现有功能:

```typescript
describe('Regression tests', () => {
  it('Planning mode still works', async () => {
    // Planning模式应该不受影响
    const result = await medicalAgent.run({ query: 'compare drugs' });
    expect(result.visualization.executionPath.mode).toBe('planning');
  });
  
  it('Simple query still gets answer', async () => {
    const result = await medicalAgent.run({ query: 'simple question' });
    expect(result.answer).toBeDefined();
  });
  
  it('Max iterations still works', async () => {
    // 如果satisfied一直false,仍然应该有maxIterations保护
    const config = { maxIterations: 3 };
    const result = await medicalAgent.run({ query: 'complex' }, config);
    expect(result.stats.iterations).toBeLessThanOrEqual(3);
  });
});
```

## Implementation Checklist

- [ ] **Phase 1: Core Fixes (P0)**
  - [ ] AgentState.canContinue添加satisfied检查
  - [ ] AgentExecutor.executeReactMode添加queryRewriting
  - [ ] chat.ts添加空查询保护
  
- [ ] **Phase 2: Parser Fixes (P1)**
  - [ ] MedicalReasoner.parseDecision正则提取
  - [ ] confidence默认值调整
  
- [ ] **Phase 3: Statistics Fixes (P1)**
  - [ ] AgentExecutor.executeReactMode设置retrievalCount
  
- [ ] **Phase 4: Testing**
  - [ ] 单元测试编写
  - [ ] 集成测试验证
  - [ ] E2E测试运行
  
- [ ] **Phase 5: Deployment**
  - [ ] 代码审查
  - [ ] 合并到develop
  - [ ] 部署测试环境
  - [ ] 验证性能指标

## Monitoring and Validation

### Performance Metrics

**监控指标**:
- Agent执行平均耗时 (目标: < 10秒)
- LLM调用次数 (目标: ≤ 2次)
- satisfied生效率 (目标: 100%)
- 空查询错误率 (目标: 0%)

**日志验证**:
```
期望日志:
[agent] [think] LLM decision: action='retrieve', confidence=0.7
[agent] [observe] 找到 9 个相关文档
[agent] [decide] satisfied=true
[agent] [complete] Agent execution completed ← ✅ 立即完成!
[ChatRoute] Using Agent rewritten query: "2型糖尿病" ← ✅ 非空!
Total duration: 8000ms ← ✅ < 10秒!
```

### Error Rate Tracking

**错误类型监控**:
- 500错误 (空查询崩溃): 目标降至0%
- parseDecision失败率: 目标<5%
- retrievalCount=0错误显示: 目标降至0%

## Future Optimizations

虽然本次修复解决核心Bug,但仍有优化空间:

### LLM调用速度优化 (Future Change)

当前LLM调用耗时110秒/次,仍有优化空间:
- Prompt优化
- 模型选择 (使用更快的模型)
- 缓存机制 (相似查询缓存)

### Agent决策逻辑优化 (Future Change)

当前DECIDE逻辑简单,可优化:
- 更精确的满足条件判断
- 基于证据质量的decision
- 多维度评估指标

### ReAct vs Planning模式选择优化 (Future Change)

当前模式选择简单,可优化:
- 更精确的复杂度评估
- 查询特征分析
- 自动模式切换