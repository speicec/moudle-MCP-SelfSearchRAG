## Context

### 错误信息
Docker 构建时 TypeScript 编译失败：
```
src/server/http-server.ts(217,9): error TS2322: Type '"ready" | "checking" | "loading_text" | "loading_multimodal"' is not assignable to type 'PipelineStageName'.
```

### 相关类型定义

**PreloadProgress (embedding-factory.ts):**
```typescript
export interface PreloadProgress {
  stage: 'checking' | 'loading_text' | 'loading_multimodal' | 'ready';
  progress: number; // 0-100
  message: string;
  model?: string;
}
```

**StartupStage (types.ts:33):**
```typescript
export type StartupStage = 'checking' | 'loading_text' | 'loading_multimodal' | 'ready';
```

**PipelineEvent (types.ts:108-138):**
```typescript
export interface PipelineEvent {
  type: PipelineEventType;
  stage?: PipelineStageName;  // 只支持 'ingest' | 'parse' | 'chunk' | 'embed' | 'index'
  // ... 其他字段
}
```

### 问题代码流程

```
http-server.ts 启动流程:
────────────────────────

preloadModels(broadcastProgress)
        │
        ▼
broadcastProgress(progress: PreloadProgress)
        │
        ▼
wsHandler.broadcast({
  type: 'startup:progress',
  stage: progress.stage,  ← PreloadProgress.stage 类型
  ...
})
        │
        ▼
PipelineEvent.stage?: PipelineStageName  ← 期望类型不匹配！
```

## Goals / Non-Goals

**Goals:**
- 修复 Docker 构建中的 TypeScript 类型错误
- 保持类型安全，不使用 `as any` 等类型逃逸
- 保持语义清晰，不同事件类型使用对应字段
- 前端兼容性：现有处理逻辑继续工作

**Non-Goals:**
- 不重构整个 WebSocket 事件系统
- 不改变现有 Pipeline 阶段定义
- 不修改前端组件结构

## Decisions

### Decision 1: 字段设计

**问题**: `PipelineEvent` 应如何支持启动阶段类型？

**选项**:
- A) 新增 `startupStage?: StartupStage` 字段
- B) 扩展 `stage` 类型为 `PipelineStageName | StartupStage`
- C) 不传 `stage`，只传 `message` 和 `progress`

**选择**: **A** - 新增专用字段

**理由**:
- 已有 `StartupStage` 类型定义，只需复用
- 语义清晰：`stage` 用于 Pipeline，`startupStage` 用于启动
- 前端可根据 `type` 字段选择读取 `stage` 或 `startupStage`
- 避免类型联合导致语义混淆

### Decision 2: 前端兼容性

**问题**: 前端是否需要同步修改？

**选择**: **可选修改**

**理由**:
- 前端现有处理可能只读取 `message` 和 `progress`
- 即使读取 `stage`，只需检查 `type === 'startup:progress'` 时改用 `startupStage`
- 这是一个渐进式改进，不强制前端立即更新

## Risks / Trade-offs

### Risk 1: 前端未同步更新
**影响**: 前端可能读取到 undefined 的 `stage` 字段
**缓解**: 前端应该根据 `type` 字段判断使用哪个字段；如果未更新，不影响功能（progress 和 message 仍可用）

### Trade-off: 字段数量增加
新增字段略微增加类型复杂度，但换来语义清晰和类型安全。

## Migration Plan

1. **修改 `types.ts`:**
   - 在 `PipelineEvent` 接口中添加 `startupStage?: StartupStage`

2. **修改 `http-server.ts`:**
   - 在 `broadcastProgress` 中使用 `startupStage: progress.stage`

3. **构建验证:**
   - 运行 `npm run build`
   - 运行 `docker build -t rag-server .`

4. **前端可选更新:**
   - 如前端需要显示启动阶段，检查 `startupStage` 字段

## Open Questions

- 无（问题清晰，解决方案明确）