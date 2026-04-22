# Re-planning 触发阈值与 DAG 验证设计

## 一、Re-planning 触发阈值设计

### 1.1 触发维度矩阵

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Re-planning 触发维度                                        │
└─────────────────────────────────────────────────────────────────────────────┘

  触发维度                    阈值设计                    权重
  ═══════════                 ══════════                  ════

  1. 检索覆盖度
     ──────────────────────────────────────────────────────────────────────────
     • 实体覆盖率              entitiesCovered / totalEntities ≥ 0.8        40%
     • 高置信度占比            highConfidenceDocs / totalDocs ≥ 0.3        20%
     • 缺失实体数              missingEntities.length ≤ 1                   15%

  2. 证据质量
     ──────────────────────────────────────────────────────────────────────────
     • 平均证据等级            avgGradeLevel ≥ 'B'                         15%
     • 来源权威性              guidelineCount ≥ 1                          10%

  3. 执行状态
     ──────────────────────────────────────────────────────────────────────────
     • 失败任务占比            failedTasks / totalTasks ≤ 0.2              10%
     • 关键任务失败            criticalTaskFailed = false                  必须

  综合触发阈值:
     ──────────────────────────────────────────────────────────────────────────
     • 综合满意度              compositeScore ≥ 0.65                       触发阈值
     • 确定性触发              criticalTaskFailed = true                   立即触发
```

### 1.2 阈值配置定义

```typescript
interface ReplanningThresholds {
  // 覆盖度阈值
  coverage: {
    entityCoverageMin: number;      // 实体覆盖率最小值: 0.8
    entityCoverageWarn: number;     // 实体覆盖率警告值: 0.5
    missingEntitiesMax: number;     // 缺失实体最大数: 1
    missingCriticalEntity: boolean; // 缺失关键实体（主关注实体）
  };

  // 证据质量阈值
  evidence: {
    highConfidenceMin: number;      // 高置信度文档最小占比: 0.3
    avgGradeMin: GradeLevel;        // 平均证据等级最小值: 'C'
    guidelineCountMin: number;      // 指南来源最小数: 1
    yearFreshnessMax: number;       // 来源年份最大跨度: 3年
  };

  // 执行状态阈值
  execution: {
    failedTaskRatioMax: number;     // 失败任务最大占比: 0.2
    criticalTaskMustSucceed: boolean; // 关键任务（检索）必须成功
    retryExhausted: boolean;        // 重试次数耗尽
  };

  // 综合阈值
  composite: {
    satisfactionMin: number;        // 综合满意度最小值: 0.65
    confidenceMin: number;          // 答案置信度最小值: 0.7
  };

  // Re-planning 限制
  limits: {
    maxReplanRounds: number;        // 最大Re-planning轮数: 2
    maxSupplementalTasks: number;   // 最大补充任务数: 3
    replanCooldown: number;         // Re-planning冷却时间: 500ms
  };
}

