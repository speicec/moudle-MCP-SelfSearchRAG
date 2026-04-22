# Medical Agent 预研路线分析 4/22 V1

## 一、现状评估

### 1.1 当前实现架构

当前 Medical Agent 实现的是**简化版 ReAct 循环**：

```
Think → Act → Observe → Decide → Answer
```

**核心组件**：

| 组件 | 路径 | 功能 | 实现程度 |
|------|------|------|----------|
| AgentExecutor | `agent/AgentExecutor.ts` | 主循环执行 | ✓ 基础完成 |
| MedicalReasoner | `agent/MedicalReasoner.ts` | LLM推理 | ✓ 基础完成 |
| AgentState | `agent/AgentState.ts` | 状态管理 | ✓ 基础完成 |
| AgentCache | `agent/AgentCache.ts` | 结果缓存 | ✓ 基础完成 |
| AgentLogger | `agent/AgentLogger.ts` | 执行日志 | ✓ 基础完成 |
| AgentPrompts | `agent/AgentPrompts.ts` | Prompt模板 | ✓ 基础完成 |

### 1.2 工具能力边界

当前支持的 AgentActionType：

```typescript
type AgentActionType =
  | 'extract_entities'   // 实体提取（基于词典）
  | 'retrieve'           // 单次向量检索
  | 'expand_query'       // 同义词扩展检索
  | 'evaluate'           // 证据评估（简化版）
  | 'generate_answer';   // LLM生成回答
```

**边界分析**：

- ❌ 无真正的工具编排（并行、依赖）
- ❌ 无外部API调用能力（如药品数据库、指南API）
- ❌ 无代码执行能力
- ❌ 无文件操作能力
- ✓ 基于词典的实体识别已实现

### 1.3 模式判定

**当前模式**：简化版 ReAct

特征：
- 每次迭代只做单一决策
- 无前置 Planning 阶段
- 状态是线性的，无分支探索
- 迭代次数硬编码（maxIterations: 5）

**非 PlanAndExecute 模式**：

- ❌ 无任务分解步骤
- ❌ 无 DAG 任务编排
- ❌ 无任务依赖管理
- ❌ 无并行执行能力

---

## 二、差距分析

### 2.1 与完整 Agent 的差距矩阵

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Agent 能力成熟度评估                                  │
└─────────────────────────────────────────────────────────────────────────────┘

维度                    当前状态        目标状态        差距等级    优先级
──────────────────────────────────────────────────────────────────────────────
Planning                无              Plan→Execute    ⚠️ 严重     P0
任务分解                无              有              ⚠️ 严重     P0
并行执行                无              有              ⚠️ 严重     P1
工具编排                线性            DAG             ⚠️ 严重     P0
自我反思                无              Reflection      ⚠️ 严重     P1
上下文管理              无              有              ⚠️ 严重     P0
失败恢复                无              Retry/Fallback  ⚠️ 中等     P1
多工具                  5种             10+种           ⚠️ 中等     P2
Agent协作               无              Multi-Agent     ⚠️ 中等     P2
长期记忆                Cache           Memory Store    ⚠️ 中等     P2
```

### 2.2 核心差距详解

#### Gap 1: 无 Planning 能力（严重）

**现状**：
```typescript
// AgentExecutor.run()
while (canContinue(state)) {
  state = incrementIteration(state);
  const decision = await this.think(state);  // 每轮独立决策
  const action = this.decideAction(decision, state);
  // ...
}
```

**问题**：
- 每轮只考虑当前状态，无全局视野
- 无任务分解（如"对比两种药物"拆分为两个检索任务）
- 无法预测执行路径

**目标**：
```
Query → Planner → Task DAG → Executor → Result Check → Re-plan (if needed)
```

#### Gap 2: 无工具编排能力（严重）

**现状**：
```typescript
// 单一工具执行
switch (action.type) {
  case 'retrieve': return await this.executeRetrieve(state);
  case 'expand_query': return await this.executeExpandQuery(state);
  // ...
}
```

**问题**：
- 工具调用是线性的
- 无并行执行（如同时检索疾病和药物）
- 无工具依赖管理（如先提取实体再检索）

**目标**：
```
┌─────────────────┐
│ Task DAG        │
│                 │
│ [实体识别]      │
│      │          │
│      ├─▶ [检索疾病]
│      │      │
│      ├─▶ [检索药物]  ← 可并行
│      │      │
│      └──────┴─▶ [答案生成]
└─────────────────┘
```

#### Gap 3: 无上下文管理（严重）

**现状**：
- 无 Token 计数
- 无上下文窗口管理
- 检索结果直接堆叠

**问题**：
- 检索结果过多会超 Token
- 无 Context 压缩机制
- 无优先级截断

**目标**：
```typescript
interface ContextManager {
  maxTokens: number;
  currentTokens: number;

