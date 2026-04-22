/**
 * DAG Validator - DAG 验证器
 *
 * 纯规则验证，零 LLM 调用
 */

import type {
  TaskDAG,
  AgentTask,
  AgentActionType,
  DAGValidationError,
  DAGValidationErrorType,
  DAGStats,
} from './ExecutionTypes.js';
import { PARALLEL_TYPE_LIMITS, TOOL_PARAM_SCHEMA } from './ExecutionTypes.js';

/**
 * 验证 DAG
 */
export function validateDAG(dag: TaskDAG): {
  valid: boolean;
  errors: DAGValidationError[];
  warnings: DAGValidationError[];
  stats: DAGStats;
} {
  const errors: DAGValidationError[] = [];
  const warnings: DAGValidationError[] = [];
  const stats = calculateDAGStats(dag);

  // 1. 结构完整性检查
  const duplicateIds = detectDuplicateIds(dag.tasks);
  for (const id of duplicateIds) {
    errors.push({
      type: 'duplicate_task_id',
      taskId: id,
      message: `Duplicate task ID: ${id}`,
      suggestion: 'Rename duplicate task to ensure uniqueness',
      autoCorrectable: true,
    });
  }

  // 2. 依赖存在性检查
  const missingDeps = detectMissingDependencies(dag);
  for (const { taskId, missingDep } of missingDeps) {
    errors.push({
      type: 'missing_dependency',
      taskId,
      message: `Task ${taskId} depends on non-existent task ${missingDep}`,
      suggestion: `Remove dependency or add task ${missingDep}`,
      autoCorrectable: false,
    });
  }

  // 3. 循环依赖检查
  const cycles = detectCircularDependencies(dag);
  for (const cycle of cycles) {
    errors.push({
      type: 'circular_dependency',
      message: `Circular dependency detected`,
      suggestion: 'Remove one of the dependencies to break the cycle',
      autoCorrectable: false,
      cyclePath: cycle,
    });
  }

  // 4. 自依赖检查
  const selfDeps = detectSelfDependencies(dag.tasks);
  for (const taskId of selfDeps) {
    errors.push({
      type: 'self_dependency',
      taskId,
      message: `Task ${taskId} depends on itself`,
      suggestion: 'Remove self-reference from dependencies',
      autoCorrectable: true,
    });
  }

  // 5. 并行组内部依赖检查
  const parallelInternalDeps = detectParallelInternalDependencies(dag);
  for (const { taskId, dependency, group } of parallelInternalDeps) {
    errors.push({
      type: 'parallel_internal_dependency',
      taskId,
      message: `Task ${taskId} in parallel group ${group} depends on ${dependency} in same group`,
      suggestion: 'Remove task from parallel group or remove internal dependency',
      autoCorrectable: true,
    });
  }

  // 6. 同类型并行限制检查（警告）
  const typeLimitWarnings = checkParallelTypeLimits(dag);
  for (const warning of typeLimitWarnings) {
    warnings.push({
      type: 'same_type_parallel_limit',
      message: warning.message,
      suggestion: 'Split parallel group or reduce concurrent tasks',
      autoCorrectable: true,
    });
  }

  // 7. 优先级顺序检查（警告）
  const priorityWarnings = checkPriorityOrder(dag.tasks);
  for (const { taskId, depTaskId } of priorityWarnings) {
    warnings.push({
      type: 'priority_order_violation',
      taskId,
      message: `Task ${taskId} has priority ≤ its dependency ${depTaskId}`,
      suggestion: 'Adjust priority so dependencies have lower priority',
      autoCorrectable: true,
    });
  }

  // 8. 工具类型检查
  const unknownTypes = detectUnknownToolTypes(dag.tasks);
  for (const { taskId, type } of unknownTypes) {
    errors.push({
      type: 'unknown_tool_type',
      taskId,
      message: `Task ${taskId} has unknown type: ${type}`,
      suggestion: `Valid types: ${Object.keys(PARALLEL_TYPE_LIMITS).join(', ')}`,
      autoCorrectable: false,
    });
  }

  // 9. 参数完整性检查
  const missingParams = checkRequiredParams(dag.tasks);
  for (const { taskId, param } of missingParams) {
    errors.push({
      type: 'missing_required_param',
      taskId,
      message: `Task ${taskId} missing required param: ${param}`,
      suggestion: `Add ${param} to task params`,
      autoCorrectable: false,
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stats,
  };
}

/**
 * 检测重复 ID
 */
export function detectDuplicateIds(tasks: AgentTask[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const task of tasks) {
    if (seen.has(task.id)) {
      duplicates.add(task.id);
    }
    seen.add(task.id);
  }

  return Array.from(duplicates);
}

/**
 * 检测缺失的依赖
 */
export function detectMissingDependencies(dag: TaskDAG): Array<{ taskId: string; missingDep: string }> {
  const taskIds = new Set(dag.tasks.map(t => t.id));
  const missing: Array<{ taskId: string; missingDep: string }> = [];

  for (const task of dag.tasks) {
    for (const dep of task.dependencies) {
      if (!taskIds.has(dep)) {
        missing.push({ taskId: task.id, missingDep: dep });
      }
    }
  }

  return missing;
}

/**
 * 检测循环依赖（DFS）
 */
export function detectCircularDependencies(dag: TaskDAG): string[][] {
  const cycles: string[][] = [];
  const taskMap = new Map(dag.tasks.map(t => [t.id, t]));
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function dfs(taskId: string, path: string[]): boolean {
    if (recursionStack.has(taskId)) {
      // 找到循环
      const cycleStart = path.indexOf(taskId);
      cycles.push([...path.slice(cycleStart), taskId]);
      return true;
    }

    if (visited.has(taskId)) {
      return false;
    }

    visited.add(taskId);
    recursionStack.add(taskId);
    path.push(taskId);

    const task = taskMap.get(taskId);
    if (task) {
      for (const dep of task.dependencies) {
        dfs(dep, [...path]);
      }
    }

    recursionStack.delete(taskId);
    return false;
  }

  for (const task of dag.tasks) {
    dfs(task.id, []);
  }

  return cycles;
}

/**
 * 检测自依赖
 */
export function detectSelfDependencies(tasks: AgentTask[]): string[] {
  return tasks
    .filter(task => task.dependencies.includes(task.id))
    .map(task => task.id);
}

/**
 * 检测并行组内部依赖
 */
export function detectParallelInternalDependencies(dag: TaskDAG): Array<{ taskId: string; dependency: string; group: string }> {
  const result: Array<{ taskId: string; dependency: string; group: string }> = [];
  const parallelGroups = new Map<string, AgentTask[]>();

  // 按并行组分组
  for (const task of dag.tasks) {
    if (task.parallelGroup) {
      const group = parallelGroups.get(task.parallelGroup) || [];
      group.push(task);
      parallelGroups.set(task.parallelGroup, group);
    }
  }

  // 检查组内依赖
  for (const [group, tasks] of parallelGroups) {
    const groupTaskIds = new Set(tasks.map(t => t.id));

    for (const task of tasks) {
      for (const dep of task.dependencies) {
        if (groupTaskIds.has(dep)) {
          result.push({
            taskId: task.id,
            dependency: dep,
            group,
          });
        }
      }
    }
  }

  return result;
}

/**
 * 检查并行类型限制
 */
export function checkParallelTypeLimits(dag: TaskDAG): Array<{ group: string; type: AgentActionType; count: number; limit: number; message: string }> {
  const warnings: Array<{ group: string; type: AgentActionType; count: number; limit: number; message: string }> = [];
  const parallelGroups = new Map<string, AgentTask[]>();

  for (const task of dag.tasks) {
    if (task.parallelGroup) {
      const group = parallelGroups.get(task.parallelGroup) || [];
      group.push(task);
      parallelGroups.set(task.parallelGroup, group);
    }
  }

  for (const [group, tasks] of parallelGroups) {
    const typeCounts = new Map<AgentActionType, number>();

    for (const task of tasks) {
      const count = typeCounts.get(task.type) || 0;
      typeCounts.set(task.type, count + 1);
    }

    for (const [type, count] of typeCounts) {
      const limit = PARALLEL_TYPE_LIMITS[type];
      if (count > limit) {
        warnings.push({
          group,
          type,
          count,
          limit,
          message: `Parallel group ${group} has ${count} ${type} tasks (limit: ${limit})`,
        });
      }
    }
  }

  return warnings;
}

/**
 * 检查优先级顺序
 */
export function checkPriorityOrder(tasks: AgentTask[]): Array<{ taskId: string; depTaskId: string }> {
  const warnings: Array<{ taskId: string; depTaskId: string }> = [];
  const taskMap = new Map(tasks.map(t => [t.id, t]));

  for (const task of tasks) {
    for (const depId of task.dependencies) {
      const depTask = taskMap.get(depId);
      if (depTask && depTask.priority >= task.priority) {
        warnings.push({
          taskId: task.id,
          depTaskId: depId,
        });
      }
    }
  }

  return warnings;
}

/**
 * 检测未知工具类型
 */
export function detectUnknownToolTypes(tasks: AgentTask[]): Array<{ taskId: string; type: string }> {
  const validTypes = Object.keys(PARALLEL_TYPE_LIMITS) as AgentActionType[];
  return tasks
    .filter(task => !validTypes.includes(task.type))
    .map(task => ({ taskId: task.id, type: task.type }));
}

/**
 * 检查必填参数
 */
export function checkRequiredParams(tasks: AgentTask[]): Array<{ taskId: string; param: string }> {
  const missing: Array<{ taskId: string; param: string }> = [];

  for (const task of tasks) {
    const schema = TOOL_PARAM_SCHEMA[task.type];
    if (schema) {
      for (const requiredParam of schema.required) {
        if (task.params[requiredParam] === undefined) {
          missing.push({
            taskId: task.id,
            param: requiredParam,
          });
        }
      }
    }
  }

  return missing;
}

/**
 * 计算 DAG 统计信息
 */
export function calculateDAGStats(dag: TaskDAG): DAGStats {
  const taskCount = dag.tasks.length;
  const maxDepth = calculateMaxDepth(dag);
  const parallelGroupCount = dag.parallelGroups.length;

  const typeDistribution: Record<AgentActionType, number> = {
    extract_entities: 0,
    retrieve: 0,
    expand_query: 0,
    evaluate: 0,
    generate_answer: 0,
    calculate_indicator: 0,
    check_interaction: 0,
    check_contraindication: 0,
  };

  for (const task of dag.tasks) {
    if (typeDistribution[task.type] !== undefined) {
      typeDistribution[task.type]++;
    }
  }

  return {
    taskCount,
    maxDepth,
    criticalPathLength: maxDepth + 1,
    parallelGroupCount,
    typeDistribution,
  };
}

/**
 * 计算最大深度
 */
function calculateMaxDepth(dag: TaskDAG): number {
  const taskMap = new Map(dag.tasks.map(t => [t.id, t]));
  const depthCache = new Map<string, number>();

  function getDepth(taskId: string): number {
    if (depthCache.has(taskId)) {
      return depthCache.get(taskId)!;
    }

    const task = taskMap.get(taskId);
    if (!task || task.dependencies.length === 0) {
      depthCache.set(taskId, 0);
      return 0;
    }

    const maxDepDepth = Math.max(
      ...task.dependencies.map(dep => getDepth(dep))
    );
    depthCache.set(taskId, maxDepDepth + 1);
    return maxDepDepth + 1;
  }

  let globalMax = 0;
  for (const task of dag.tasks) {
    globalMax = Math.max(globalMax, getDepth(task.id));
  }

  return globalMax;
}

// ==================== Auto-correction Functions ====================

/**
 * 移除依赖
 */
export function removeDependency(task: AgentTask, depId: string): AgentTask {
  return {
    ...task,
    dependencies: task.dependencies.filter(d => d !== depId),
  };
}

/**
 * 调整优先级
 */
export function adjustPriority(task: AgentTask, newPriority: number): AgentTask {
  return {
    ...task,
    priority: newPriority,
  };
}

/**
 * 修复并行组内部依赖
 */
export function fixParallelInternalDep(task: AgentTask): AgentTask {
  const result: AgentTask = {
    id: task.id,
    type: task.type,
    params: task.params,
    dependencies: task.dependencies,
    priority: task.priority,
  };
  if (task.fallbackStrategy) {
    result.fallbackStrategy = task.fallbackStrategy;
  }
  return result;
}

/**
 * 重命名重复任务
 */
export function renameDuplicateTask(task: AgentTask, newId: string): AgentTask {
  return {
    ...task,
    id: newId,
  };
}

/**
 * 分割并行组
 */
export function splitParallelGroup(dag: TaskDAG, groupId: string): TaskDAG {
  const newGroupId = `${groupId}_split`;
  const updatedTasks = dag.tasks.map(task => {
    if (task.parallelGroup === groupId) {
      const suffix = task.id.slice(-3);
      return {
        ...task,
        parallelGroup: `${newGroupId}_${suffix}`,
      };
    }
    return task;
  });

  const newParallelGroups = dag.parallelGroups.filter(g => g !== groupId);
  // Add new groups for split tasks
  const splitGroupIds = updatedTasks
    .filter(t => t.parallelGroup && t.parallelGroup.startsWith(newGroupId))
    .map(t => t.parallelGroup!);

  return {
    ...dag,
    tasks: updatedTasks,
    parallelGroups: [...newParallelGroups, ...new Set(splitGroupIds)],
  };
}

/**
 * 自动修正 DAG
 */
export function autoCorrectDAG(dag: TaskDAG): {
  correctedDag: TaskDAG;
  appliedCorrections: string[];
  remainingErrors: DAGValidationError[];
} {
  const appliedCorrections: string[] = [];
  let currentDag = dag;
  const remainingErrors: DAGValidationError[] = [];

  // 1. 修正自依赖
  for (const task of currentDag.tasks) {
    if (task.dependencies.includes(task.id)) {
      currentDag = {
        ...currentDag,
        tasks: currentDag.tasks.map(t =>
          t.id === task.id ? removeDependency(t, t.id) : t
        ),
      };
      appliedCorrections.push(`Removed self-dependency from ${task.id}`);
    }
  }

  // 2. 修正优先级顺序
  const taskMap = new Map(currentDag.tasks.map(t => [t.id, t]));
  for (const task of currentDag.tasks) {
    for (const depId of task.dependencies) {
      const depTask = taskMap.get(depId);
      if (depTask && depTask.priority >= task.priority) {
        // 降低依赖任务的优先级
        currentDag = {
          ...currentDag,
          tasks: currentDag.tasks.map(t =>
            t.id === depId ? adjustPriority(t, task.priority - 1) : t
          ),
        };
        appliedCorrections.push(`Adjusted priority of ${depId} to ${task.priority - 1}`);
      }
    }
  }

  // 3. 修正并行组内部依赖
  const internalDeps = detectParallelInternalDependencies(currentDag);
  for (const { taskId } of internalDeps) {
    currentDag = {
      ...currentDag,
      tasks: currentDag.tasks.map(t =>
        t.id === taskId ? fixParallelInternalDep(t) : t
      ),
    };
    appliedCorrections.push(`Removed ${taskId} from parallel group`);
  }

  // 重新验证
  const validation = validateDAG(currentDag);

  // 只保留不可自动修正的错误
  for (const error of validation.errors) {
    if (!error.autoCorrectable) {
      remainingErrors.push(error);
    }
  }

  return {
    correctedDag: currentDag,
    appliedCorrections,
    remainingErrors,
  };
}