// 默认阈值配置
const DEFAULT_REPLANNING_THRESHOLDS: ReplanningThresholds = {
  coverage: {
    entityCoverageMin: 0.8,     // 80%实体被覆盖
    entityCoverageWarn: 0.5,    // 50%触发警告日志
    missingEntitiesMax: 1,      // 最多允许1个实体缺失
    missingCriticalEntity: false, // 不允许缺失主要关注实体
  },

  evidence: {
    highConfidenceMin: 0.3,     // 30%文档高置信度
    avgGradeMin: 'C',           // 平均证据等级≥C
    guidelineCountMin: 1,       // 至少1个指南来源
    yearFreshnessMax: 3,        // 来源年份跨度≤3年
  },

  execution: {
    failedTaskRatioMax: 0.2,    // 失败任务≤20%
    criticalTaskMustSucceed: true,
    retryExhausted: false,
  },

  composite: {
    satisfactionMin: 0.65,      // 综合满意度≥65%
    confidenceMin: 0.7,         // 答案置信度≥70%
  },

  limits: {
    maxReplanRounds: 2,
    maxSupplementalTasks: 3,
    replanCooldown: 500,
  },
};
```

### 1.3 触发优先级矩阵

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Re-planning 触发优先级                                      │
└─────────────────────────────────────────────────────────────────────────────┘

  优先级        触发原因                处理策略                    时间限制
  ════════      ═══════════             ══════════                  ════════

  CRITICAL      关键任务失败            立即触发Re-planning          0ms
  (立即触发)    关键实体缺失            补充检索+替代工具            
               重试耗尽               使用fallback策略            

  HIGH          失败任务>20%            触发Re-planning              100ms
  (快速触发)    实体覆盖<50%           补充检索缺失实体            
               答案置信度<70%         扩展检索+重新评估            

  MEDIUM        高置信度<30%            触发Re-planning              300ms
  (正常触发)    无指南来源             添加指南检索任务            
               证据等级<C             扩展检索范围                

  LOW           实体覆盖<80%            记录日志，可选触发           500ms
  (可选触发)    综合得分<65%           视情况决定                  
               答案覆盖<65%           低优先级补充                


  触发决策流程:
  ─────────────────────────────────────────────────────────────────────────────

                    执行完成
                        │
                        ▼
              ┌─────────────────────┐
              │  关键任务失败检查    │
              │  (CRITICAL触发点)    │
              └─────────────────────┘
                        │
              ┌─────────┴─────────┐
              │                   │
           有失败             全成功
              │                   │
              ▼                   ▼
        立即Re-planning    ┌─────────────────────┐
                        │  覆盖度检查          │
                        │  (HIGH触发点)        │
                        └─────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
               <50%                 ≥50%
                    │                   │
                    ▼                   ▼
              快速Re-planning    ┌─────────────────────┐
                                │  综合评分检查        │
                                │  (MEDIUM/LOW触发点) │
                                └─────────────────────┘
                                      │
                            ┌─────────┴─────────┐
                            │                   │
                       score < 0.65        score ≥ 0.65
                            │                   │
                            ▼                   ▼
                      触发Re-planning      满足，生成答案
```

### 1.4 触发判断算法

