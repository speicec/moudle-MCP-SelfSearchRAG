# PlanAndExecute 模式改进设计分析

> 探索时间：2026-04-22
> 基于 OpenSpec 变更: `agent-planning-enhancement`
> 目的: 深入理解新架构如何解决现有问题

---

## 1. 当前架构痛点回顾

```
┌─────────────────────────────────────────────────────────────────┐
│                    当前 ReAct 架构痛点                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ❌ 无任务分解                                                   │
│     复杂查询无法处理                                             │
│     例: "二甲双胍和利拉鲁肽哪个更适合肾功能不全患者"             │
│         → 无法分解为并行检索任务                                 │
│         → 需要多轮串行执行                                       │
│                                                                 │
│  ❌ 线性执行                                                     │
│     检索效率低                                                   │
│     例: 多实体查询                                               │
│         → 每个实体单独检索轮次                                   │
│         → 无法并行调度                                           │
│                                                                 │
│  ❌ 无上下文管理                                                 │
│     Token 超限风险                                               │
│     → 无 Token 计数机制                                          │
│     → 无动态截断策略                                             │
│     → 长检索结果可能导致超限                                     │
│                                                                 │
│  ❌ 无自我修正                                                   │
│     答案质量不稳定                                               │
│     → 检索失败无补救机制                                         │
│     → 无 Re-planning 能力                                        │
│     → 无法动态调整策略                                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. PlanAndExecute 新架构总览

### 2.1 核心设计理念

**从 ReAct (Think→Act→Observe→Decide) 升级到 PlanAndExecute (Plan→Execute→Evaluate→Replan)**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PlanAndExecute 架构流程                                   │
└─────────────────────────────────────────────────────────────────────────────┘

                              Query + Entities
                                      │
                                      ▼
                           ┌─────────────────────┐
                           │   ComplexityJudge   │
                           │   (复杂度判断)        │
                           └─────────────────────┘
                                      │
                          ┌───────────┴───────────┐
                          │                       │
                     simple                  moderate/complex
                          │                       │
                          ▼                       ▼
                    直接 ReAct            ┌─────────────────────┐
                                         │   IntentAnalyzer    │
                                         │   (意图分析)         │
                                         └─────────────────────┘
                                                  │
                                                  ▼
                                         ┌─────────────────────┐
                                         │   TemplateMatcher   │
                                         │   (模板匹配)         │
                                         └─────────────────────┘
                                                  │
                                      ┌───────────┴───────────┐
                                      │                       │
                                 matched                  unmatched
                                      │                       │
                                      ▼                       ▼
                               使用模板 DAG          ┌─────────────────────┐
                                                    │   TaskPlanner        │
                                                    │   (LLM Planning)     │
                                                    └─────────────────────┘
                                                  │
                                                  ▼
                                         ┌─────────────────────┐
                                         │   DAGValidator      │
                                         │   (规则验证)         │
                                         └─────────────────────┘
                                                  │
                                      ┌───────────┴───────────┐
                                      │                       │
                                 valid=false             valid=true
                                      │                       │
                                      ▼                       ▼
                               AutoCorrect 或回退    ┌─────────────────────┐
                                                    │   TaskExecutor       │
                                                    │   (DAG 执行)         │
                                                    └─────────────────────┘
                                                  │
                                                  ▼
                                         ┌─────────────────────┐
                                         │   ContextManager    │
                                         │   (上下文管理)       │
                                         └─────────────────────┘
                                                  │
                                                  ▼
                                         ┌─────────────────────┐
                                         │   ResultChecker     │
                                         │   (结果检查)         │
                                         └─────────────────────┘
                                                  │
                                      ┌───────────┴───────────┐
                                      │                       │
                                 satisfied               not satisfied
                                      │                       │
                                      ▼                       ▼
                              generate_answer      ┌─────────────────────┐
                                                   │   ReplanningEngine   │
                                                   │   (动态调整)         │
                                                   └─────────────────────┘
                                              │
                                              └──────────────────────▶ TaskExecutor
```

### 2.2 新增组件清单

