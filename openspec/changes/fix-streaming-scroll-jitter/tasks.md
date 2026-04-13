# Tasks: fix-streaming-scroll-jitter

## 1. 修复滚动 useEffect 依赖

- [x] 1.1 移除流式状态从滚动依赖
- [x] 1.2 实现消息完成时滚动

## 2. 修复 WebSocket 多连接导致的重复内容问题

- [x] 2.1 创建 WebSocket 单例模块 (使用 window 对象存储)
- [x] 2.2 重构 useWebSocket hook 使用单例
- [x] 2.3 添加后端 WebSocket 调试日志

## 3. 简化动画效果

- [x] 3.1 移除 "实时" badge 动画
- [x] 3.2 简化 ⏳ 旋转动画
- [x] 3.3 保留光标跳动动画

## 4. 防止 generation:complete 重复处理

- [x] 4.1 添加 lastCompleteTimestamp 防重机制
  - 在 handleGenerationComplete 中检查是否在 2秒内已处理过
  - 如果重复则跳过，避免消息被添加两次
- [x] 4.2 在 handleGenerationStart 中重置防重标志
- [x] 4.3 添加详细调试日志

## 5. 验证测试

- [ ] 5.1 检查服务器日志 - 客户端应为 1，generation:complete 只广播一次
- [ ] 5.2 检查浏览器控制台 - handleGenerationComplete 只调用一次
- [ ] 5.3 测试最终输出 - 只显示一个答案块

## 4. 验证测试

- [ ] 4.1 测试流式传输滚动行为
  - 发送查询，观察思考过程流式显示
  - 确认页面不再跳动

- [ ] 4.2 测试消息完成滚动
  - 确认消息完成后自动滚动到底部
  - 确认 smooth 动画正常

- [ ] 4.3 测试长思考过程
  - 测试思考过程超过 1000 字符的情况
  - 确认用户可以手动滚动查看开头