```typescript
interface ExecutionResultSummary {
  // 检索统计
  retrievalStats: {
    total: number;
    entitiesCovered: number;
    totalEntities: number;
    highConfidence: number;
    missingEntities: string[];
  };

  // 证据评估
  evidenceStats: {
    avgGrade: GradeLevel;
    guidelineCount: number;
    latestYear: number;
    oldestYear: number;
  };

  // 执行状态
  executionStats: {
    totalTasks: number;
    completedTasks: number;
    failedTasks: number;
    criticalTaskIds: string[];
    failedCriticalTasks: string[];
    retryExhaustedTasks: string[];
  };

  // 答案预评估
  answerPreview: {
    confidence: number;
    coverage: number;
    issues: string[];
  };
}

interface ReplanningDecision {
  trigger: boolean;
  triggerReason: TriggerReason[];
  urgency: 'critical' | 'high' | 'medium' | 'low';
  supplementalTaskFocus: string[];
  score: number;
}

type TriggerReason = 
  | 'entity_coverage_low'
  | 'critical_entity_missing'
  | 'high_confidence_low'
  | 'evidence_grade_low'
  | 'no_guideline_source'
  | 'critical_task_failed'
  | 'too_many_failed_tasks'
  | 'retry_exhausted'
  | 'answer_confidence_low'
  | 'answer_coverage_low';

function evaluateReplanningNeed(
  summary: ExecutionResultSummary,
  thresholds: ReplanningThresholds
): ReplanningDecision {
  
  const reasons: TriggerReason[] = [];
  let urgency: ReplanningDecision['urgency'] = 'low';
  const supplementalFocus: string[] = [];

  // ==================== 覆盖度检查 ====================

  const entityCoverage = summary.retrievalStats.entitiesCovered / 
                          summary.retrievalStats.totalEntities;
  
  if (entityCoverage < thresholds.coverage.entityCoverageMin) {
    reasons.push('entity_coverage_low');
    supplementalFocus.push(...summary.retrievalStats.missingEntities);
    
    if (entityCoverage < thresholds.coverage.entityCoverageWarn) {
      urgency = 'high';
    }
  }

  // 关键实体缺失检查
  if (summary.retrievalStats.missingEntities.includes(
      summary.intentAnalysis.focus.primary)) {
    reasons.push('critical_entity_missing');
    urgency = 'critical';
    supplementalFocus.push(summary.intentAnalysis.focus.primary);
  }

  // ==================== 证据质量检查 ====================

  const highConfidenceRatio = summary.retrievalStats.highConfidence / 
                               summary.retrievalStats.total;
  
  if (highConfidenceRatio < thresholds.evidence.highConfidenceMin) {
    reasons.push('high_confidence_low');
    urgency = Math.max(urgencyLevel(urgency), urgencyLevel('medium')) 
              as ReplanningDecision['urgency'];
  }

  const gradeLevels: GradeLevel[] = ['A', 'B', 'C', 'D'];
  if (gradeLevels.indexOf(summary.evidenceStats.avgGrade) > 
      gradeLevels.indexOf(thresholds.evidence.avgGradeMin)) {
    reasons.push('evidence_grade_low');
  }

  if (summary.evidenceStats.guidelineCount < thresholds.evidence.guidelineCountMin) {
    reasons.push('no_guideline_source');
    supplementalFocus.push('guideline');
  }

  // ==================== 执行状态检查 ====================

  const failedRatio = summary.executionStats.failedTasks / 
                      summary.executionStats.totalTasks;
  
  if (failedRatio > thresholds.execution.failedTaskRatioMax) {
    reasons.push('too_many_failed_tasks');
    urgency = 'high';
  }

  // 关键任务失败检查
  if (summary.executionStats.failedCriticalTasks.length > 0) {
    reasons.push('critical_task_failed');
    urgency = 'critical';
    supplementalFocus.push(...summary.executionStats.failedCriticalTasks.map(
      id => `retry_${id}`
    ));
  }

  // 重试耗尽检查
  if (summary.executionStats.retryExhaustedTasks.length > 0) {
    reasons.push('retry_exhausted');
    supplementalFocus.push(...summary.executionStats.retryExhaustedTasks.map(
      id => `alternative_${id}`
    ));
  }

  // ==================== 答案预评估检查 ====================

  if (summary.answerPreview.confidence < thresholds.composite.confidenceMin) {
    reasons.push('answer_confidence_low');
    urgency = Math.max(urgencyLevel(urgency), urgencyLevel('medium')) 
              as ReplanningDecision['urgency'];
  }

  if (summary.answerPreview.coverage < thresholds.composite.satisfactionMin) {
    reasons.push('answer_coverage_low');
  }

  // ==================== 综合评分 ====================

  const score = calculateCompositeScore(summary, thresholds);

  // ==================== 最终决策 ====================

  return {
    trigger: reasons.length > 0 || score < thresholds.composite.satisfactionMin,
    triggerReason: reasons,
    urgency,
    supplementalTaskFocus: supplementalFocus,
    score,
  };
}

// 辅助函数
function urgencyLevel(level: ReplanningDecision['urgency']): number {
  const levels = { critical: 4, high: 3, medium: 2, low: 1 };
  return levels[level];
}

function calculateCompositeScore(
  summary: ExecutionResultSummary,
  thresholds: ReplanningThresholds
): number {
  // 覆盖度得分 (权重40%)
  const coverageScore = (
    (summary.retrievalStats.entitiesCovered / summary.retrievalStats.totalEntities) * 0.6 +
    (summary.retrievalStats.highConfidence / Math.max(summary.retrievalStats.total, 1)) * 0.4
  );

  // 证据质量得分 (权重25%)
  const gradeScore = { A: 1.0, B: 0.8, C: 0.6, D: 0.4 };
  const evidenceScore = (
    gradeScore[summary.evidenceStats.avgGrade] * 0.6 +
    Math.min(summary.evidenceStats.guidelineCount / thresholds.evidence.guidelineCountMin, 1) * 0.4
  );

  // 执行状态得分 (权重15%)
  const executionScore = 1 - (summary.executionStats.failedTasks / 
                               summary.executionStats.totalTasks);

  // 答案预评估得分 (权重20%)
  const answerScore = summary.answerPreview.confidence;

  // 综合得分
  return coverageScore * 0.4 + evidenceScore * 0.25 + 
         executionScore * 0.15 + answerScore * 0.2;
}
```

### 1.5 Re-planning 限制机制