| 组件 | 文件位置 | 核心功能 |
|------|----------|----------|
| ComplexityJudge | `src/medical/agent/ComplexityJudge.ts` | 复杂度分级判断 |
| IntentAnalyzer | `src/medical/agent/IntentAnalyzer.ts` | 查询意图分析 |
| TemplateMatcher | `src/medical/agent/TemplateMatcher.ts` | 结构化模板匹配 |
| TaskPlanner | `src/medical/agent/TaskPlanner.ts` | LLM 任务规划 |
| DAGValidator | `src/medical/agent/DAGValidator.ts` | DAG 规则验证 |
| TaskExecutor | `src/medical/agent/TaskExecutor.ts` | DAG 执行引擎 |
| ContextManager | `src/medical/agent/ContextManager.ts` | Token 计数与截断 |
| ReplanningEngine | `src/medical/agent/ReplanningEngine.ts` | 动态重规划 |

---

## 3. 复杂度分级策略

### 3.1 四级复杂度定义

```typescript
type ComplexityLevel = 'simple' | 'moderate' | 'complex' | 'structured'

// ComplexityJudge 判断规则
assessComplexity(entities, query): ComplexityLevel {
  
  // Simple: 实体数 ≤ 1
  if (entities.length <= 1):
    return 'simple'  // 跳过 Planning，零成本
  
  // Structured: 有明确过滤条件
  if (hasYearFilter || hasSourceFilter || hasCategoryFilter):
    return 'structured'  // 使用确定性模板
  
  // Moderate: 2-3 实体，单一意图
  if (entities.length <= 3 && intent === 'single'):
    return 'moderate'  // 单次 Planning
  
  // Complex: 多实体 + 对比/综合意图
  if (entities.length > 3 || intent === 'comparison' || intent === 'synthesis'):
    return 'complex'  // 多阶段 Planning + Replanning 支持
}
```

### 3.2 成本控制策略

