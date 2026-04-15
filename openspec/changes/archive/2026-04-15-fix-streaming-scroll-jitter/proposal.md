# Proposal: fix-streaming-scroll-jitter

## Why

流式传输时页面不停跳动/抖动，严重影响用户体验。

**问题根源**：
- `ChatWindow.tsx` 的 `useEffect` 监听了 `[messages, currentAnswer, currentThinking]`
- 每次 SSE chunk 到达都会更新 `currentThinking` 或 `currentAnswer`
- 这触发 `useEffect` 导致 `scrollIntoView({ behavior: 'smooth' })` 被频繁调用
- DeepSeek `deepseek-reasoner` 模型可能返回数百个 SSE chunks
- 结果：页面每隔几毫秒就滚动一次，视觉上"不停跳动"

**影响**：
- 用户无法正常阅读思考过程
- 页面体验极差，类似"颤抖"效果
- 流式传输的平滑感被破坏

## What Changes

### 前端滚动逻辑优化
- **分离滚动触发条件**: 只在消息完成时滚动，不追踪流式状态变化
- **移除 smooth 动画**: 使用 `auto` 或 debounce 减少滚动频率

### 动画优化
- **减少同时进行的动画**: 光标跳动、"实时" badge、旋转图标叠加造成视觉混乱
- **简化动画**: 保持关键动画，移除次要动画

### **无 Breaking 变化**
- 仅修改滚动行为，不影响数据流
- WebSocket 事件处理不变
- API 响应不变

## Capabilities

### Modified Capabilities
- `chat-tab-interface`: 滚动行为优化，动画简化

## Impact

### 前端文件
- `src/frontend/components/ChatWindow.tsx` - 修复滚动 useEffect 依赖
- `src/frontend/components/ChatWindow.tsx` - 简化动画效果

### 验证方式
- 发送测试查询，观察流式传输时页面是否稳定
- 确认消息完成后滚动到最新消息