```typescript
interface ReplanningState {
  round: number;                  // 当前轮数
  totalSupplementalTasks: number; // 累计补充任务数
  previousScores: number[];       // 前几轮得分历史
  cooldownUntil: number;          // 冷却结束时间
}

function checkReplanningLimits(
  state: ReplanningState,
  decision: ReplanningDecision,
  thresholds: ReplanningThresholds
): { allowed: boolean; reason?: string } {
  
  // 轮数限制
  if (state.round >= thresholds.limits.maxReplanRounds) {
    return { 
      allowed: false, 
      reason: `Max replanning rounds (${thresholds.limits.maxReplanRounds}) reached` 
    };
  }

  // 补充任务数限制
  const newTasksCount = decision.supplementalTaskFocus.length;
  if (state.totalSupplementalTasks + newTasksCount > 
      thresholds.limits.maxSupplementalTasks) {
    return { 
      allowed: false, 
      reason: `Max supplemental tasks (${thresholds.limits.maxSupplementalTasks}) exceeded` 
    };
  }

  // 冷却时间检查
  if (Date.now() < state.cooldownUntil) {
    return { 
      allowed: false, 
      reason: `Cooldown period active until ${state.cooldownUntil}` 
    };
  }

  // 收敛检查（得分无明显提升）
  if (state.previousScores.length >= 2) {
    const lastScore = state.previousScores[state.previousScores.length - 1];
    const prevScore = state.previousScores[state.previousScores.length - 2];
    const improvement = decision.score - lastScore;
    
    // 如果两轮都没提升，停止
    if (improvement < 0.05 && lastScore - prevScore < 0.05) {
      return { 
        allowed: false, 
        reason: 'Score not improving, stopping replanning' 
      };
    }
  }

  // 得分已达阈值
  if (decision.score >= thresholds.composite.satisfactionMin) {
    return { 
      allowed: false, 
      reason: `Score ${decision.score} meets threshold ${thresholds.composite.satisfactionMin}` 
    };
  }

  return { allowed: true };
}
```

---

## 二、DAG 验证自动化规则

### 2.1 验证维度矩阵

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DAG 验证维度                                                │
└─────────────────────────────────────────────────────────────────────────────┘

  验证维度                规则类型                错误级别
  ══════════              ══════════              ════════

  1. 结构完整性
     ──────────────────────────────────────────────────────────────────────────
     • 任务ID唯一性          规则校验               ERROR
     • 被依赖任务存在        规则校验               ERROR  
     • DAG连通性            规则校验               ERROR

  2. 依赖正确性
     ──────────────────────────────────────────────────────────────────────────
     • 循环依赖检测          图遍历算法              ERROR
     • 自依赖检测            规则校验               ERROR
     • 依赖传递性            规则校验               WARN

  3. 并行合法性
     ──────────────────────────────────────────────────────────────────────────
     • 并行组无内部依赖      规则校验               ERROR
     • 并行组无跨组依赖      规则校验               WARN
     • 并行任务类型冲突      规则校验               WARN

  4. 优先级合理性
     ──────────────────────────────────────────────────────────────────────────
     • 依赖优先级顺序        规则校验               WARN
     • 同组优先级一致性      规则校验               INFO

  5. 执行可行性
     ──────────────────────────────────────────────────────────────────────────
     • 参数完整性            Schema校验              ERROR
     • 工具存在性            规则校验               ERROR
     • 资源限制检查          规则校验               WARN
```

### 2.2 验证结果定义

```typescript
interface DAGValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  corrections: DAGCorrection[];
  stats: DAGStats;
}

interface ValidationError {
  type: ValidationErrorType;
  taskId?: string;
  description: string;
  suggestion: string;
}

type ValidationErrorType =
  | 'duplicate_task_id'
  | 'missing_dependency'
  | 'circular_dependency'
  | 'self_dependency'
  | 'parallel_internal_dependency'
  | 'missing_required_param'
  | 'unknown_tool_type';

interface ValidationWarning {
  type: ValidationWarningType;
  taskId?: string;
  description: string;
}

type ValidationWarningType =
  | 'priority_order_violation'
  | 'parallel_cross_group_dependency'
  | 'same_type_parallel_limit'
  | 'excessive_task_count'
  | 'missing_optional_param';