```
┌─────────────────────────────────────────────────────────────────┐
│                    Planning 成本分层策略                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Simple (实体数 ≤ 1):                                           │
│    → 跳过 Planning                                              │
│    → 直接使用 ReAct                                             │
│    → 成本: 0 LLM 调用                                           │
│                                                                 │
│  Structured (有过滤条件):                                        │
│    → 使用模板 DAG                                               │
│    → 无 LLM Planning 调用                                       │
│    → 成本: 0 LLM 调用                                           │
│                                                                 │
│  Moderate (2-3 实体):                                           │
│    → 单次 LLM Planning                                          │
│    → ~700 tokens                                                │
│    → 成本: 1 LLM 调用                                           │
│                                                                 │
│  Complex (多实体/对比):                                          │
│    → LLM Planning + Replanning 支持                             │
│    → maxReplanRounds = 2                                        │
│    → 成本: 1-3 LLM 调用                                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. 模板匹配机制

### 4.1 四种基础模板

```typescript
// STRUCTURED_TEMPLATES 定义
const STRUCTURED_TEMPLATES = {
  
  // 模板 1: 指南年份过滤
  guideline_year_filter: {
    conditions: { requireYearFilter: true },
    dag: [
      { id: 't1', type: 'retrieve', params: { query, filters: { year } }, priority: 1 },
      { id: 't2', type: 'evaluate', params: {}, dependencies: ['t1'], priority: 3 },
      { id: 't3', type: 'generate_answer', params: {}, dependencies: ['t2'], priority: 7 }
    ]
  },
  
  // 模板 2: 药物禁忌检查
  drug_contraindication: {
    conditions: { queryType: 'safety_check', drugs: 1, indicators: 0 },
    dag: [
      { id: 't1', type: 'check_contraindication', params: { drugId }, priority: 2 },
      { id: 't2', type: 'retrieve', params: { query: drugContraindicationQuery }, priority: 1 },
      { id: 't3', type: 'generate_answer', params: {}, dependencies: ['t1', 't2'], priority: 7 }
    ]
  },
  
  // 模板 3: 药物对比
  drug_comparison: {
    conditions: { queryType: 'comparison', drugs: >=2 },
    dag: [
      { id: 't1', type: 'retrieve', params: { entity: drug1 }, priority: 1, parallelGroup: 'p1' },
      { id: 't2', type: 'retrieve', params: { entity: drug2 }, priority: 1, parallelGroup: 'p1' },
      { id: 't3', type: 'retrieve', params: { query: 'comparison criteria' }, priority: 2 },
      { id: 't4', type: 'evaluate', params: {}, dependencies: ['t1', 't2', 't3'], priority: 3 },
      { id: 't5', type: 'generate_answer', params: {}, dependencies: ['t4'], priority: 7 }
    ],
    parallelGroups: { p1: ['t1', 't2'] }  // 并行检索两个药物
  },
  
  // 模板 4: 指标-药物查询
  indicator_drug_query: {
    conditions: { queryType: 'safety_check', drugs: 1, indicators: 1, hasValue: true },
    dag: [
      { id: 't1', type: 'calculate_indicator', params: { indicator, value }, priority: 1 },
      { id: 't2', type: 'retrieve', params: { entity: drug }, priority: 1, parallelGroup: 'p1' },
      { id: 't3', type: 'retrieve', params: { entity: indicatorThreshold }, priority: 1, parallelGroup: 'p1' },
      { id: 't4', type: 'check_contraindication', params: { drugId, threshold }, dependencies: ['t1'], priority: 2 },
      { id: 't5', type: 'generate_answer', params: {}, dependencies: ['t2', 't3', 't4'], priority: 7 }
    ],
    parallelGroups: { p1: ['t2', 't3'] }
  }
}
```

### 4.2 模板匹配流程

```typescript
matchTemplate(intentAnalysis, entities): TemplateMatchResult {
  for (templateName, template in STRUCTURED_TEMPLATES):
    conditions = template.conditions
    
    // 检查年份过滤条件
    if (conditions.requireYearFilter && !hasYearFilter): continue
    
    // 检查查询类型
    if (conditions.queryType && intentAnalysis.type !== conditions.queryType): continue
    
    // 检查实体数量
    if (conditions.drugs && entities.drugs.length < conditions.drugs): continue
    if (conditions.indicators && entities.indicators.length !== conditions.indicators): continue
    
    // 检查是否有数值
    if (conditions.hasValue && !hasIndicatorValue): continue
    
    // 匹配成功
    return { matched: true, templateName, dag: template.dag }
  
  // 无匹配
  return { matched: false }
}
```

---

## 5. DAG 执行引擎

### 5.1 并行执行策略

```typescript
// PARALLEL_TYPE_LIMITS - 并行度限制
const PARALLEL_TYPE_LIMITS = {
  retrieve: 3,              // 同时最多检索 3 个实体
  check_interaction: 1,     // 外部 API 限流
  check_contraindication: 2, // 禁忌检查限制
  generate_answer: 1        // 答案生成必须串行
}

// executeParallelGroup 并行执行逻辑
async executeParallelGroup(group, dag): Promise<TaskResult[]> {
  // 按类型分组
  typeGroups = groupByType(group)
  
  // 每个类型内并行执行，但限制并发数
  results = []
  for (type, tasks in typeGroups):
    limit = PARALLEL_TYPE_LIMITS[type]
    
    // 分批执行
    batches = chunk(tasks, limit)
    for (batch in batches):
      batchResults = await Promise.all(
        batch.map(task => executeTask(task))
      )
      results.push(...batchResults)
  
  return results
}
```

### 5.2 DAG 执行流程

```
┌─────────────────────────────────────────────────────────────────┐
│                    DAG 执行流程                                  │
└─────────────────────────────────────────────────────────────────┘

                    Validated DAG
                           │
                           ▼
              ┌────────────────────────┐
              │   Initialize State     │
              │   pending: all tasks   │
              │   running: []          │
              │   completed: {}        │
              │   failed: []           │
              └────────────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │   Find Ready Tasks     │
              │   (dependencies met)   │
              └────────────────────────┘
                           │
           ┌───────────────┴───────────────┐
           │                               │
      hasParallelGroup               noParallelGroup
           │                               │
           ▼                               ▼
  ┌─────────────────────┐        ┌─────────────────────┐
  │ Execute Parallel    │        │ Execute Sequential  │
  │ Promise.all + limit │        │ One by One          │
  └─────────────────────┘        └─────────────────────┘
           │                               │
           └───────────────┬───────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │   Collect Results      │
              │   Update State         │
              │   completed → result   │
              │   failed → error       │
              └────────────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │   Check Completion     │
              └────────────────────────┘
                           │
           ┌───────────────┴───────────────┐
           │                               │
     all completed                 more pending
           │                               │
           ▼                               ▼
  ┌─────────────────────┐        ┌─────────────────────┐
  │ Build Summary       │        │ Continue Loop       │
  │ Return Results      │        │ Find Ready Tasks    │
  └─────────────────────┘        └─────────────────────┘
