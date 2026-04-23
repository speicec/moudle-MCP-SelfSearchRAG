# 设计一致性检查报告

## 时间: 2026-04-22

## 检查范围

- **设计文档:** openspec/changes/frontend-agent-visualization-integration/design.md
- **规格文档:** openspec/changes/frontend-agent-visualization-integration/specs/
- **现有代码:** src/server/routes/chat.ts, src/medical/agent/, src/server/types.ts

## 契约一致性状态: **⚠ 存在偏差**

---

## 一致项

✓ **Decision 1 Agent 集成方式** - `chat.ts` `/generate` 路径结构支持 MedicalAgent 集成
  - 路径已有 WebSocket 广播机制 (`wsHandler.broadcast`)
  - 已有 PipelineEmitter 模式用于事件发送
  - 已有 LLMGenerationService 提供生成能力
  - MedicalAgent 构造签名兼容: `(llmCaller, retrieval?, config?)`

✓ **PipelineEmitter 设计模式** - 可复用于 AgentEmitter 架构
  - PipelineEmitter 构造: `(documentId, wsHandler?)`
  - 通过 `wsHandler.broadcast()` 发送事件
  - 专用 emit 方法模式 (emitRetrievalStart, emitGenerationStart 等)
  - AgentEmitter 设计遵循相同模式

✓ **MedicalEntities 类型** - 存在于 `src/medical/types.ts`
  - 包含 `diseases`, `drugs`, `indicators`, `relations`, `rawQuery`, `confidence`
  - 完全匹配设计文档定义

✓ **ComplexityAssessment 类型** - 存在于 `src/medical/agent/ExecutionTypes.ts`
  - 包含 `level`, `entityCount`, `hasComparison`, `hasConditions`, `hasInteraction`, `needsPlanning`, `reason`
  - 完全匹配设计文档定义

✓ **TemplateAttempt 类型** - 存在于 `src/medical/agent/RetrievalVisualization.ts`
  - 包含 `templateId`, `templateName`, `matched`, `rejectionReason?`
  - 完全匹配设计文档定义

✓ **TaskDAG 类型** - 存在于 `src/medical/agent/ExecutionTypes.ts`
  - 包含 `tasks`, `parallelGroups`, `entryTasks`, `exitTasks`
  - 完全匹配设计文档定义

✓ **ExecutorState 类型** - 存在于 `src/medical/agent/ExecutionTypes.ts`
  - 包含 `dag`, `completed`, `pending`, `running`, `failed`, `status`, `startTime`, `currentRound`, `entities`, `query`, `contextEntries`
  - 完全匹配设计文档定义

✓ **AgentResult.visualization 字段** - 存在于 `src/medical/agent/types.ts` (第 195-196 行)
  - 类型为 `RetrievalVisualization | undefined`
  - 完全匹配设计文档定义

✓ **AgentResult.executionTrace 字段** - 存在于 `src/medical/agent/types.ts` (第 198-199 行)
  - 类型为 `ExecutionTrace | undefined`
  - 完全匹配设计文档定义

✓ **VisualizationCollector 类** - 存在于 `src/medical/agent/RetrievalVisualization.ts`
  - 提供完整的数据收集方法
  - `collectInputPhase`, `collectEntityMatches`, `collectQueryRewriting`, `collectComplexityPhase`, `collectModeSelectionPhase`, `collectTemplatePhase`, `collectDAGPhase`, `collectExecutionPhase`, `collectAnswerPhase`
  - 设计可直接复用

✓ **TraceVisualizer 类** - 存在于 `src/medical/agent/TraceVisualizer.ts`
  - 提供完整的追踪收集方法
  - `collectInputPhase`, `collectEntityRecognitionPhase`, `collectComplexityAssessmentPhase`, `collectModeSelectionPhase`, `collectPlanningPhase`, `collectExecutionPhase`, `collectReplanningPhase`, `collectAnswerPhase`
  - 设计可直接复用

