# RAG MCP Server Harness 规格

## 概述

Harness 工程范式核心：`Model + Harness = Agent`

为 LLM Agent 构建完整运行环境，包含六大核心组件。

## 六大核心组件

### 1. 工具集 (Toolset)

**定义**：MCP Tools 的集合和编排

```typescript
interface ToolsetConfig {
  tools: ToolDefinition[];
  grouping: {
    index: ['rag_index', 'rag_delete'];
    search: ['rag_search'];
    management: ['rag_status', 'rag_config'];
  };
  dependencies: Map<string, string[]>; // 工具依赖关系
}
```

**实现要点**：
- 工具分类组织
- 工具依赖声明
- 工具执行顺序编排

---

### 2. 约束规则 (Constraints)

**定义**：限制 Agent 行为的规则引擎

```typescript
interface ConstraintRule {
  id: string;
  name: string;
  condition: (context: Context) => boolean;
  action: 'allow' | 'block' | 'warn' | 'transform';
  message?: string;
}

// 示例规则
const rules: ConstraintRule[] = [
  {
    id: 'max_index_size',
    name: '索引大小限制',
    condition: (ctx) => ctx.fileSize > 10 * 1024 * 1024,
    action: 'warn',
    message: '文件超过10MB，建议分批索引'
  },
  {
    id: 'sensitive_path',
    name: '敏感路径保护',
    condition: (ctx) => ctx.path.includes('.env') || ctx.path.includes('secret'),
    action: 'block',
    message: '禁止索引敏感文件'
  },
  {
    id: 'search_rate_limit',
    name: '检索频率限制',
    condition: (ctx) => ctx.searchCountInLastMinute > 100,
    action: 'block',
    message: '检索频率超限，请稍后再试'
  }
];
```

**实现要点**：
- 规则注册和启用
- 条件评估引擎
- 动作执行器
- 规则日志记录

---

### 3. 反馈回路 (Feedback Loop)

**定义**：收集和处理执行反馈

```typescript
interface FeedbackLoop {
  collect: (execution: ExecutionResult) => Feedback;
  process: (feedback: Feedback) => void;
  adjust: (feedback: Feedback) => ConfigAdjustment;

  metrics: {
    successRate: number;
    avgLatency: number;
    errorPatterns: string[];
    userSatisfaction?: number;
  };
}

interface Feedback {
  executionId: string;
  tool: string;
  success: boolean;
  latencyMs: number;
  error?: string;
  userAction?: 'accept' | 'reject' | 'modify';
  suggestions?: string[];
}
```

**实现要点**：
- 执行结果收集
- 质量指标计算
- 自动调参建议
- 反馈持久化

---

### 4. 上下文管理 (Context Manager)

**定义**：管理 Agent 运行时的上下文状态

```typescript
interface ContextManager {
  // 会话上下文
  session: {
    id: string;
    createdAt: Date;
    taskStack: Task[];
    retrievedDocs: Document[];
    searchHistory: SearchQuery[];
  };

  // 全局上下文
  global: {
    config: Config;
    indexedDocs: Map<string, Document>;
    constraints: ConstraintRule[];
  };

  // 上下文操作
  pushTask(task: Task): void;
  popTask(): Task;
  addRetrievedDoc(doc: Document): void;
  updateSearchHistory(query: SearchQuery): void;
  getRelevantContext(query: string): ContextSlice;
}

interface ContextSlice {
  relatedDocs: Document[];
  recentSearches: SearchQuery[];
  currentTask: Task;
  constraints: ConstraintRule[];
}
```

**实现要点**：
- 上下文窗口管理
- 相关性筛选
- 上下文压缩
- 会话持久化

---

### 5. 观测审计 (Observability)

**定义**：系统运行状态监控和审计日志

```typescript
interface Observability {
  // 指标收集
  metrics: {
    collect(): MetricsSnapshot;
    aggregate(period: Period): AggregatedMetrics;
  };

  // 日志记录
  logger: {
    log(level: LogLevel, event: string, data: object): void;
    query(filter: LogFilter): LogEntry[];
  };

  // 链路追踪
  tracer: {
    startTrace(operation: string): Trace;
    endTrace(trace: Trace): void;
    getTraces(filter: TraceFilter): Trace[];
  };

  // 健康检查
  health: {
    check(): HealthStatus;
    getReport(): HealthReport;
  };
}

interface MetricsSnapshot {
  timestamp: Date;
  cpuUsage: number;
  memoryUsage: number;
  milvusLatency: number;
  sqliteLatency: number;
  embeddingLatency: number;
  activeConnections: number;
}
```

**实现要点**：
- Prometheus 兼容指标
- 结构化日志
- 操作链路追踪
- 健康检查 API

---

### 6. 流程编排 (Orchestration)

**定义**：复杂任务的流程编排引擎

```typescript
interface OrchestrationEngine {
  // 流程定义
  defineFlow(name: string, steps: FlowStep[]): Flow;

  // 流程执行
  executeFlow(flow: Flow, input: object): FlowResult;

  // 流程控制
  pauseFlow(flowId: string): void;
  resumeFlow(flowId: string): void;
  cancelFlow(flowId: string): void;

  // 流程查询
  getFlowStatus(flowId: string): FlowStatus;
  getActiveFlows(): Flow[];
}

interface FlowStep {
  id: string;
  tool: string;
  input: object | ((ctx: Context) => object);
  condition?: (ctx: Context) => boolean;
  onError: 'skip' | 'retry' | 'abort';
  retryCount?: number;
}

// 示例流程：智能索引
const smartIndexFlow: Flow = defineFlow('smart-index', [
  { id: 'check-status', tool: 'rag_status', input: {} },
  { id: 'detect-changes', tool: 'internal_diff', input: (ctx) => ctx.previousResult },
  { id: 'filter-sensitive', tool: 'internal_filter', input: (ctx) => ctx.detectedFiles,
    condition: (ctx) => ctx.detectedFiles.length > 0 },
  { id: 'index', tool: 'rag_index', input: (ctx) => ({ path: ctx.filteredFiles }) },
  { id: 'verify', tool: 'rag_search', input: (ctx) => ({ query: 'test' }) }
]);
```

**实现要点**：
- DAG 流程定义
- 条件分支执行
- 错误处理策略
- 流程状态机

---

## Harness 配置文件

```json
{
  "harness": {
    "toolset": {
      "tools": ["rag_index", "rag_search", "rag_delete", "rag_status", "rag_config"],
      "groups": {
        "index": ["rag_index", "rag_delete"],
        "search": ["rag_search"],
        "management": ["rag_status", "rag_config"]
      }
    },
    "constraints": {
      "rules": [
        { "id": "max_index_size", "limit": 10485760, "action": "warn" },
        { "id": "sensitive_path", "patterns": [".env", "secret", "credential"], "action": "block" },
        { "id": "search_rate_limit", "limit": 100, "period": "1m", "action": "block" }
      ]
    },
    "feedback": {
      "collectMetrics": true,
      "autoAdjust": true,
      "persistHistory": true
    },
    "context": {
      "maxSessionAge": 3600,
      "contextWindow": 8000,
      "persistSession": true
    },
    "observability": {
      "metricsPort": 9090,
      "logLevel": "info",
      "traceEnabled": true
    },
    "orchestration": {
      "flows": ["smart-index", "batch-search", "verify-delete"],
      "maxConcurrent": 5
    }
  }
}
```