```

### 5.3 失败恢复机制

```typescript
// fallbackStrategy 定义
type FallbackStrategy = {
  type: 'retry' | 'alternative' | 'skip' | 'abort'
  retryCount?: number
  alternativeTask?: TaskDefinition
}

// handleFailure 失败处理
handleFailure(task, error, fallbackStrategy): TaskResult {
  
  // Retry: 重试执行
  if (fallbackStrategy.type === 'retry'):
    for (i = 0; i < fallbackStrategy.retryCount; i++):
      try:
        result = await executeTask(task)
        return result
      except:
        delay = exponentialBackoff(i)  // 100ms, 200ms, 400ms...
    return { success: false, error: 'retry exhausted' }
  
  // Alternative: 执行替代任务
  if (fallbackStrategy.type === 'alternative'):
    alternativeTask = fallbackStrategy.alternativeTask
    result = await executeTask(alternativeTask)
    return result
  
  // Skip: 跳过任务，继续执行
  if (fallbackStrategy.type === 'skip'):
    return { success: false, skipped: true }
  
  // Abort: 中止整个 DAG
  if (fallbackStrategy.type === 'abort'):
    throw new DAGExecutionAbortError(task, error)
}
```

---

## 6. DAG 验证规则

### 6.1 六类验证规则

```
┌─────────────────────────────────────────────────────────────────┐
│                    DAG 验证规则                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. 结构完整性验证                                               │
│     ├── Task ID 唯一性 (Set 检测)                                │
│     ├── 依赖引用存在性 (missing_dependency)                      │
│     └── 参数完整性 (Schema 校验)                                 │
│                                                                 │
│  2. 循环依赖检测                                                 │
│     ├── 直接循环: A → B → A                                     │
│     ├── 间接循环: A → B → C → A                                 │
│     └── 检测算法: DFS 图遍历                                    │
│                                                                 │
│  3. 自依赖检测                                                   │
│     ├── Task 依赖自身                                           │
│     ├── 错误类型: self_dependency                               │
│     └── 自动修正: 移除自依赖                                     │
│                                                                 │
│  4. 并行组内部依赖                                               │
│     ├── 同一并行组内有依赖关系                                   │
│     ├── 错误类型: parallel_internal_dependency                  │
│     └── 自动修正: 移出并行组                                     │
│                                                                 │
│  5. 并行类型限制                                                 │
│     ├── retrieve 类型 ≤ 3                                       │
│     ├── check_interaction ≤ 1                                   │
│     ├── 警告类型: same_type_parallel_limit                      │
│                                                                 │
│  6. 优先级顺序                                                   │
│     ├── 依赖任务优先级 < 被依赖任务优先级                        │
│     ├── 警告类型: priority_order_violation                      │
│     └── 自动修正: 调整优先级                                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 DFS 循环检测算法

