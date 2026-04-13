# Proposal: fix-generation-display

## Why

当前 LLM 生成回复存在三个严重问题：

1. **思考流程不展示**: `generation:thinking` WebSocket 事件被发送，但前端 ChatWindow 组件不监听这些事件，直接等待 HTTP 响应后才渲染
2. **证据链/分块卡片不展示**: 同上，`currentSources` 状态未被使用
3. **回答复读**: 部分回答出现重复内容，如 "**1. 定义**根据参考资料..." 重复出现多次

这些问题导致用户体验极差：流式生成变成一次性显示，且内容可能重复损坏。

## What Changes

### 前端重构：WebSocket 事件驱动 UI
- **ChatWindow.tsx 重构**: 使用 Store 的流式状态 (`currentThinking`, `currentAnswer`, `currentSources`)，而非本地状态
- **实时渲染**: 思考链和答案在 WebSocket 事件到达时实时更新，而非等待 HTTP 响应

### 后端修复：SSE Buffer 处理
- **LLMGenerationService.ts**: 修复 SSE buffer 处理逻辑，正确处理 `\n\n` 分隔符和不完整行
- **添加调试日志**: 记录原始 SSE chunk 内容，便于诊断复读问题来源

### **无 Breaking 变化**
- `/api/chat/generate` 端点响应格式不变
- WebSocket 事件格式不变
- 仅修复前端渲染逻辑

## Capabilities

### Modified Capabilities
- `thinking-chain-display`: 从 HTTP 响应驱动改为 WebSocket 事件驱动
- `chat-answer-streaming`: 从一次性显示改为实时流式显示
- `llm-generation-service`: SSE buffer 处理逻辑修复

## Impact

### 前端文件
- `src/frontend/components/ChatWindow.tsx` - 重构：使用 Store 流式状态
- `src/frontend/store/index.ts` - 扩展：添加流式状态到 messages 的映射

### 后端文件
- `src/server/services/LLMGenerationService.ts` - 修复 SSE buffer 处理

### 测试验证
- 需验证 DeepSeek 原始 SSE 响应是否包含复读内容
- 需验证前端 WebSocket 事件处理是否正常工作