  addContext(content: string, priority: number): boolean;
  compress(): string;
  truncate(): void;
}
```

#### Gap 4: 无自我反思能力（严重）

**现状**：
- 无 Reflection 阶段
- 检索失败无自我修正
- 答案生成无质量反馈循环

**目标**：
```
Answer → Reflection → Critique → Revise (if needed) → Final Answer
```

---

## 三、预研路线

### 3.1 分阶段演进路线

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Agent 演进路线图                                      │
└─────────────────────────────────────────────────────────────────────────────┘

Phase 1: Planning 增强 (P0, 2周)
─────────────────────────────────────────────────────────────────────────────
│
│  目标：引入 PlanAndExecute 模式
│
│  Tasks:
│  ├─ [1.1] 实现 TaskPlanner 组件
│  │        - Query → Tasks 分解
│  │        - Task DAG 生成
│  │        - Task 依赖管理
│  │
│  ├─ [1.2] 实现 TaskExecutor 组件
│  │        - DAG 执行引擎
│  │        - 并行执行支持
│  │        - 失败重试机制
│  │
│  ├─ [1.3] 实现 Re-planning 机制
│  │        - 结果检查
│  │        - 任务补充
│  │        - 动态调整
│  │
│  └─ [1.4] 改造 AgentState
│           - 支持分支状态
│           - 支持中间检查点
│           - 支持状态恢复
│

Phase 2: 上下文管理 (P0, 1周)
─────────────────────────────────────────────────────────────────────────────
│
│  目标：实现完整的上下文管理
│
│  Tasks:
│  ├─ [2.1] 实现 ContextManager
│  │        - Token 计数
│  │        - 上下文窗口限制
│  │        - 优先级队列
│  │
│  ├─ [2.2] 实现 Context 压缩
│  │        - 检索结果摘要
│  │        - 低置信度过滤
│  │        - 重复内容去重
│  │
│  └─ [2.3] 实现动态截断
│           - 按置信度优先
│           - 按来源权威性
│           - 保留关键证据
│

Phase 3: 自我反思机制 (P1, 1周)
─────────────────────────────────────────────────────────────────────────────
│
│  目标：引入 Reflection 循环
│
│  Tasks:
│  ├─ [3.1] 实现 SelfReflection 组件
│  │        - 答案质量自评
│  │        - 检索覆盖度检查
│  │        - 证据完整性评估
│  │
│  ├─ [3.2] 实现 Revision 机制
│  │        - 答案修订
│  │        - 补充检索触发
│  │        - 迭代优化
│  │
│  └─ [3.3] 实现 Critique Prompt
│           - 自我批评模板
│           - 改进建议生成
│           - 质量评分输出
│

Phase 4: 工具扩展 (P2, 2周)
─────────────────────────────────────────────────────────────────────────────
│
│  目标：扩展工具能力
│
│  Tasks:
│  ├─ [4.1] 新增外部API工具
│  │        - 药品信息API（如 RxNorm）
│  │        - 指南数据库API
│  │        - 医学词典API
│  │
│  ├─ [4.2] 新增数据分析工具
│  │        - 指标计算器（eGFR计算）
│  │        - 风险评估工具
│  │        - 相互作用检查器
│  │
│  ├─ [4.3] 新增文件操作工具
│  │        - 指南PDF提取
│  │        - 表格数据解析
│  │        - 图表分析
│  │
│  └─ [4.4] 工具参数验证
│           - 输入Schema
│           - 输出Schema
│           - 类型安全
│

Phase 5: 多Agent协作 (P2, 2周)
─────────────────────────────────────────────────────────────────────────────
│
│  目标：实现 Multi-Agent 架构
│
│  Tasks:
│  ├─ [5.1] 设计 Agent 路由
│  │        - 领域Agent（糖尿病/高血压/甲状腺）
│  │        - 功能Agent（检索/推理/验证）
│  │        - 协调Agent
│  │
│  ├─ [5.2] 实现 Agent 通信
│  │        - 消息传递协议
│  │        - 状态共享
│  │        - 结果聚合
│  │
│  └─ [5.3] 实现 Agent 协作流程
│           - 任务分发
│           - 结果合并
│           - 冲突解决
│
```