```typescript
// detectCircularDependencies 实现
detectCircularDependencies(dag): ValidationResult {
  const visited = new Set<string>()
  const recursionStack = new Set<string>()
  const cycles: string[][] = []
  
  for (task in dag.tasks):
    if (!visited.has(task.id)):
      cycle = dfsDetect(task, visited, recursionStack)
      if (cycle):
        cycles.push(cycle)
  
  if (cycles.length > 0):
    return {
      valid: false,
      errors: [{ type: 'circular_dependency', cyclePath: cycles[0] }]
    }
  
  return { valid: true }
}

dfsDetect(task, visited, recursionStack): string[] | null {
  visited.add(task.id)
  recursionStack.add(task.id)
  
  for (depId in task.dependencies):
    depTask = dag.getTask(depId)
    
    // 依赖不存在
    if (!depTask): continue
    
    // 在当前递归栈中 → 发现循环
    if (recursionStack.has(depId)):
      return [task.id, depId, task.id]  // A → B → A
    
    // 未访问 → 继续 DFS
    if (!visited.has(depId)):
      cycle = dfsDetect(depTask, visited, recursionStack)
      if (cycle):
        return [task.id, ...cycle]  // A → B → C → A
  
  recursionStack.delete(task.id)
  return null
}
```

### 6.3 自动修正机制

```typescript
// autoCorrectDAG 自动修正
autoCorrectDAG(dag, validationResult): CorrectedDAG {
  corrected = dag.clone()
  
  for (error in validationResult.errors):
    
    // 自依赖修正: 移除自引用
    if (error.type === 'self_dependency'):
      task = corrected.getTask(error.taskId)
      task.dependencies = task.dependencies.filter(d => d !== error.taskId)
    
    // 并行组内部依赖修正: 移出并行组
    if (error.type === 'parallel_internal_dependency'):
      task = corrected.getTask(error.taskId)
      task.parallelGroup = null
    
    // 优先级修正: 调整依赖任务优先级
    if (error.type === 'priority_order_violation'):
      depTask = corrected.getTask(error.dependencyTaskId)
      depTask.priority = error.suggestedPriority
  
  // 重新验证修正后的 DAG
  return validateDAG(corrected)
}
```

---

## 7. Re-planning 机制

### 7.1 多维度触发阈值

```
┌─────────────────────────────────────────────────────────────────┐
│                    Re-planning 触发阈值                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  维度 1: 实体覆盖率 (权重 40%)                                   │
│    ├── threshold: ≥ 0.8                                         │
│    ├── 计算: entitiesCovered / totalEntities                   │
│    └── 覆盖率 < 0.8 → 触发 Replanning                           │
│                                                                 │
│  维度 2: 高置信度占比 (权重 20%)                                 │
│    ├── threshold: ≥ 0.3                                         │
│    ├── 计算: highConfidenceDocs / totalDocs                    │
│    └── 占比 < 0.3 → MEDIUM urgency                              │
│                                                                 │
│  维度 3: 失败任务占比 (权重 10%)                                 │
│    ├── threshold: ≤ 0.2                                         │
│    ├── 计算: failedTasks / totalTasks                          │
│    └── 占比 > 0.2 → HIGH urgency                                │
│                                                                 │
│  维度 4: 综合满意度阈值                                          │
│    ├── trigger threshold: < 0.65                                │
│    ├── 计算: compositeScore                                     │
│    └── score < 0.65 → 触发 Replanning                           │
│                                                                 │
│  特殊触发:                                                       │
│    ├── 关键任务失败 → CRITICAL urgency                          │
│    ├── 主焦点实体缺失 → CRITICAL urgency                        │
│    └── 无指南来源 → 触发指南检索补充                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 复合满意度评分

```typescript
// calculateCompositeScore 计算
calculateCompositeScore(executionSummary, retrievalResults): number {
  
  // 实体覆盖率评分 (40%)
  coverageScore = entitiesCovered / totalEntities
  
  // 证据质量评分 (25%)
  evidenceScore = averageEvidenceGrade / 4  // Grade A=1, B=0.75, C=0.5, D=0.25
  
  // 执行成功率评分 (15%)
  executionScore = successfulTasks / totalTasks
  
  // 答案置信度评分 (20%)
  answerScore = entities.confidence
  
  // 加权组合
  compositeScore = 
    0.40 × coverageScore +
    0.25 × evidenceScore +
    0.15 × executionScore +
    0.20 × answerScore
  
  return compositeScore
}
```

### 7.3 紧迫度分级处理

```typescript
type UrgencyLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'

