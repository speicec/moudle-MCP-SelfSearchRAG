## Context

### 当前架构

前端 HTTP Chat 路径使用基础检索流程：
```
前端 → POST /api/chat/generate → SmallToBigRetriever → LLMGenerationService → WebSocket streaming → 前端
```

Medical Agent（支持 ReAct 和 Planning 双模式）仅在 MCP Tool 路径使用：
```
Claude/Cursor → MCP Tool medical_agent → MedicalAgent.run() → AgentExecutor → VisualizationCollector → Markdown 输出
```

关键数据结构已存在：
- `VisualizationCollector` 收集实体匹配、查询改写、执行路径
- `TraceVisualizer` 收集各阶段追踪数据（时间戳、耗时、输入输出）
- `AgentResult.visualization` 和 `AgentResult.executionTrace` 字段

### 相关约束
- WebSocket 事件通过 `PipelineEmitter` 广播
- 前端通过 `useWebSocket` hook 接收事件
- `retrievalStore` 存储检索状态

## Goals / Non-Goals

**Goals:**
- HTTP Chat 路径获得完整 Medical Agent 能力（ReAct 循环、Planning 模式、复杂度评估）
- 前端实时看到 Agent 决策过程（每阶段独立发送事件）
- 复用现有 `VisualizationCollector` 和 `TraceVisualizer` 数据结构
- 保持现有检索流程兼容（向量化、相似度搜索、父块展开）

**Non-Goals:**
- 不修改 Agent 核心执行逻辑（`AgentExecutor.run()`）
- 不修改实体识别器或查询优化器核心算法
- 不影响 MCP Tool 路径的现有行为
- 不添加新的执行模式（仅使用现有 ReAct/Planning）

## Decisions

### Decision 1: Agent 集成方式

**选择**: 在 `chat.ts` `/generate` 路径中直接创建 `MedicalAgent` 实例

**替代方案**:
- A) 创建新的 `/agent/generate` 路径 ❌ - 会造成路径分裂，用户需选择不同端点
- B) 在 `LLMGenerationService` 中集成 Agent ❌ - 服务层职责混乱
- C) 直接在现有路径替换检索器 ✓ - 保持单一端点，用户无感知

**最终方案**: C + 可配置开关
```typescript
// chat.ts
if (enableAgent) {
  const agent = createMedicalAgent(llmCaller, retrievalFn, config);
  agent.setVisualizationCallback((phase, data) => agentEmitter.emit(phase, data));
  const result = await agent.run({ query });
} else {
  // fallback to basic retrieval
}
```

### Decision 2: 可视化事件发送时机

**选择**: 各阶段独立发送（检索前发送）

**理由**:
- 前端能实时更新 UI，用户看到渐进式决策过程
- 避免 Agent 执行时间过长导致前端无反馈
- 符合用户需求："检索前发送"

**事件顺序**:
```
agent:input → agent:entities → agent:complexity → agent:mode → 
agent:query_rewrite → agent:template → agent:dag → agent:execution → 
[检索事件] → [生成事件] → agent:complete
```

### Decision 3: AgentEmitter 架构

**选择**: 创建独立的 `AgentEmitter` 类，类似 `PipelineEmitter`

```typescript
class AgentEmitter {
  constructor(wsHandler: WebSocketHandler) {}
  
  emitInput(query: string): void;
  emitEntities(entities: MedicalEntities): void;
  emitComplexity(complexity: ComplexityAssessment): void;
  emitMode(mode: 'react' | 'planning', reason: string): void;
  emitQueryRewriting(strategy: QueryStrategy): void;
  emitTemplate(attempts: TemplateAttempt[], matched?: string): void;
  emitDAG(dag: TaskDAG): void;
  emitExecution(state: ExecutorState): void;
  emitComplete(result: AgentResult): void;
}
```

**替代方案**:
- A) 扩展 `PipelineEmitter` ❌ - 事件类型混杂，职责不清
- B) 直接在 `AgentExecutor` 中调用 `wsHandler.broadcast` ❌ - Agent 耦合 WebSocket
- C) 独立 Emitter + 回调注入 ✓ - Agent 保持解耦，通过回调发送事件

### Decision 4: AgentExecutor 可视化回调

**选择**: 在 `AgentExecutor` 各阶段调用回调函数

```typescript
// AgentExecutor.ts
class AgentExecutor {
  private visualizationCallback?: (phase: string, data: unknown) => void;
  
  setVisualizationCallback(cb: (phase: string, data: unknown) => void): void {
    this.visualizationCallback = cb;
  }
  
  async run(query: string): Promise<AgentResult> {
    // 在各阶段调用
    this.visualizationCallback?.('input', { query });
    this.visualizationCallback?.('entities', entities);
    this.visualizationCallback?.('complexity', complexity);
    // ...
  }
}
```

**理由**:
- Agent 不直接依赖 WebSocket
- 回调可在不同环境使用（HTTP Server、MCP Tool）
- 保持 Agent 核心逻辑不变

### Decision 5: 前端可视化面板布局

**选择**: 在现有 `RetrievalFlow` 步骤之前添加 Agent 面板

```
┌─────────────────────────────────────────────────────────────────────┐
│  Agent 可视化面板 (新增)                                             │
│  ├── 执行模式                                                        │
│  ├── 实体识别                                                        │
│  ├── 关键词匹配                                                      │
│  ├── 查询改写                                                        │
│  ├── 执行路径                                                        │
│  ├── 模板匹配                                                        │
│  └── DAG 结构                                                        │
└─────────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────────┐
│  检索流程步骤 (保留)                                                  │
│  ├── 1. 查询向量化                                                   │
│  ├── 2. 相似度搜索                                                   │
│  └── 3. 父块展开                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Risks / Trade-offs

### Risk 1: Agent 执行时间增加
**风险**: Medical Agent 比 SimpleRetriever 执行时间更长（复杂度评估、模板匹配）
**缓解**: 
- 各阶段发送事件，前端实时反馈
- 显示进度条和当前阶段名称
- 可配置开关，允许禁用 Agent

### Risk 2: WebSocket 事件风暴
**风险**: Agent 发送大量事件可能影响前端性能
**缓解**:
- 事件去重（相同数据不重复发送）
- 前端批量处理（合并相邻事件）
- 可选：提供"简化模式"只发送关键事件

### Risk 3: LLMCaller 配置缺失
**风险**: Agent 需要 LLMCaller，但 HTTP Server 可能未配置 API Key
**缓解**:
- 检测 `llmGenerationService.isEnabled()` 决定是否启用 Agent
- 未配置时回退到基础检索
- 使用 `llmGenerationService.generateOnce` 作为 LLMCaller

### Risk 4: 前端类型同步
**风险**: 前端类型定义可能与后端不一致
**缓解**:
- 创建共享类型文件 `src/frontend/types/visualization.ts`
- 从后端类型直接导入或复制定义
- 添加类型检查确保一致