✓ **组件依赖关系** - 层级清晰合理
  - AgentEmitter → WebSocketHandler (与 PipelineEmitter 模式一致)
  - AgentExecutor → visualizationCallback (回调注入不破坏现有依赖)
  - chat.ts → MedicalAgent → AgentExecutor (层级清晰)

---

## 偏差列表

### Critical

**无关键偏差**

### Important

#### 1. AgentExecutor 缺少 visualizationCallback 机制

**位置:** `src/medical/agent/AgentExecutor.ts`

**现状:** AgentExecutor 当前没有 `visualizationCallback` 属性或 `setVisualizationCallback()` 方法。

**设计要求:**
```typescript
class AgentExecutor {
  private visualizationCallback?: (phase: string, data: unknown) => void;
  
  setVisualizationCallback(cb: (phase: string, data: unknown) => void): void {
    this.visualizationCallback = cb;
  }
}
```

**影响:** 需要新增属性和方法，并在各执行阶段调用回调。现有 VisualizationCollector 和 TraceVisualizer 已收集数据，但无法实时发送到 WebSocket。

**建议:** 在 AgentExecutor 构造函数中添加可选的 visualizationCallback 参数，并在以下位置调用:
- `run()` 方法开始时: `visualizationCallback?.('input', { query })`
- 实体识别后: `visualizationCallback?.('entities', entities)`
- 复杂度评估后: `visualizationCallback?.('complexity', complexity)`
- 模式选择后: `visualizationCallback?.('mode', { mode, reason })`
- 查询重写后: `visualizationCallback?.('query_rewrite', strategy)`
- 模板匹配后: `visualizationCallback?.('template', { attempts, matched })`
- DAG 构建后: `visualizationCallback?.('dag', dag)`
- 执行过程中: `visualizationCallback?.('execution', executorState)`
- 完成时: `visualizationCallback?.('complete', result)`

#### 2. PipelineEventType 缺少 agent:* 事件类型

**位置:** `src/server/types.ts` 第 9-28 行

**现状:** PipelineEventType 仅包含:
```typescript
| 'retrieval:start' | 'retrieval:match' | 'retrieval:complete'
| 'generation:start' | 'generation:thinking' | 'generation:answer' | 'generation:complete' | 'generation:error'
| 'pipeline:*' | 'stage:*' | 'chunk:*' | 'startup:*' | 'stats:*' | 'error'
```

**设计要求新增事件:**
- `agent:input`
- `agent:entities`
- `agent:complexity`
- `agent:mode`
- `agent:query_rewrite`
- `agent:template`
- `agent:dag`
- `agent:execution`
- `agent:complete`

**影响:** 需要扩展 PipelineEventType 和 PipelineEvent 类型定义。

**建议:** 在 `src/server/types.ts` 中添加:
```typescript
export type PipelineEventType =
  | ... // 现有类型
  | 'agent:input'
  | 'agent:entities'
  | 'agent:complexity'
  | 'agent:mode'
  | 'agent:query_rewrite'
  | 'agent:template'
  | 'agent:dag'
  | 'agent:execution'
  | 'agent:complete';
```

并在 PipelineEvent 接口中添加 agent 相关字段。

### Minor

#### 3. QueryStrategy 类型存在两个版本

**位置:** 
- `src/medical/types.ts` 第 187-198 行 (完整版，含 filters 和 prioritySources)
- `src/medical/agent/ExecutionTypes.ts` 第 14-17 行 (简化版，仅 primaryQuery 和 expandedTerms)

**现状:** 两个文件定义了同名但结构不同的 QueryStrategy 类型:
```typescript
// types.ts 版本
interface QueryStrategy {
  primaryQuery: string;
  expandedTerms: string[];
  filters: { yearRange?, guidelineSources? };
  prioritySources: string[];
}

// ExecutionTypes.ts 版本
interface QueryStrategy {
  primaryQuery: string;
  expandedTerms: string[];
}
```

**设计要求:** AgentEmitter.emitQueryRewriting 需要发送 `strategy: QueryStrategy`，包含 `primaryQuery` 和 `expandedTerms`。