// 紧迫度对应的延迟
const URGENCY_DELAYS = {
  CRITICAL: 0ms,    // 立即执行
  HIGH: 100ms,      // 短延迟
  MEDIUM: 300ms,    // 中延迟
  LOW: 500ms        // 长延迟，可选跳过
}

// 紧迫度判断
determineUrgency(triggerReasons): UrgencyLevel {
  
  // CRITICAL: 关键任务失败或主实体缺失
  if (hasCriticalTaskFailure || primaryFocusEntityMissing):
    return 'CRITICAL'
  
  // HIGH: 失败任务占比 > 0.2
  if (failedTaskRatio > 0.2):
    return 'HIGH'
  
  // MEDIUM: 高置信度占比 < 0.3
  if (highConfidenceRatio < 0.3):
    return 'MEDIUM'
  
  // LOW: 其他情况
  return 'LOW'
}
```

### 7.4 Replanning 限制机制

```typescript
// Replanning 限制参数
const REPLANNING_LIMITS = {
  maxReplanRounds: 2,         // 最大重规划轮数
  maxSupplementalTasks: 3,    // 最大补充任务数
  convergenceThreshold: 0.05  // 收敛阈值
}

// checkReplanningLimits 检查
checkReplanningLimits(state): ReplanningDecision {
  
  // 轮数限制
  if (state.replanRounds >= maxReplanRounds):
    return { allowed: false, reason: 'max_rounds_reached' }
  
  // 补充任务限制
  if (state.supplementalTaskCount >= maxSupplementalTasks):
    return { allowed: false, reason: 'max_tasks_reached' }
  
  // 收敛检查: 两轮无显著提升
  if (state.scoreImprovement < convergenceThreshold):
    return { allowed: false, reason: 'convergence_detected' }
  
  return { allowed: true }
}
```

---

## 8. Context Manager 上下文管理

### 8.1 Token 计数机制

```typescript
// ContextManager 配置
interface ContextManagerConfig {
  maxTokens: 60000,           // 上下文上限
  reserveForOutput: 4000,     // 输出预留
  compressionThreshold: 0.8,  // 压缩触发阈值 (80%)
  minimumHighConfidence: 1    // 最少保留高置信度条目
}

// Token 计数方法
countTokens(content): number {
  // 优先使用 tiktoken 精确计数
  if (tiktokenAvailable):
    return tiktoken.count(content)
  
  // 降级: 估算方法
  // 中文: ~2 tokens/char
  // 英文: ~0.25 tokens/word
  return estimateTokens(content)
}
```

### 8.2 优先级截断策略

```typescript
// 优先级定义
const PRIORITY_LEVELS = {
  GUIDELINE_SOURCE: 1,      // 指南来源最高
  HIGH_CONFIDENCE_DOC: 2,   // 高置信度文档
  PRIMARY_ENTITY_EVIDENCE: 3, // 主实体证据
  MEDIUM_CONFIDENCE_DOC: 4, // 中置信度文档
  LOW_CONFIDENCE_DOC: 5     // 低置信度最低
}

// truncateByPriority 截断逻辑
truncateByPriority(entries, maxTokens): ContextEntry[] {
  // 按优先级排序
  sorted = entries.sort((a, b) => a.priority - b.priority)
  
  // 从低优先级开始移除
  while (currentTokens > maxTokens):
    lowest = sorted.pop()  // 移除最低优先级
    
    // 保护: 至少保留1个高置信度
    if (sorted.filter(e => e.priority <= 2).length < 1):
      sorted.push(lowest)  // 恢复最后移除的高置信度
      break
  
  return sorted
}
```

### 8.3 压缩机制

```typescript
// compressEntries 压缩逻辑
compressEntries(entries): CompressedEntry[] {
  // 只压缩低优先级条目 (priority > 3)
  toCompress = entries.filter(e => e.priority > 3)
  
  compressed = toCompress.map(entry => ({
    ...entry,
    content: summarize(entry.content),  // 压缩为 ≤100 tokens
    compressed: true,
    originalTokens: entry.tokens,
    compressedTokens: countTokens(summarize(entry.content))
  }))
  
  // 压缩后节省约 30-50% tokens
  return compressed
}

