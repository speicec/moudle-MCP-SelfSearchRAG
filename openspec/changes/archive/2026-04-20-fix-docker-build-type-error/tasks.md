## Phase 1: 类型定义修复

### 1. 扩展 PipelineEvent 类型
- [x] 1.1 在 `src/server/types.ts` 的 `PipelineEvent` 接口添加 `startupStage?: StartupStage` 字段
  - 位置：在 `stage?: PipelineStageName` 字段附近
  - 注释说明该字段用于 `startup:progress` 等启动事件

---

## Phase 2: 使用新字段

### 2. 修改广播代码
- [x] 2.1 在 `src/server/http-server.ts` 的 `broadcastProgress` 函数中，使用 `startupStage: progress.stage` 替代 `stage: progress.stage`
  - 行号约 217
  - 确保 `type: 'startup:progress'` 事件使用正确字段

---

## Phase 3: 构建验证

### 3. 本地构建
- [x] 3.1 运行 `npm run build` 确认 TypeScript 编译成功
- [x] 3.2 运行 `npm run build:frontend` 确认前端构建成功

### 4. Docker 构建
- [x] 4.1 运行 `docker build -t rag-server .` 确认 Docker 构建成功
- [x] 4.2 检查构建日志无 TypeScript 错误

---

## Summary

**预期结果:**
- Docker 构建成功
- TypeScript 类型检查通过
- 启动进度 WebSocket 事件使用正确的类型字段