### 3.2 Phase 1 详细设计：PlanAndExecute 模式

#### 架构设计

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PlanAndExecute 架构                                        │
└─────────────────────────────────────────────────────────────────────────────┘

                              Query
                                │
                                ▼
                     ┌─────────────────────┐
                     │    TaskPlanner      │
                     │                     │
                     │  Query → Task DAG   │
                     │  - 任务分解         │
                     │  - 依赖分析         │
                     │  - 并行识别         │
                     └─────────────────────┘
                                │
                                ▼
                     ┌─────────────────────┐
                     │    Task DAG         │
                     │                     │
                     │  Task {             │
                     │    id: string       │
                     │    type: ActionType │
                     │    params: {...}    │
                     │    dependencies: [] │
                     │    priority: number │
                     │  }                  │
                     └─────────────────────┘
                                │
                                ▼
                     ┌─────────────────────┐
                     │    TaskExecutor     │
                     │                     │
                     │  - DAG遍历          │
                     │  - 并行执行         │
                     │  - 状态收集         │
                     │  - 失败处理         │
                     └─────────────────────┘
                                │
                                ▼
                     ┌─────────────────────┐
                     │    Result Check     │
                     │                     │
                     │  - 覆盖度评估       │
                     │  - 置信度计算       │
                     │  - 满足度判断       │
                     └─────────────────────┘
                                │
                    ┌───────────┴───────────┐
                    │                       │
                Satisfied               Not Satisfied
                    │                       │
                    ▼                       ▼
               Answer              Re-planning (补充任务)
                                            │
                                            └──────────────▶ TaskExecutor
```

#### 核心类型设计

```typescript
// Task 定义
interface AgentTask {
  id: string;
  type: AgentActionType;
  params: Record<string, unknown>;
  dependencies: string[];      // 依赖的任务ID
  priority: number;            // 优先级（用于上下文截断）
  timeout?: number;            // 超时时间
  retry?: number;              // 重试次数
}

// Task DAG
interface TaskDAG {
  tasks: AgentTask[];
  edges: Array<[string, string]>;  // [from, to]
  parallelGroups: string[][];      // 可并行执行的任务组
}

// Task 结果
interface TaskResult {
  taskId: string;
  success: boolean;
  data: unknown;
  error?: string;
  duration: number;
}