interface DAGCorrection {
  type: 'remove_dependency' | 'adjust_priority' | 'merge_tasks' | 'split_parallel_group';
  taskId: string;
  details: string;
}

interface DAGStats {
  taskCount: number;
  maxDepth: number;
  parallelGroupCount: number;
  avgDependencies: number;
  criticalPathLength: number;
}
```

### 2.3 验证函数实现

```typescript
function validateDAG(plan: TaskPlan): DAGValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const corrections: DAGCorrection[] = [];

  // ==================== 1. 结构完整性检查 ====================

  // 任务ID唯一性
  const taskIdSet = new Set<string>();
  for (const task of plan.tasks) {
    if (taskIdSet.has(task.id)) {
      errors.push({
        type: 'duplicate_task_id',
        taskId: task.id,
        description: `Duplicate task ID: ${task.id}`,
        suggestion: 'Rename duplicate task with unique ID',
      });
    }
    taskIdSet.add(task.id);
  }

  // 被依赖任务存在性
  for (const task of plan.tasks) {
    for (const depId of task.dependencies) {
      if (!taskIdSet.has(depId)) {
        errors.push({
          type: 'missing_dependency',
          taskId: task.id,
          description: `Task ${task.id} depends on non-existent task ${depId}`,
          suggestion: `Remove dependency ${depId} or add the missing task`,
        });
      }
    }
  }

  // ==================== 2. 依赖正确性检查 ====================

  // 自依赖检测
  for (const task of plan.tasks) {
    if (task.dependencies.includes(task.id)) {
      errors.push({
        type: 'self_dependency',
        taskId: task.id,
        description: `Task ${task.id} depends on itself`,
        suggestion: 'Remove self-dependency',
      });
      corrections.push({
        type: 'remove_dependency',
        taskId: task.id,
        details: `Removed self-dependency from ${task.id}`,
      });
    }
  }

  // 循环依赖检测（使用DFS）
  const cycleResult = detectCircularDependencies(plan.tasks);
  if (cycleResult.hasCycle) {
    errors.push({
      type: 'circular_dependency',
      description: `Circular dependency detected: ${cycleResult.cyclePath.join(' -> ')}`,
      suggestion: 'Break the cycle by removing one dependency',
    });
  }

  // ==================== 3. 并行合法性检查 ====================

  for (const group of plan.parallelGroups) {
    // 并行组内部依赖检测
    const groupTaskIds = new Set(group);
    for (const taskId of group) {
      const task = plan.tasks.find(t => t.id === taskId);
      if (task) {
        for (const depId of task.dependencies) {
          if (groupTaskIds.has(depId)) {
            errors.push({
              type: 'parallel_internal_dependency',
              taskId: taskId,
              description: `Parallel group contains internal dependency: ${taskId} depends on ${depId}`,
              suggestion: 'Remove task from parallel group or remove the dependency',
            });
          }
        }
      }
    }
  }

  // 并行组跨组依赖检测（软性规则）
  const allParallelGroupTasks = new Set(plan.parallelGroups.flat());
  for (const task of plan.tasks) {
    if (allParallelGroupTasks.has(task.id)) {
      for (const depId of task.dependencies) {
        for (const group of plan.parallelGroups) {
          if (!group.includes(task.id) && group.includes(depId)) {
            warnings.push({
              type: 'parallel_cross_group_dependency',
              taskId: task.id,
              description: `Task ${task.id} depends on ${depId} from different parallel group`,
            });
          }
        }
      }
    }
  }

  // 同类型并行限制检查
  const typeParallelCounts: Record<string, number> = {};
  for (const group of plan.parallelGroups) {
    for (const taskId of group) {
      const task = plan.tasks.find(t => t.id === taskId);
      if (task) {
        const key = task.type;
        typeParallelCounts[key] = (typeParallelCounts[key] || 0) + 1;
        if (typeParallelCounts[key] > PARALLEL_TYPE_LIMITS[task.type]) {
          warnings.push({
            type: 'same_type_parallel_limit',
            taskId: taskId,
            description: `Too many parallel ${task.type} tasks (limit: ${PARALLEL_TYPE_LIMITS[task.type]})`,
          });
        }
      }
    }
  }

  // ==================== 4. 优先级合理性检查 ====================

  for (const task of plan.tasks) {
    for (const depId of task.dependencies) {
      const depTask = plan.tasks.find(t => t.id === depId);
      if (depTask && depTask.priority >= task.priority) {
        warnings.push({
          type: 'priority_order_violation',
          taskId: task.id,
          description: `Task ${task.id} (priority ${task.priority}) depends on ${depId} (priority ${depTask.priority})`,
        });
        corrections.push({
          type: 'adjust_priority',
          taskId: depId,
          details: `Suggest reducing priority of ${depId} to ${task.priority - 1}`,
        });
      }
    }
  }

  // ==================== 5. 执行可行性检查 ====================

  // 工具类型存在性
  const validToolTypes: AgentActionType[] = [
    'retrieve', 'expand_query', 'evaluate', 'generate_answer',
    'calculate_indicator', 'check_interaction', 'check_contraindication'
  ];
  
  for (const task of plan.tasks) {
    if (!validToolTypes.includes(task.type as AgentActionType)) {
      errors.push({
        type: 'unknown_tool_type',
        taskId: task.id,
        description: `Unknown tool type: ${task.type}`,
        suggestion: `Use one of: ${validToolTypes.join(', ')}`,
      });
    }
  }

  // 参数完整性（Schema校验）
  for (const task of plan.tasks) {
    const requiredParams = TOOL_PARAM_SCHEMA[task.type]?.required || [];
    for (const param of requiredParams) {
      if (task.params[param] === undefined) {
        errors.push({
          type: 'missing_required_param',
          taskId: task.id,
          description: `Task ${task.id} missing required param: ${param}`,
          suggestion: `Add ${param} to task params`,
        });
      }
    }
  }

  // ==================== 统计信息 ====================

  const stats = calculateDAGStats(plan);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    corrections,
    stats,
  };
}
```

### 2.4 循环依赖检测算法（DFS）

```typescript
function detectCircularDependencies(tasks: AgentTask[]): 
    { hasCycle: boolean; cyclePath: string[] } {
  
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const path: string[] = [];

  function dfs(taskId: string): boolean {
    visited.add(taskId);
    recursionStack.add(taskId);
    path.push(taskId);

    const task = tasks.find(t => t.id === taskId);
    if (task) {
      for (const depId of task.dependencies) {
        if (!visited.has(depId)) {
          if (dfs(depId)) return true;
        } else if (recursionStack.has(depId)) {
          // 发现循环
          path.push(depId);
          return true;
        }
      }
    }

    recursionStack.delete(taskId);
    path.pop();
    return false;
  }

  for (const task of tasks) {
    if (!visited.has(task.id)) {
      if (dfs(task.id)) {
        // 提取循环路径
        const cycleStart = path.indexOf(path[path.length - 1]);
        const cyclePath = path.slice(cycleStart);
        return { hasCycle: true, cyclePath };
      }
    }
  }

  return { hasCycle: false, cyclePath: [] };
}
```

### 2.5 DAG 统计计算

```typescript
function calculateDAGStats(plan: TaskPlan): DAGStats {
  const taskCount = plan.tasks.length;
  
  // 计算最大深度（最长路径）
  const depths: Record<string, number> = {};
  
  function getDepth(taskId: string): number {
    if (depths[taskId] !== undefined) return depths[taskId];
    
    const task = plan.tasks.find(t => t.id === taskId);
    if (!task || task.dependencies.length === 0) {
      depths[taskId] = 0;
      return 0;
    }
    
    depths[taskId] = 1 + Math.max(...task.dependencies.map(getDepth));
    return depths[taskId];
  }
  
  plan.tasks.forEach(t => getDepth(t.id));
  const maxDepth = Math.max(...Object.values(depths));

  // 平均依赖数
  const avgDependencies = plan.tasks.reduce(
    (sum, t) => sum + t.dependencies.length, 0
  ) / taskCount;

  // 关键路径长度（最长路径的任务数）
  const criticalPathLength = maxDepth + 1;

  return {
    taskCount,
    maxDepth,
    parallelGroupCount: plan.parallelGroups.length,
    avgDependencies,
    criticalPathLength,
  };
}
```

### 2.6 工具参数 Schema

```typescript
const TOOL_PARAM_SCHEMA: Record<string, { required: string[]; optional: string[] }> = {
  retrieve: { 
    required: ['query'], 
    optional: ['topK', 'threshold', 'domain'] 
  },
  expand_query: { 
    required: ['entities'], 
    optional: [] 
  },
  evaluate: { 
    required: [], 
    optional: ['threshold'] 
  },
  generate_answer: { 
    required: [], 
    optional: ['format', 'mode'] 
  },
  calculate_indicator: { 
    required: ['indicator'], 
    optional: ['value'] 
  },
  check_interaction: { 
    required: ['drugs'], 
    optional: [] 
  },
  check_contraindication: { 
    required: ['drug'], 
    optional: ['condition', 'indicator'] 
  },
};

