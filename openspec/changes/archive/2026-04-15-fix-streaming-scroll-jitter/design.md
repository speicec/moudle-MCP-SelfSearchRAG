# Design: fix-streaming-scroll-jitter

## Context

### 当前实现问题

```tsx
// ChatWindow.tsx 第 99-102 行
useEffect(() => {
  messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
}, [messages, currentAnswer, currentThinking]);  // ⚠️ 问题所在
```

### 问题链条

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     问题流程图                                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  DeepSeek SSE Stream                                                        │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Chunk #1: "嗯"                                                     │   │
│  │  Chunk #2: "用户"                                                   │   │
│  │  Chunk #3: "问的是"                                                 │   │
│  │  Chunk #4: "全身麻醉"                                               │   │
│  │  ...                                                                │   │
│  │  Chunk #200: "所以"                                                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│         │                                                                   │
│         │  每个 chunk 触发 WebSocket broadcast                              │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  handleGenerationThinking("嗯")                                     │   │
│  │  handleGenerationThinking("用户")                                   │   │
│  │  handleGenerationThinking("问的是")                                 │   │
│  │  ...                                                                │   │
│  │                                                                     │   │
│  │  结果: currentThinking 状态更新 200+ 次                             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│         │                                                                   │
│         │  每次 state 更新触发 useEffect                                    │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  useEffect(() => {                                                  │   │
│  │    scrollIntoView({ behavior: 'smooth' });  // 执行 200+ 次        │   │
│  │  }, [currentThinking]);                                             │   │
│  │                                                                     │   │
│  │  ⚠️ smooth 动画需要 500ms 完成                                      │   │
│  │  但 chunks 每 10-50ms 就到达                                        │   │
│  │  结果: 动画叠加 = 页面跳动                                          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  最终效果: 页面不停滚动跳动，用户无法正常阅读                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 动画叠加问题

当前同时运行的动画：
1. ⏳ 旋转动画: `rotate: 360` (repeat: Infinity)
2. 光标跳动: `opacity: [0, 1, 0]` (repeat: Infinity)
3. "实时" badge: `opacity: [1, 0.5, 1]` (repeat: Infinity)
4. scrollIntoView smooth 动画 (500ms)

这些动画叠加 + 频繁状态更新 = 视觉混乱

## Goals / Non-Goals

**Goals:**
- 修复滚动跳动问题，流式传输时页面稳定
- 简化动画，减少视觉混乱
- 保持消息完成后自动滚动到底部

**Non-Goals:**
- 不修改 WebSocket 事件处理
- 不修改 API 响应格式
- 不修改数据流架构

## Decisions

### Decision 1: 滚动触发时机 - 仅在消息完成时

**选择**: 只在 `isGenerating` 从 true 变为 false 时滚动

**理由**:
- 流式传输期间不需要滚动，用户已经在看最新内容
- 消息完成时滚动确保用户看到完整答案
- 完全避免频繁触发问题

**实现**:
```tsx
useEffect(() => {
  // 只在消息完成时滚动
  if (!isGenerating && messages.length > 0) {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }
}, [isGenerating, messages.length]);
```

### Decision 2: 流式期间的滚动 - 使用 auto + debounce

**选择**: 流式期间仅用 `auto` 滚动，无动画

**理由**:
- `behavior: 'smooth'` 动画需要时间完成
- 流式期间滚动太频繁，smooth 动画会叠加
- `behavior: 'auto'` 立即滚动，无动画冲突

**实现**:
```tsx
// 流式期间：debounce + auto
const scrollToBottomDebounced = useRef(
  debounce(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
  }, 300)
).current;

useEffect(() => {
  if (isGenerating) {
    scrollToBottomDebounced();
  }
}, [currentAnswer, currentThinking, isGenerating]);
```

### Decision 3: 动画简化 - 保留核心动画

**选择**: 保留光标动画，移除次要动画

**保留**:
- 光标跳动动画 (答案流式显示需要)

**移除**:
- "实时" badge 动画 (改为静态文字)
- ⏳ 旋转改为静态图标

## Risks / Trade-offs

### Risk 1: 用户可能看不到思考过程开头
- **影响**: 思考过程很长时，用户可能错过开头
- **缓解**: 用户可以手动滚动查看；思考过程默认折叠

### Trade-off 1: 流式期间不 smooth 滚动
- **选择**: 使用 auto 或 debounce
- **代价**: 流式期间滚动没有平滑过渡
- **收益**: 避免跳动问题

## Implementation Plan

### Phase 1: 修复滚动 useEffect
1. 移除 `currentThinking`, `currentAnswer` 从滚动依赖
2. 只在 `isGenerating` 变化时滚动

### Phase 2: 添加 debounce 滚动 (可选)
1. 流式期间使用 debounce 滚动
2. 消息完成时使用 smooth 滚动

### Phase 3: 简化动画
1. 移除 "实时" badge 动画
2. 简化 ⏳ 旋转为静态图标