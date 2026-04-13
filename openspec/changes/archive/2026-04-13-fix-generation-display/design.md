# Design: fix-generation-display

## Context

### 当前架构现状

```
用户查询 ──────────────────────────────────────────────────────────────────────▶

┌─────────────────────────────────────────────────────────────────────────────┐
│                              后端                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  POST /api/chat/generate                                                    │
│         │                                                                   │
│         ▼                                                                   │
│  ┌────────────────────────────┐                                            │
│  │  Retrieval Phase           │                                            │
│  │  (Small-to-Big)            │                                            │
│  │  emit retrieval:* events   │                                            │
│  └────────────────────────────┘                                            │
│         │                                                                   │
│         ▼                                                                   │
│  ┌────────────────────────────┐                                            │
│  │  LLMGenerationService      │                                            │
│  │  generateWithStreaming()   │                                            │
│  │                            │                                            │
│  │  SSE chunks arrive:        │                                            │
│  │    ┌─ reasoning_content    │──▶ emit generation:thinking               │
│  │    └─ content              │──▶ emit generation:answer                 │
│  │                            │                                            │
│  │  ⚠️ SSE Buffer Bug:        │                                            │
│  │    buffer.split('\n')      │                                            │
│  │    buffer = '' (丢失行)    │                                            │
│  └────────────────────────────┘                                            │
│         │                                                                   │
│         ▼                                                                   │
│  return {thinking, answer, results}                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         │ HTTP Response (完整)
         │ WebSocket Events (流式)
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              前端                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌────────────────────────────┐                                            │
│  │  useWebSocket hook         │                                            │
│  │                            │                                            │
│  │  ✓ 监听 generation:* events │                                            │
│  │  ✓ 调用 chatStore handlers │                                            │
│  │                            │                                            │
│  │  Store 状态更新:           │                                            │
│  │    currentThinking += chunk│                                            │
│  │    currentAnswer += chunk  │                                            │
│  │    currentSources = results│                                            │
│  └────────────────────────────┘                                            │
│         │                                                                   │
│         │ Store 状态变化                                                    │
│         │                                                                   │
│         ▼                                                                   │
│  ┌────────────────────────────┐                                            │
│  │  ChatWindow.tsx            │                                            │
│  │                            │                                            │
│  │  ❌ 问题:                   │                                            │
│  │    不读取 currentThinking  │                                            │
│  │    不读取 currentAnswer    │                                            │
│  │    不读取 currentSources   │                                            │
│  │    不读取 isGenerating     │                                            │
│  │                            │                                            │
│  │  ❌ 使用本地状态:           │                                            │
│  │    [extendedMessages]      │                                            │
│  │                            │                                            │
│  │  ❌ 直接 HTTP 请求:         │                                            │
│  │    fetch('/generate')      │                                            │
│  │    await response.json()   │                                            │
│  │                            │                                            │
│  │  ❌ 从 HTTP 响应获取:       │                                            │
│  │    thinking: data.thinking │                                            │
│  │    content: data.answer    │                                            │
│  │    results: data.results   │                                            │
│  │                            │                                            │
│  │  结果:                      │                                            │
│  │    流式事件被忽略！         │                                            │
│  │    最后一次性渲染           │                                            │
│  └────────────────────────────┘                                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 约束条件
- WebSocket 基础设施已完整，事件广播正常
- Store handlers 已实现，状态更新正常
- 问题仅在于 ChatWindow 不使用这些状态

### 相关方
- 用户: 期望实时流式显示思考过程和答案
- 开发者: 需要清晰的流式渲染架构

## Goals / Non-Goals

**Goals:**
- 修复前端流式显示，使用 WebSocket 事件驱动 UI
- 修复 SSE buffer 处理，防止数据丢失
- 添加调试日志，诊断复读问题来源
- 保持向后兼容

**Non-Goals:**
- 不修改 WebSocket 事件格式
- 不修改 HTTP 响应格式
- 不修改 DeepSeek API 调用逻辑
- 不实现多轮对话

## Decisions

### Decision 1: 前端渲染架构 - WebSocket 事件驱动

**选择**: ChatWindow 使用 Store 流式状态，WebSocket 事件驱动渲染

**理由**:
- Store 已有完整的流式状态 (`currentThinking`, `currentAnswer`, `currentSources`)
- WebSocket handlers 已正确更新这些状态
- 只需让 ChatWindow 读取并渲染这些状态

**实现方案**:

```tsx
// ChatWindow.tsx 重构
const ChatWindow = () => {
  // 读取流式状态
  const {
    messages,
    currentThinking,    // ✓ 实时思考内容
    currentAnswer,      // ✓ 实时答案内容  
    currentSources,     // ✓ 检索结果
    isGenerating,       // ✓ 生成状态
    generationPhase,    // ✓ 当前阶段
    submitQuery,
  } = useChatStore();

  // 渲染逻辑
  // - isGenerating 时显示实时 thinking/answer
  // - complete 时将 currentThinking/currentAnswer 加入 messages
};
```

### Decision 2: SSE Buffer 处理修复

**选择**: 正确处理 SSE `\n\n` 分隔符，保留不完整行

**当前实现问题**:
```typescript
// BUG: 当前实现
buffer += decoder.decode(value);
const lines = buffer.split('\n');
buffer = '';  // ❌ 清空 buffer，丢失不完整行
```

**修复方案**:
```typescript
// 正确实现
buffer += decoder.decode(value);

// 只处理完整行 (以 \n 结尾)
const lines = buffer.split('\n');

// 最后一行可能不完整，保留在 buffer
buffer = lines.pop() || '';  // ✓ 保留不完整行

for (const line of lines) {
  if (line.startsWith('data: ')) {
    // 处理完整 SSE 消息
  }
}
```

### Decision 3: 复读问题诊断

**选择**: 添加调试日志，确认复读来源

**诊断方案**:
```typescript
// LLMGenerationService.ts
if (delta?.content) {
  console.log(`[SSE Debug] Chunk received: "${delta.content}"`);
  answerContent += delta.content;
}
```

**可能来源**:
- DeepSeek API 原始响应包含复读 (API 问题)
- SSE buffer 处理导致 chunk 被多次处理 (本地问题)
- 前端渲染多次触发 (前端问题)

需要先添加日志确认，再针对性修复。

## Risks / Trade-offs

### Risk 1: 流式渲染可能影响性能
- **影响**: 高频 WebSocket 事件可能触发大量渲染
- **缓解**: React 自动批处理更新；可添加 debounce

### Risk 2: 复读问题可能是 DeepSeek API 问题
- **影响**: 无法从本地修复
- **缓解**: 添加 chunk 去重逻辑作为 fallback

### Risk 3: 状态同步复杂度增加
- **影响**: 流式状态 vs 消息历史状态管理更复杂
- **缓解**: 清晰的状态转换逻辑，complete 时合并到 messages

## Migration Plan

### Phase 1: SSE Buffer 修复 + 调试日志
1. 修复 LLMGenerationService SSE buffer 处理
2. 添加 chunk 接收日志
3. 测试验证复读问题来源

### Phase 2: 前端流式渲染重构
1. ChatWindow 读取 Store 流式状态
2. 实现实时 thinking/answer 渲染
3. complete 时合并流式状态到 messages
4. 测试流式显示效果

### Phase 3: 集成测试
1. 测试完整流程：检索 → thinking → answer → complete
2. 验证思考链实时显示
3. 验证分块卡片显示
4. 验证无复读问题

## Open Questions

- 复读问题的确切来源？需要日志确认
- 是否需要 chunk 去重逻辑作为 fallback？
- 流式渲染时是否需要添加 loading skeleton？