// 同类型并行限制
const PARALLEL_TYPE_LIMITS: Record<string, number> = {
  retrieve: 3,
  check_interaction: 1,
  check_contraindication: 1,
  calculate_indicator: 2,
  evaluate: 1,
  generate_answer: 1,
};
```

### 2.7 DAG 自动修正

```typescript
function autoCorrectDAG(plan: TaskPlan, validationResult: DAGValidationResult): TaskPlan {
  if (validationResult.valid) return plan;

  let correctedPlan = { 
    ...plan, 
    tasks: [...plan.tasks], 
    parallelGroups: [...plan.parallelGroups] 
  };

  // 处理修正建议
  for (const correction of validationResult.corrections) {
    switch (correction.type) {
      case 'remove_dependency':
        correctedPlan = removeDependency(correctedPlan, correction.taskId);
        break;
      case 'adjust_priority':
        correctedPlan = adjustPriority(correctedPlan, correction.taskId);
        break;
      case 'split_parallel_group':
        correctedPlan = splitParallelGroup(correctedPlan, correction.taskId);
        break;
    }
  }

  // 处理错误级别的修正
  for (const error of validationResult.errors) {
    switch (error.type) {
      case 'duplicate_task_id':
        correctedPlan = renameDuplicateTask(correctedPlan, error.taskId!);
        break;
      case 'self_dependency':
        correctedPlan = removeSelfDependency(correctedPlan, error.taskId!);
        break;
      case 'parallel_internal_dependency':
        correctedPlan = fixParallelInternalDep(correctedPlan, error.taskId!);
        break;
    }
  }

  return correctedPlan;
}