**影响:** AgentExecutor 使用 ExecutionTypes.ts 的简化版本 (第 184-195 行)，而 query-planner.ts 返回完整版本。

**建议:** 
- 方案 A: 统一使用 types.ts 的完整版本，ExecutionTypes.ts 导入并复用
- 方案 B: AgentEmitter.emitQueryRewriting 只发送简化版本数据 `{ primaryQuery, expandedTerms }`

#### 4. MedicalAgent 缺少 setVisualizationCallback 方法

**位置:** `src/medical/agent/MedicalAgent.ts`

**现状:** MedicalAgent 有 `setRetrieval()` 方法但没有 `setVisualizationCallback()` 方法。

**设计要求 (design.md 第 53-57 行):**
```typescript
agent.setVisualizationCallback((phase, data) => agentEmitter.emit(phase, data));
```

**影响:** 需要新增方法并传递给 AgentExecutor。

**建议:** 在 MedicalAgent 类中添加:
```typescript
setVisualizationCallback(cb: (phase: string, data: unknown) => void): void {
  // 需要在创建 AgentExecutor 时传递回调
}
```

这需要修改 AgentExecutor 构造函数接受 visualizationCallback 参数。

#### 5. AgentEmitter 类尚未实现

**现状:** 设计文档定义的 AgentEmitter 类不存在于现有代码库。

**设计要求:**
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

**影响:** 需要新建文件 `src/server/agent-emitter.ts`，遵循 PipelineEmitter 模式实现。

**建议:** 创建新文件，参考 PipelineEmitter 实现方式:
```typescript
// src/server/agent-emitter.ts
import { WebSocketHandler } from './websocket-handler.js';
import type { PipelineEvent } from './types.js';

export class AgentEmitter {
  constructor(private wsHandler: WebSocketHandler) {}
  
  emit(type: string, data: unknown): void {
    this.wsHandler.broadcast({
      type: `agent:${type}`,
      ...data,
      timestamp: Date.now(),
    });
  }
  
  // 各专用 emit 方法...
}
```

---

## 设计建议

### 针对偏差 1 和 4 (visualizationCallback 机制)

**推荐实现路径:**

1. 修改 `AgentExecutor.ts` 添加 visualizationCallback:
```typescript
export class AgentExecutor {
  private visualizationCallback?: (phase: string, data: unknown) => void;
  
  constructor(
    config: ExtendedAgentConfig,
    context: AgentContext,
    visualizationCallback?: (phase: string, data: unknown) => void
  ) {
    this.config = config;
    this.context = context;
    this.visualizationCallback = visualizationCallback;
    // ... 其他初始化
  }
  
  setVisualizationCallback(cb: (phase: string, data: unknown) => void): void {
    this.visualizationCallback = cb;
  }
}
```

2. 修改 `MedicalAgent.ts` 添加方法传递回调:
```typescript
export class MedicalAgent {
  private visualizationCallback?: (phase: string, data: unknown) => void;
  
  setVisualizationCallback(cb: (phase: string, data: unknown) => void): void {
    this.visualizationCallback = cb;
  }
  
  async run(input: MedicalQueryInput): Promise<AgentResult> {
    const executor = new AgentExecutor(
      this.config,
      context,
      this.visualizationCallback
    );
    return await executor.run(input.query);
  }
}
```

### 针对偏差 2 (事件类型扩展)

**推荐扩展 PipelineEvent:**

在 `src/server/types.ts` 中添加:
```typescript
// 扩展 PipelineEventType
export type PipelineEventType =
  | ... // 现有类型
  | 'agent:input'
  | 'agent:entities'
  | 'agent:complexity'
  | 'agent:mode'
  | 'agent:query_rewrite'
  | 'agent:template'
  | 'agent:dag'
  | 'agent:execution'
  | 'agent:complete';

// 扩展 PipelineEvent 添加 agent 字段
export interface PipelineEvent {
  // ... 现有字段
  
  // Agent event fields
  agentPhase?: 'input' | 'entities' | 'complexity' | 'mode' | 'query_rewrite' | 'template' | 'dag' | 'execution' | 'complete';
  entities?: MedicalEntities;
  complexity?: ComplexityAssessment;
  executionMode?: 'react' | 'planning';
  executionReason?: string;
  queryStrategy?: QueryStrategy;
  templateAttempts?: TemplateAttempt[];
  matchedTemplate?: string;
  dag?: TaskDAG;
  executorState?: ExecutorState;
  agentResult?: AgentResult;
}
```

