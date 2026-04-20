## Why

Docker 构建失败，TypeScript 编译报错：

```
src/server/http-server.ts(217,9): error TS2322: Type '"ready" | "checking" | "loading_text" | "loading_multimodal"' is not assignable to type 'PipelineStageName'.
```

### 类型不匹配根源

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          类型定义冲突                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  PreloadProgress.stage (embedding-factory.ts:16):                           │
│    'checking' | 'loading_text' | 'loading_multimodal' | 'ready'              │
│                                                                             │
│  PipelineEvent.stage (types.ts:110):                                        │
│    PipelineStageName = 'ingest' | 'parse' | 'chunk' | 'embed' | 'index'     │
│                                                                             │
│  两套完全不同的阶段名称，用于不同的事件类型                                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**问题代码 (http-server.ts:214-222):**
```typescript
const broadcastProgress = (progress: PreloadProgress) => {
  wsHandler.broadcast({
    type: 'startup:progress',
    stage: progress.stage,  // ← 类型不匹配！
    progress: progress.progress,
    message: progress.message,
    model: progress.model,
    timestamp: Date.now(),
  });
};
```

**已有但未使用的类型:**
- `types.ts:33` 已定义 `StartupStage = 'checking' | 'loading_text' | 'loading_multimodal' | 'ready'`
- 但 `PipelineEvent` 接口没有使用该类型

## What Changes

### 方案 A（推荐）：新增专用字段

在 `PipelineEvent` 中添加 `startupStage?: StartupStage` 字段，专门用于启动事件。

**优点:**
- 类型安全，语义清晰
- 不同事件类型使用不同字段，避免混淆
- 前端可以根据事件类型选择正确字段

**改动点:**
- `src/server/types.ts`: `PipelineEvent` 添加 `startupStage?: StartupStage`
- `src/server/http-server.ts`: 使用 `startupStage` 替代 `stage`

## Capabilities

### Modified Capabilities
- `websocket-protocol`: 扩展 `PipelineEvent` 类型定义

## Impact

**修改文件:**
- `src/server/types.ts`: 1 行新增
- `src/server/http-server.ts`: 1 行修改

**影响范围:**
- 前端 WebSocket 处理可能需要更新（检查 `startupStage` 字段）
- 现有使用 `stage` 字段的代码不受影响