// 具体修正函数
function removeDependency(plan: TaskPlan, taskId: string): TaskPlan {
  const task = plan.tasks.find(t => t.id === taskId);
  if (task) {
    task.dependencies = task.dependencies.filter(d => d !== taskId);
  }
  return plan;
}

function adjustPriority(plan: TaskPlan, taskId: string): TaskPlan {
  const task = plan.tasks.find(t => t.id === taskId);
  if (task) {
    const dependents = plan.tasks.filter(t => t.dependencies.includes(taskId));
    const minDependentPriority = Math.min(...dependents.map(t => t.priority));
    task.priority = minDependentPriority - 1;
  }
  return plan;
}

function fixParallelInternalDep(plan: TaskPlan, taskId: string): TaskPlan {
  plan.parallelGroups = plan.parallelGroups
    .map(group => group.filter(id => id !== taskId))
    .filter(group => group.length > 0);
  return plan;
}

function renameDuplicateTask(plan: TaskPlan, taskId: string): TaskPlan {
  const newId = `${taskId}_${Date.now()}`;
  const task = plan.tasks.find(t => t.id === taskId);
  if (task) {
    task.id = newId;
    plan.tasks.forEach(t => {
      t.dependencies = t.dependencies.map(d => d === taskId ? newId : d);
    });
  }
  return plan;
}
```

### 2.8 验证处理流程

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DAG 验证处理流程                                            │
└─────────────────────────────────────────────────────────────────────────────┘

                    TaskPlan 生成
                        │
                        ▼
              ┌─────────────────────┐
              │  validateDAG()      │
              │                     │
              │  1. 结构完整性       │
              │  2. 循环依赖检测     │
              │  3. 并行合法性       │
              │  4. 优先级合理性     │
              │  5. 执行可行性       │
              └─────────────────────┘
                        │
                        ▼
              ┌─────────────────────┐
              │  验证结果判断        │
              │  errors.length = 0  │
              └─────────────────────┘
                        │
              ┌─────────┴─────────┐
              │                   │
          有错误             无错误
              │                   │
              ▼                   ▼
        ┌─────────────────┐   ┌─────────────────┐
        │  autoCorrectDAG │   │  记录警告日志    │
        │  尝试自动修正    │   │  返回正确DAG    │
        └─────────────────┘   └─────────────────┘
              │                       │
              ▼                       ▼
        ┌─────────────────┐       TaskExecutor
        │  二次验证        │
        │  valid ?         │
        └─────────────────┘
              │
        ┌─────┴─────┐
        │           │
     仍失败      修正成功
        │           │
        ▼           ▼
  ┌─────────────────┐  TaskExecutor
  │  回退到ReAct    │
  │  或报错终止     │
  └─────────────────┘


  错误处理策略:
  ─────────────────────────────────────────────────────────────────────────────

  | 错误类型              | 处理策略          | 回退方案       |
  |----------------------|------------------|----------------|
  | duplicate_task_id   | 自动重命名         | -              |
  | self_dependency     | 自动移除           | -              |
  | circular_dependency | 无法自动修复       | 回退ReAct      |
  | missing_dependency  | 无法自动修复       | 回退ReAct      |
  | unknown_tool_type   | 无法自动修复       | 报错终止       |
  | missing_required_param | 无法自动修复   | 报错终止       |
```