// 压缩触发条件
if (currentTokens > maxTokens × compressionThreshold):
  entries = compressEntries(entries)
  
  // 压缩后仍超限 → 继续截断
  if (currentTokens > maxTokens):
    entries = truncateByPriority(entries, maxTokens)
```

---

## 9. 改进对比总结

### 9.1 核心改进对比表

| 维度 | 当前 ReAct | PlanAndExecute | 改进效果 |
|------|------------|-----------------|----------|
| **任务分解** | 无，每轮单一决策 | 有，Task DAG 生成 | 复杂查询可处理 |
| **并行执行** | 无，串行检索 | 有，Promise.all + 类型限制 | 检索效率提升 |
| **上下文管理** | 无，Token 超限风险 | 有，Token 计数 + 截断 | 避免 Token 超限 |
| **自我修正** | 无，答案质量不稳定 | 有，Re-planning 机制 | 动态调整策略 |
| **成本控制** | 每轮 LLM 调用 | 分级策略 + 模板匹配 | 简单查询零成本 |
| **安全性** | 无验证 | DAG 规则验证 | 防止无效执行 |

### 9.2 数据流改进对比

```
当前 ReAct 数据流:
Query → Think → Act(retrieve) → Observe → Decide → Think → ... → Answer
  (每轮1次LLM)   (串行)        (结果累积)   (判断)     (循环)    (生成)

PlanAndExecute 数据流:
Query → ComplexityJudge → IntentAnalyzer → TemplateMatcher/TaskPlanner → DAGValidator → TaskExecutor → ResultChecker → Answer/Replan
  (规则判断)      (意图分析)      (模板/LLM规划)    (规则验证)   (并行执行)   (阈值检查)    (生成/补充)
  
改进点:
1. Planning 前置，避免循环决策
2. DAG 验证确保执行安全
3. 并行执行提升效率
4. 阈值检查触发动态调整
```

---

## 10. 实现进度

根据 `tasks.md` 当前状态：

| 阶段 | 任务 | 状态 |
|------|------|------|
| Phase 1 | ExecutionTypes.ts | ✅ 完成 |
| Phase 1 | DAGValidator.ts | ✅ 完成 |
| Phase 1 | ContextManager.ts | ✅ 完成 |
| Phase 2 | ComplexityJudge.ts | ✅ 完成 |
| Phase 2 | IntentAnalyzer.ts | ✅ 完成 |
| Phase 2 | TemplateMatcher.ts | ✅ 完成 |
| Phase 3 | TaskPlanner.ts | ⏳ 待实现 |
| Phase 3 | TaskExecutor.ts | ⏳ 待实现 |
| Phase 3 | ReplanningEngine.ts | ⏳ 待实现 |
| Phase 4 | AgentExecutor 集成 | ⏳ 待实现 |
| Phase 4 | MCP Tool 增强 | ⏳ 待实现 |

---

## 11. 相关文件索引

| 文件 | 路径 | 说明 |
|------|------|------|
| Proposal | `openspec/changes/agent-planning-enhancement/proposal.md` | 变更提案 |
| Design | `openspec/changes/agent-planning-enhancement/design.md` | 设计文档 |
| Tasks | `openspec/changes/agent-planning-enhancement/tasks.md` | 任务清单 |
| Task Planning Spec | `openspec/changes/agent-planning-enhancement/specs/task-planning/spec.md` | 任务规划规格 |
| DAG Execution Spec | `openspec/changes/agent-planning-enhancement/specs/dag-execution/spec.md` | DAG 执行规格 |
| Context Management Spec | `openspec/changes/agent-planning-enhancement/specs/context-management/spec.md` | 上下文管理规格 |
| Replanning Spec | `openspec/changes/agent-planning-enhancement/specs/replanning-trigger/spec.md` | Replanning 规格 |
| DAG Validation Spec | `openspec/changes/agent-planning-enhancement/specs/dag-validation/spec.md` | DAG 验证规格 |