### 针对偏差 3 (QueryStrategy 类型冲突)

**推荐方案 B:** AgentEmitter 只发送简化版本

理由:
- ExecutionTypes.ts 的简化版本专门用于 Agent 内部
- types.ts 的完整版本用于外部 API 和 query-planner
- WebSocket 事件只需核心数据，不需要 filters 和 prioritySources

实现:
```typescript
emitQueryRewriting(strategy: QueryStrategy): void {
  this.emit('query_rewrite', {
    primaryQuery: strategy.primaryQuery,
    expandedTerms: strategy.expandedTerms,
  });
}
```

### 针对偏差 5 (AgentEmitter 类)

**推荐实现位置:** `src/server/agent-emitter.ts`

结构建议:
```typescript
import { WebSocketHandler } from './websocket-handler.js';
import type { PipelineEvent } from './types.js';
import type { MedicalEntities } from '../medical/types.js';
import type { ComplexityAssessment, TaskDAG, ExecutorState } from '../medical/agent/ExecutionTypes.js';
import type { TemplateAttempt } from '../medical/agent/RetrievalVisualization.js';
import type { AgentResult } from '../medical/agent/types.js';

export class AgentEmitter {
  constructor(private wsHandler: WebSocketHandler) {}
  
  private emit(phase: string, data: Record<string, unknown>): void {
    this.wsHandler.broadcast({
      type: `agent:${phase}`,
      ...data,
      timestamp: Date.now(),
    });
  }
  
  emitInput(query: string): void {
    this.emit('input', { query });
  }
  
  emitEntities(entities: MedicalEntities): void {
    this.emit('entities', { entities });
  }
  
  // ... 其他方法
}

export function createAgentEmitter(wsHandler: WebSocketHandler): AgentEmitter {
  return new AgentEmitter(wsHandler);
}
```

---

## 总结

设计文档与现有代码架构整体兼容，核心类型和数据结构均已存在。主要偏差集中在:

1. **visualizationCallback 机制** - 需要在 AgentExecutor 和 MedicalAgent 中新增
2. **WebSocket 事件类型** - 需要扩展 PipelineEventType 支持 agent:* 事件
3. **AgentEmitter 类** - 需要新建

这些偏差均为**新增实现**而非**破坏性修改**，不会影响现有功能。建议按上述设计建议逐步实现，确保变更向后兼容。

---

## 验证状态

| 检查项 | 状态 | 备注 |
|--------|------|------|
| MedicalEntities 类型 | ✓ 一致 | 完全匹配 |
| ComplexityAssessment 类型 | ✓ 一致 | 完全匹配 |
| QueryStrategy 类型 | ⚠ 偏差 | 存在两个版本 |
| TemplateAttempt 类型 | ✓ 一致 | 完全匹配 |
| TaskDAG 类型 | ✓ 一致 | 完全匹配 |
| ExecutorState 类型 | ✓ 一致 | 完全匹配 |
| AgentResult 类型 | ✓ 一致 | 含 visualization/executionTrace |
| VisualizationCollector | ✓ 一致 | 可直接复用 |
| TraceVisualizer | ✓ 一致 | 可直接复用 |
| PipelineEmitter 模式 | ✓ 一致 | AgentEmitter 可复用 |
| AgentExecutor 回调机制 | ✗ 缺失 | 需新增 |
| MedicalAgent 回调方法 | ✗ 缺失 | 需新增 |
| AgentEmitter 类 | ✗ 缺失 | 需新建 |
| agent:* 事件类型 | ✗ 缺失 | 需扩展 |

**一致性评分: 10/14 一致 (71%)**