// Executor 状态
interface ExecutorState {
  dag: TaskDAG;
  completed: Map<string, TaskResult>;
  pending: string[];
  running: string[];
  failed: string[];
}
```

#### TaskPlanner Prompt 设计

```typescript
const PLANNER_PROMPT = `
你是一个任务规划器。请分析用户查询并生成任务执行计划。

## 用户查询
${query}

## 已识别实体
${entities}

## 可用工具
1. extract_entities - 提取医学实体
2. retrieve - 检索相关文档
3. expand_query - 扩展查询词
4. evaluate - 评估证据质量
5. generate_answer - 生成答案
6. calculate_indicator - 计算临床指标（如eGFR）
7. check_interaction - 检查药物相互作用

## 请生成任务计划
输出 JSON 格式：
{
  "tasks": [
    {
      "id": "task_1",
      "type": "extract_entities",
      "dependencies": [],
      "priority": 1
    },
    {
      "id": "task_2",
      "type": "retrieve",
      "params": { "query": "疾病相关" },
      "dependencies": ["task_1"],
      "priority": 2
    },
    {
      "id": "task_3",
      "type": "retrieve",
      "params": { "query": "药物相关" },
      "dependencies": ["task_1"],
      "priority": 2
    },
    {
      "id": "task_4",
      "type": "generate_answer",
      "dependencies": ["task_2", "task_3"],
      "priority": 3
    }
  ],
  "parallelGroups": [["task_2", "task_3"]]
}
`;
```

### 3.3 Phase 2 详细设计：上下文管理

#### ContextManager 设计

```typescript
interface ContextManagerConfig {
  maxTokens: number;           // 最大Token数（如60000）
  modelContextWindow: number;  // 模型窗口（如64000）
  reserveForOutput: number;    // 输出预留（如4000）
  compressionThreshold: number;// 压缩阈值（如0.8）
}

interface ContextEntry {
  id: string;
  content: string;
  tokens: number;
  priority: number;            // 置信度 * 权重
  source: SourceCitation;
  timestamp: number;
}

class ContextManager {
  private entries: ContextEntry[] = [];
  private currentTokens: number = 0;

  addEntry(entry: ContextEntry): boolean {
    // 检查是否超限
    if (this.currentTokens + entry.tokens > this.config.maxTokens) {
      this.compressOrTruncate();
    }

    // 优先级插入
    this.entries.push(entry);
    this.currentTokens += entry.tokens;
    this.sortByPriority();

    return true;
  }

  compressOrTruncate(): void {
    // 1. 先尝试压缩（低置信度摘要）
    const lowPriorityEntries = this.entries.filter(e => e.priority < 0.5);
    for (const entry of lowPriorityEntries) {
      const compressed = this.compressEntry(entry);
      this.currentTokens -= (entry.tokens - compressed.tokens);
      entry.content = compressed.content;
      entry.tokens = compressed.tokens;
    }

    // 2. 如果仍超限，截断最低优先级
    while (this.currentTokens > this.config.maxTokens) {
      const lowest = this.entries.pop();
      if (lowest) {
        this.currentTokens -= lowest.tokens;
      }
    }
  }

  buildContext(): string {
    return this.entries.map(e => `[来源: ${e.source.documentName}]\n${e.content}`).join('\n\n');
  }
}
```

### 3.4 Phase 3 详细设计：自我反思

#### Reflection 循环设计

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Self-Reflection 循环                                       │
└─────────────────────────────────────────────────────────────────────────────┘

                        Generate Answer
                              │
                              ▼
                     ┌─────────────────────┐
                     │   SelfReflection    │
                     │                     │
                     │  Critique Prompt:   │
                     │  - 覆盖度检查       │
                     │  - 证据充分性       │
                     │  - 逻辑一致性       │
                     │  - 来源可信度       │
                     └─────────────────────┘
                              │
                              ▼
                     ┌─────────────────────┐
                     │   ReflectionResult  │
                     │                     │
                     │  score: 0-100       │
                     │  issues: [...]      │
                     │  suggestions: [...] │
                     │  needsRevision: bool│
                     └─────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
              score >= 80          score < 80
                    │                   │
                    ▼                   ▼
               Final Answer      Revision Loop
                                        │
                                        ├─▶ 补充检索
                                        ├─▶ 答案修订
                                        └─▶ 重新 Reflection
```

