## Context

现有RAG MCP Server运行在stdio传输模式，仅支持MCP协议客户端连接。需要扩展为HTTP+WebSocket服务器，提供Web UI供用户交互。

核心约束：
- **单体部署**：前端bundle打包进后端，单一进程启动
- **无数据库**：文档暂存文件系统或内存（后续可扩展）
- **实时性**：Pipeline执行进度需实时推送到前端
- **状态简洁**：Zustand避免Redux的action/reducer复杂度

现有架构：
```
┌─────────────────┐
│   MCP Server    │ (stdio transport)
│  ┌───────────┐  │
│  │  Harness  │  │ Pipeline执行器
│  │ Pipeline  │  │ Ingest→Parse→Embed→Index
│  └───────────┘  │
│  ┌───────────┐  │
│  │ Chunking  │  │ 语义分块系统
│  │  System   │  │ (已完成)
│  └───────────┘  │
└─────────────────┘
```

目标架构：
```
┌─────────────────────────────────────────────────────────┐
│                    Fastify Server                       │
│  ┌─────────────┐  ┌─────────────┐  ┌────────────────┐  │
│  │ HTTP Routes │  │  WebSocket  │  │  Pipeline      │  │
│  │ /documents  │  │   Handler   │  │   Emitter      │  │
│  │ /chat       │  │             │  │  (new)         │  │
│  └─────────────┘  └─────────────┘  └────────────────┘  │
│                          │                              │
│                          ▼                              │
│  ┌───────────────────────────────────────────────────┐ │
│  │               Harness Pipeline                    │ │
│  │   (existing + event emission hooks)               │ │
│  └───────────────────────────────────────────────────┘ │
│                          │                              │
│                          ▼                              │
│  ┌───────────────────────────────────────────────────┐ │
│  │            React Frontend Bundle                  │ │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ │ │
│  │  │ DocManager  │ │ ChatWindow  │ │ PipelineVis │ │ │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ │ │
│  │            Zustand State Store                    │ │
│  └───────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## Goals / Non-Goals

**Goals:**
- 提供Web UI供用户管理文档、发起查询、观察pipeline进度
- 实时推送pipeline执行事件（分块进度、embedding进度、完成通知）
- 单体部署，一键启动HTTP+WebSocket服务
- 前端状态管理简洁（Zustand single store）
- 集成现有Harness hooks进行事件发射

**Non-Goals:**
- 用户认证/权限系统（后续扩展）
- 持久化数据库（暂用文件系统或内存）
- 多租户隔离
- MCP协议保持兼容（可独立运行MCP模式或HTTP模式）
- 移动端适配（桌面优先）

## Decisions

### D1: HTTP框架选择 Fastify

**Why Fastify over Express:**
- 性能：Fastify比Express快2-3倍（benchmark数据）
- TypeScript支持：原生类型定义，无需@types包
- 插件系统：`@fastify/websocket`官方插件，集成简单
- Hook机制：与Harness架构概念一致

**Alternatives considered:**
- Express：生态更大，但性能差，TypeScript需额外配置
- Koa：轻量但插件生态小，WebSocket支持不成熟

### D2: WebSocket协议设计

事件类型定义：
```typescript
interface PipelineEvent {
  type: 'stage:start' | 'stage:progress' | 'stage:complete' | 'pipeline:complete' | 'error';
  stage?: 'ingest' | 'parse' | 'chunk' | 'embed' | 'index';
  progress?: number; // 0-100
  message?: string;
  timestamp: number;
  documentId?: string;
}
```

**Why this design:**
- stage:start/complete提供阶段边界
- stage:progress提供进度条数据
- pipeline:complete标记整体完成
- error类型捕获异常

**Alternatives considered:**
- SSE（Server-Sent Events）：单向推送，无法实现客户端请求
- Polling：实时性差，资源浪费

### D3: 前端状态管理 Zustand

**Why Zustand over Redux:**
- 代码量少：无action/reducer/selectors boilerplate
- TypeScript友好：无需额外类型包装
- React集成简单：`useStore()`直接访问
- 中间件支持：persist、devtools可选

**Alternatives considered:**
- Redux：过度工程化，action/reducer复杂度高
- React Context：无中间件，不适合复杂状态
- MobX：响应式编程模型与React不一致

### D4: 前端构建工具 Vite

**Why Vite over Webpack:**
- 开发速度：ESM native，HMR秒级
- 配置简单：零配置TypeScript支持
- 构建速度：Rollup生产bundle，比Webpack快

**Alternatives considered:**
- Webpack：配置复杂，启动慢
- Parcel：零配置但不成熟，插件生态小

### D5: Pipeline事件发射机制

集成现有Harness hooks：
```typescript
// src/core/hooks.ts 新增
export function createWebSocketEmitterHook(wsClients: Set<WebSocket>): Hook {
  return {
    name: 'websocket-emitter',
    priority: 10,
    async preExecution(context) {
      broadcast(wsClients, { type: 'pipeline:start', ... });
    },
    async postStage(stageName, result) {
      broadcast(wsClients, { type: 'stage:complete', stage: stageName, ... });
    },
  };
}
```

**Why hooks integration:**
- 不修改Harness核心逻辑
- 与现有logging/timing hooks共存
- 解耦事件发射和pipeline执行

## Risks / Trade-offs

### R1: WebSocket连接稳定性
- **Risk**: 客户端断连导致事件丢失
- **Mitigation**: 前端维护事件队列，重连后请求补发；后端广播不依赖单客户端

### R2: 单体部署内存压力
- **Risk**: 大文档上传内存占用高
- **Mitigation**: Fastify流式上传（multipart），限制文档大小（50MB上限）

### R3: 文档存储无持久化
- **Risk**: 服务重启文档丢失
- **Mitigation**: 后续迭代可扩展SQLite/PostgreSQL存储；当前版本明确告知用户限制

### R4: 前端bundle体积
- **Risk**: React+Tailwind bundle较大（预估500KB gzip后）
- **Mitigation**: Vite tree-shaking，Tailwind purge unused styles，CDN可选

### R5: 并发pipeline执行
- **Risk**: 多文档同时上传，pipeline并发执行导致事件混乱
- **Mitigation**: 每个pipeline绑定documentId，事件携带documentId区分；前端按documentId分组展示

## Migration Plan

1. **Phase 1: 后端扩展**
   - 实现Fastify HTTP服务器
   - 实现WebSocket handler
   - 实现Pipeline事件发射器
   - 测试事件推送

2. **Phase 2: 前端基础**
   - 实现React应用骨架
   - 实现Zustand store
   - 实现WebSocket连接
   - 测试实时更新

3. **Phase 3: 功能模块**
   - 实现DocumentManager
   - 实现ChatWindow
   - 实现PipelineVisualizer
   - 集成测试

4. **Phase 4: 集成部署**
   - Vite构建前端bundle
   - Fastify静态文件服务
   - 单入口启动脚本
   - 文档更新

**Rollback:**
- 保留MCP模式入口点（src/main.ts）
- HTTP模式入口点独立（src/main-server.ts）
- 两种模式可独立运行

## Open Questions

- [ ] 文档存储路径：文件系统默认路径或用户配置？
- [ ] 文档大小上限：50MB是否合理？
- [ ] 前端主题：Tailwind默认主题或自定义配色？
- [ ] 错误展示：Toast提示或嵌入式错误面板？