---

## 三、总结：完整 Agent 执行流程

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PlanAndExecute Agent 完整流程                               │
└─────────────────────────────────────────────────────────────────────────────┘

  Query + Entities
         │
         ▼
  ┌─────────────────────┐
  │  复杂度预判断        │  ← 规则+轻量LLM
  │  simple?            │
  └─────────────────────┘
         │
    simple?───────Yes────▶ 直接ReAct执行
         │
        No
         │
         ▼
  ┌─────────────────────┐
  │  意图分析           │  ← INTENT_ANALYSIS_PROMPT
  └─────────────────────┘
         │
         ▼
  ┌─────────────────────┐
  │  模板匹配           │  ← STRUCTURED_TEMPLATES
  │  matched?           │
  └─────────────────────┘
         │
   matched?───────Yes────▶ 使用模板DAG
         │
        No
         │
         ▼
  ┌─────────────────────┐
  │  LLM Planning       │  ← TASK_PLANNER_PROMPT
  └─────────────────────┘
         │
         ▼
  ┌─────────────────────┐
  │  DAG验证            │  ← validateDAG()（纯规则）
  │  valid?             │
  └─────────────────────┘
         │
    valid?───────Yes────▶ TaskExecutor
         │
        No
         │
         ▼
  ┌─────────────────────┐
  │  autoCorrectDAG     │  ← 自动修正
  └─────────────────────┘
         │
         ▼
  ┌─────────────────────┐
  │  二次验证           │
  │  valid?             │
  └─────────────────────┘
         │
    valid?───────Yes────▶ TaskExecutor
         │
        No
         │
         ▼
    回退ReAct 或 报错终止


  TaskExecutor 执行后:
  ─────────────────────────────────────────────────────────────────────────────

                    执行完成
                        │
                        ▼
              ┌─────────────────────┐
              │  结果检查           │  ← evaluateReplanningNeed()
              │  score计算          │
              └─────────────────────┘
                        │
                        ▼
              ┌─────────────────────┐
              │  触发判断           │  ← thresholds对比
              │  trigger?           │
              └─────────────────────┘
                        │
              ┌─────────┴─────────┐
              │                   │
          trigger=true       trigger=false
              │                   │
              ▼                   ▼
        ┌─────────────────┐   ┌─────────────────┐
        │  限制检查        │   │  generate_answer│
        │  allowed?        │   └─────────────────┘
        └─────────────────┘
              │
        ┌─────┴─────┐
        │           │
     allowed     not_allowed
        │           │
        ▼           ▼
  Re-planning   使用当前结果
        │         生成答案
        └──────────▶ 返回TaskExecutor
```

---

## 四、相关文档索引

- [Agent 预研路线分析](./agent-roadmap-analysis.md) - 整体演进规划
- [TaskPlanner Prompt 设计](./agent-taskplanner-prompts.md) - Prompt 详细设计