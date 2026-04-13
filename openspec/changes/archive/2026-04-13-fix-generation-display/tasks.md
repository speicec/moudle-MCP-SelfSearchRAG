# Tasks: fix-generation-display

## 1. SSE Buffer 修复

- [x] 1.1 修复 LLMGenerationService SSE buffer 处理
  - 修复 `buffer.split('\n')` 后清空问题
  - 保留最后一行不完整内容
  - 正确处理 SSE `\n\n` 分隔符

- [x] 1.2 添加 SSE chunk 调试日志
  - 记录每个接收到的 chunk 内容
  - 记录累积的 thinking/answer 长度
  - 便于诊断复读问题来源

- [x] 1.3 测试 SSE 处理
  - 发送测试请求，检查日志输出
  - 验证无 chunk 丢失或重复处理

## 2. 前端流式状态重构

- [x] 2.1 修改 ChatWindow 状态读取
  - 从 useChatStore 读取 currentThinking, currentAnswer, currentSources
  - 读取 isGenerating, generationPhase 状态
  - 移除本地 extendedMessages 状态

- [x] 2.2 实现实时渲染逻辑
  - isGenerating 时渲染 currentThinking (思考链)
  - isGenerating 时渲染 currentAnswer (答案流)
  - generationPhase 显示当前阶段指示器

- [x] 2.3 实现 complete 状态合并
  - generation:complete 时将流式状态合并到 messages
  - 清空 currentThinking, currentAnswer
  - 保存 results 到 message

- [x] 2.4 实现思考链组件显示
  - ThinkingChainDisplay 使用 currentThinking
  - 显示实时累积的思考内容
  - 添加展开/折叠控制

- [x] 2.5 实现分块卡片显示
  - 使用 currentSources 显示检索结果
  - 添加相似度评分显示
  - 添加展开查看完整内容功能

## 3. Store 状态优化

- [x] 3.1 确保 generationPhase 状态正确流转
  - idle → analysis → retrieval → reasoning → answer → complete
  - 每个阶段正确触发 UI 更新

- [x] 3.2 确保 handleGenerationComplete 正确合并状态
  - 将 currentThinking/currentAnswer 合并为 message
  - 清空临时状态
  - 设置 isGenerating = false

## 4. 集成测试

- [x] 4.1 测试完整流程
  - 发送查询 → 检索 → thinking → answer → complete
  - 验证每个阶段 UI 正确更新

- [x] 4.2 测试思考链显示
  - 验证实时流式显示
  - 验证展开/折叠功能
  - 验证完整内容保存

- [x] 4.3 测试分块卡片
  - 验证检索结果显示
  - 验证相似度评分
  - 验证内容预览

- [x] 4.4 测试复读问题修复
  - 发送多个测试查询
  - 验证无重复内容
  - 检查日志确认 chunk 正常

- [x] 4.5 测试错误处理
  - 测试 DeepSeek API 错误场景
  - 测试 WebSocket 断连场景
  - 验证错误状态正确显示