#### Critique Prompt 设计

```typescript
const CRITIQUE_PROMPT = `
你是一个医学答案质量审查员。请审查以下答案的质量。

## 原始问题
${query}

## 生成的答案
${answer}

## 检索证据
${retrievalResults.map(r => r.content).join('\n')}

## 请评估以下维度（每项0-25分）

1. **覆盖度**：答案是否完整覆盖问题的所有方面？
   - 是否回答了核心问题
   - 是否处理了所有识别的实体
   - 是否考虑了边界条件

2. **证据充分性**：答案是否有足够的证据支持？
   - 每个结论是否有来源
   - 来源是否权威（指南优于病例报告）
   - 是否有相互矛盾的证据

3. **逻辑一致性**：答案是否逻辑清晰？
   - 结论与证据是否一致
   - 是否有不合理的推理跳跃
   - 是否有遗漏的关键推理步骤

4. **来源可信度**：引用是否准确可信？
   - 来源是否可追溯
   - 年份是否最新
   - 是否标注了GRADE等级

## 输出格式
{
  "score": <总分0-100>,
  "dimensions": {
    "coverage": <0-25>,
    "evidence": <0-25>,
    "logic": <0-25>,
    "credibility": <0-25>
  },
  "issues": ["<问题1>", "<问题2>"],
  "suggestions": ["<建议1>", "<建议2>"],
  "needsRevision": true/false
}
`;
```

---

## 四、实施建议

### 4.1 技术选型建议

| 需求 | 建议方案 | 原因 |
|------|----------|------|
| DAG执行 | 自实现（轻量） | 任务数量有限，无需重型框架 |
| 并行执行 | Promise.all | 简单可靠，Node.js原生支持 |
| Token计数 | tiktoken | OpenAI官方库，支持多种模型 |
| 任务队列 | 内置队列 | 无外部依赖，简化架构 |
| 状态持久化 | SQLite | 轻量级，支持复杂查询 |

### 4.2 渐进式实施建议

**不要一次性重构**，采用渐进式演进：

1. **保留现有 ReAct 循环**，作为 PlanAndExecute 的 fallback
2. **先实现 Planning 层**，在复杂查询时启用
3. **逐步扩展工具**，保持向后兼容
4. **Reflection 可选**，高置信度时跳过

### 4.3 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| Planning LLM调用增加 | 延迟增加 | 复杂度判断，简单查询跳过Planning |
| DAG执行复杂 | 调试困难 | 详细日志+状态可视化 |
| 并行执行竞态 | 状态冲突 | 任务隔离+结果独立收集 |
| Reflection循环无限 | 资源浪费 | 最大反思次数限制（如3次） |

---

## 五、参考资料

### 5.1 Agent框架参考

- **LangGraph**: DAG编排、状态管理、分支探索
- **AutoGPT**: 任务分解、自我反思、长期记忆
- **ReAct Paper**: Reasoning + Acting 模式理论基础
- **PlanAndExecute**: LangChain官方实现参考

### 5.2 医学Agent特殊考虑

- **安全性**: 答案必须可追溯，避免LLM编造
- **权威性**: 优先引用指南，标注GRADE等级
- **完整性**: 多实体查询需要并行检索+合并
- **专业性**: 领域词典+指标计算+相互作用检查

---

## 六、下一步行动

### 立即可做（本周）

1. 创建 `openspec/changes/agent-planning-enhancement` 变更提案
2. 设计 TaskPlanner 组件接口
3. 实现基础 Task DAG 数据结构

### 需要讨论

- Planning 阶段是否需要单独LLM调用？还是复用现有Reasoner？
- 并行执行的最大并发数限制？
- Reflection 循环的最大迭代次数？
- 是否需要引入 Agent 框架（如 LangGraph）？