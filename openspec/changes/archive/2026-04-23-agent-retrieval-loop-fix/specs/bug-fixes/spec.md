# Spec: Agent检索循环Bug修复

## 概述

本规格说明定义修复Agent执行中的4个关键Bug的技术规范。

## Bug #1: 循环终止条件

### 问题
`canContinue()` 函数不检查 `state.satisfied`，导致循环在 `satisfied=true` 后继续执行。

### 规范要求

**必须满足**：
- `canContinue()` 函数必须包含 `!state.satisfied` 条件
- 当 `satisfied=true` 时，循环必须立即终止

**验收标准**：
```typescript
// AgentState.ts
export function canContinue(state: AgentState): boolean {
  return (
    state.status !== 'completed' &&
    state.status !== 'failed' &&
    !isMaxIterationsReached(state) &&
    !state.satisfied &&  // REQUIRED
    !state.error
  );
}
```

**测试**：
- 单元测试验证 `satisfied=true` → `canContinue=false`
- Agent 执行日志显示 `totalIterations ≤ 2`

---

## Bug #2: LLM响应解析

### 问题
`parseDecision()` 使用简单的 `includes()` 匹配，导致误匹配 REASON 文本中的关键词。

### 规范要求

**必须满足**：
- 使用正则精确提取 `ACTION:\s+(\w+)`
- 使用正则精确提取 `CONFIDENCE:\s+([\d.]+)`
- 验证提取的 action 在合法列表中
- Confidence 默认值 ≤ 0.5

**验收标准**：
```typescript
// MedicalReasoner.ts
const actionMatch = response.match(/ACTION:\s+(\w+)/i);
const confMatch = response.match(/CONFIDENCE:\s+([\d.]+)/i);

// 必须验证action合法性
const validActions = ['retrieve', 'expand_query', 'answer', 'need_more'];
if (validActions.includes(extractedAction)) {
  action = extractedAction;
}
```

**测试**：
- 输入包含 "检索" 关键词的 REASON → action 不误匹配
- 输入 "CONFIDENCE: 0" → confidence = 0 (非默认值)

---

## Bug #3: ReAct模式空查询

### 问题
ReAct模式不生成 `queryRewriting`，导致 `primaryQuery=""`，触发 HybridRetriever 崩溃。

### 规范要求

**必须满足**：
- `executeReactMode` 在循环开始前调用 `collectQueryRewriting`
- chat.ts 验证 `retrievalQuery` 非空
- 空查询返回 400 错误（而非 500）

**验收标准**：
```typescript
// AgentExecutor.ts - executeReactMode
const queryStrategy = this.context.buildQueryStrategy(entities);
this.collector.collectQueryRewriting(queryStrategy);

// chat.ts - 空查询保护
if (!retrievalQuery || retrievalQuery.trim().length === 0) {
  return reply.status(400).send({ error: 'Invalid query' });
}
```

**测试**：
- ReAct模式执行后 `visualization.queryRewriting.primaryQuery` 非空
- 空查询请求返回 HTTP 400

---

## Bug #4: 检索统计显示

### 问题
ReAct模式不设置 `retrievalResultCount`，导致前端显示 "检索数量: 0"。

### 规范要求

**必须满足**：
- `executeReactMode` 在循环结束后调用 `setRetrievalResultCount`
- `retrievalCount` 等于 `state.retrievalResults.length`

**验收标准**：
```typescript
// AgentExecutor.ts
const finalRetrievalCount = state.retrievalResults?.length ?? 0;
this.collector.setRetrievalResultCount(finalRetrievalCount);
```

**测试**：
- Agent 执行日志显示 `[complete] Final retrieval count set`
- WebSocket 事件 `agentResult.retrievalCount` > 0

---

## 性能要求

| 指标 | 目标 |
|------|------|
| 迭代次数 | ≤ 2次（修复前: 3次） |
| LLM调用 | ≤ 2次（修复前: 3次） |
| 执行时间 | < 15秒（修复前: ~330秒） |

---

## 安全要求

- 空查询必须返回 400（非 500 崩溃）
- 无 Breaking Changes（仅 Bug 修复）
- 所有修改需要单元测试覆盖

---

## 文档要求

- 更新 `docs/medical-agent-guide.md`
- 更新 `README.md` 性能基准和API错误表
- 添加故障排除章节