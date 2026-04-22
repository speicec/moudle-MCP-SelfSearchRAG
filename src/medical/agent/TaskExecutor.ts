/**
 * Task Executor - 任务执行器
 *
 * DAG 执行引擎，支持并行调度和失败重试
 */

import type {
  TaskDAG,
  AgentTask,
  TaskResult,
  ExecutorState,
  FallbackStrategy,
} from './ExecutionTypes.js';
import { PARALLEL_TYPE_LIMITS } from './ExecutionTypes.js';
import type { MedicalEntities, SourceCitation } from '../types.js';
import { createContextManager, ContextManager } from './ContextManager.js';

/**
 * 执行上下文
 */
export interface ExecutionContext {
  retrieval: (query: string, options?: { topK?: number; threshold?: number }) => Promise<Array<{
    content: string;
    source: SourceCitation;
  }>>;
  entities: MedicalEntities;
  query: string;
}

/**
 * 执行配置
 */
export interface ExecutionConfig {
  maxRetries: number;
  retryDelayMs: number;
  enableLogging: boolean;
}

const DEFAULT_EXECUTION_CONFIG: ExecutionConfig = {
  maxRetries: 3,
  retryDelayMs: 1000,
  enableLogging: false,
};

/**
 * 执行 DAG
 */
export async function execute(
  dag: TaskDAG,
  context: ExecutionContext,
  config: ExecutionConfig = DEFAULT_EXECUTION_CONFIG
): Promise<ExecutorState> {
  // 初始化状态
  const initialState: ExecutorState = {
    dag,
    completed: new Map(),
    pending: dag.tasks.map(t => t.id),
    running: [],
    failed: [],
    status: 'initialized',
    startTime: Date.now(),
    currentRound: 0,
    entities: context.entities,
    query: context.query,
    contextEntries: [],
  };

  let state = initialState;
  state = updateExecutorState(state, 'running');

  // DAG 遍历执行
  while (state.pending.length > 0 || state.running.length > 0) {
    // 找到可以执行的任务
    const readyTasks = findReadyTasks(state);

    if (readyTasks.length === 0) {
      // 检查是否有运行中的任务
      if (state.running.length === 0 && state.pending.length > 0) {
        // 有待执行但无就绪任务 - 可能是依赖问题
        if (config.enableLogging) {
          console.log('[TaskExecutor] No ready tasks but pending tasks remain');
        }
        break;
      }
      // 等待运行任务完成
      continue;
    }

    // 分组执行（并行组 vs 串行）
    const parallelGroups = groupTasksForExecution(readyTasks, dag);

    for (const group of parallelGroups) {
      if (group.isParallel) {
        state = await executeParallelGroup(state, group.tasks, context, config);
      } else {
        for (const task of group.tasks) {
          state = await executeTask(state, task, context, config);
        }
      }
    }
  }

  // 完成状态
  state = updateExecutorState(state, state.failed.length > 0 ? 'failed' : 'completed');
  return state;
}

/**
 * 查找就绪任务（依赖已满足）
 */
export function findReadyTasks(state: ExecutorState): AgentTask[] {
  const ready: AgentTask[] = [];

  for (const taskId of state.pending) {
    const task = state.dag.tasks.find(t => t.id === taskId);
    if (!task) continue;

    // 检查依赖是否全部完成
    const dependenciesMet = task.dependencies.every(depId => {
      const result = state.completed.get(depId);
      return result?.success === true;
    });

    if (dependenciesMet) {
      ready.push(task);
    }
  }

  return ready;
}

/**
 * 分组任务用于执行
 */
function groupTasksForExecution(tasks: AgentTask[], dag: TaskDAG): Array<{ isParallel: boolean; tasks: AgentTask[] }> {
  const groups: Array<{ isParallel: boolean; tasks: AgentTask[] }> = [];
  const parallelGroupMap = new Map<string, AgentTask[]>();

  // 按并行组分组
  for (const task of tasks) {
    if (task.parallelGroup) {
      const group = parallelGroupMap.get(task.parallelGroup) || [];
      group.push(task);
      parallelGroupMap.set(task.parallelGroup, group);
    }
  }

  // 处理并行组
  for (const [, groupTasks] of parallelGroupMap) {
    // 应用同类型限制
    const limitedTasks = applyParallelLimits(groupTasks);
    groups.push({ isParallel: true, tasks: limitedTasks });
  }

  // 处理串行任务（无并行组）
  const serialTasks = tasks.filter(t => !t.parallelGroup);
  if (serialTasks.length > 0) {
    groups.push({ isParallel: false, tasks: serialTasks });
  }

  return groups;
}

/**
 * 应用并行限制
 */
function applyParallelLimits(tasks: AgentTask[]): AgentTask[] {
  const typeCounts = new Map<string, number>();
  const result: AgentTask[] = [];

  for (const task of tasks) {
    const currentCount = typeCounts.get(task.type) || 0;
    const limit = PARALLEL_TYPE_LIMITS[task.type];

    if (currentCount < limit) {
      result.push(task);
      typeCounts.set(task.type, currentCount + 1);
    }
  }

  return result;
}

/**
 * 执行并行任务组
 */
async function executeParallelGroup(
  state: ExecutorState,
  tasks: AgentTask[],
  context: ExecutionContext,
  config: ExecutionConfig
): Promise<ExecutorState> {
  // 更新状态为运行
  let newState = state;
  for (const task of tasks) {
    newState = {
      ...newState,
      pending: newState.pending.filter(id => id !== task.id),
      running: [...newState.running, task.id],
    };
  }

  // 并行执行
  const results = await Promise.all(
    tasks.map(task => executeSingleTask(task, context, config))
  );

  // 收集结果
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const result = results[i];
    if (task && result) {
      newState = collectResult(newState, task, result);
    }
  }

  return newState;
}

/**
 * 执行单个任务（带状态更新）
 */
async function executeTask(
  state: ExecutorState,
  task: AgentTask,
  context: ExecutionContext,
  config: ExecutionConfig
): Promise<ExecutorState> {
  // 更新状态为运行
  let newState = {
    ...state,
    pending: state.pending.filter(id => id !== task.id),
    running: [...state.running, task.id],
  };

  // 执行任务
  const result = await executeSingleTask(task, context, config);

  // 收集结果
  newState = collectResult(newState, task, result);

  return newState;
}

/**
 * 执行单个任务（实际执行逻辑）
 */
async function executeSingleTask(
  task: AgentTask,
  context: ExecutionContext,
  config: ExecutionConfig
): Promise<TaskResult> {
  const startTime = Date.now();

  let retries = 0;
  const maxRetries = task.fallbackStrategy?.retryCount ?? config.maxRetries;

  while (retries <= maxRetries) {
    try {
      const data = await executeByType(task, context);

      return {
        taskId: task.id,
        success: true,
        data,
        durationMs: Date.now() - startTime,
        retryCount: retries,
      };
    } catch (error) {
      retries++;

      // 检查回退策略
      if (task.fallbackStrategy) {
        const handledResult = await handleFailure(task, error, context, config);
        if (handledResult) {
          return handledResult;
        }
      }

      // 重试延迟
      if (retries <= maxRetries) {
        await delay(config.retryDelayMs * retries); // 指数退避
      }
    }
  }

  // 所有重试失败
  return {
    taskId: task.id,
    success: false,
    error: `Task failed after ${maxRetries} retries`,
    durationMs: Date.now() - startTime,
    retryCount: maxRetries,
  };
}

/**
 * 按类型执行任务
 */
async function executeByType(
  task: AgentTask,
  context: ExecutionContext
): Promise<unknown> {
  switch (task.type) {
    case 'retrieve':
      return await executeRetrieve(task, context);

    case 'evaluate':
      return await executeEvaluate(task, context);

    case 'calculate_indicator':
      return await executeCalculateIndicator(task, context);

    case 'check_contraindication':
      return await executeCheckContraindication(task, context);

    case 'check_interaction':
      return await executeCheckInteraction(task, context);

    case 'generate_answer':
      return await executeGenerateAnswer(task, context);

    case 'expand_query':
      return await executeExpandQuery(task, context);

    case 'extract_entities':
      return context.entities;

    default:
      throw new Error(`Unknown task type: ${task.type}`);
  }
}

/**
 * 执行检索任务
 */
async function executeRetrieve(
  task: AgentTask,
  context: ExecutionContext
): Promise<{ results: Array<{ content: string; source: SourceCitation }> }> {
  const query = task.params.query as string;
  const topK = task.params.topK;
  const threshold = task.params.threshold;

  const options: { topK?: number; threshold?: number } = {};
  if (topK !== undefined) options.topK = topK as number;
  if (threshold !== undefined) options.threshold = threshold as number;

  const results = await context.retrieval(query, options);
  return { results };
}

/**
 * 执行评估任务
 */
async function executeEvaluate(
  task: AgentTask,
  context: ExecutionContext
): Promise<{ score: number; evaluated: number }> {
  // 简化实现：基于检索结果数量计算
  const results = task.params.results as Array<{ content: string }> | undefined;
  const count = results?.length || 0;

  // 评分逻辑：有结果给基础分数
  const score = count > 0 ? Math.min(1, count / 5) : 0;

  return { score, evaluated: count };
}

/**
 * 执行指标计算任务
 */
async function executeCalculateIndicator(
  task: AgentTask,
  context: ExecutionContext
): Promise<{ indicator: string; value: number; zone: string }> {
  const indicator = task.params.indicator as string;
  const value = task.params.value as number;

  // 简化阈值判断
  let zone = 'normal';
  // 实际应该从实体字典获取阈值
  if (indicator.includes('egfr') || indicator.includes('eGFR')) {
    if (value < 30) zone = 'critical';
    else if (value < 45) zone = 'caution';
  }

  return { indicator, value, zone };
}

/**
 * 执行禁忌检查任务
 */
async function executeCheckContraindication(
  task: AgentTask,
  context: ExecutionContext
): Promise<{ hasContraindication: boolean; severity: string }> {
  // 简化实现：实际应该检索禁忌数据库
  const drug = task.params.drug as string;
  const threshold = task.params.threshold as number | undefined;

  // 基于已知的二甲双胍禁忌逻辑
  if (drug.includes('metformin') || drug.includes('二甲双胍')) {
    if (threshold !== undefined && threshold < 30) {
      return { hasContraindication: true, severity: 'absolute' };
    }
  }

  return { hasContraindication: false, severity: 'none' };
}

/**
 * 执行相互作用检查任务
 */
async function executeCheckInteraction(
  task: AgentTask,
  context: ExecutionContext
): Promise<{ hasInteraction: boolean; severity: string }> {
  const drug1 = task.params.drug1 as string;
  const drug2 = task.params.drug2 as string;

  // 简化实现：实际应该检索相互作用数据库
  return { hasInteraction: false, severity: 'none' };
}

/**
 * 执行答案生成任务
 */
async function executeGenerateAnswer(
  task: AgentTask,
  context: ExecutionContext
): Promise<{ answerGenerated: boolean }> {
  // 简化实现：实际应该调用 LLM
  return { answerGenerated: true };
}

/**
 * 执行查询扩展任务
 */
async function executeExpandQuery(
  task: AgentTask,
  context: ExecutionContext
): Promise<{ expandedQuery: string }> {
  const query = task.params.query as string;
  // 简化实现：添加扩展词
  return { expandedQuery: query + ' extended' };
}

/**
 * 处理失败
 */
async function handleFailure(
  task: AgentTask,
  error: unknown,
  context: ExecutionContext,
  config: ExecutionConfig
): Promise<TaskResult | null> {
  const strategy = task.fallbackStrategy;

  if (!strategy) return null;

  switch (strategy.type) {
    case 'skip':
      return {
        taskId: task.id,
        success: false,
        error: 'Task skipped due to failure',
        durationMs: 0,
      };

    case 'abort':
      throw error; // 抛出异常中止执行

    case 'alternative':
      if (strategy.alternativeTask) {
        // 执行替代任务 - 等待结果
        return await executeSingleTask(strategy.alternativeTask, context, config);
      }
      return null;

    default:
      return null;
  }
}

/**
 * 收集结果
 * 使用不可变状态更新，避免竞态条件
 */
function collectResult(
  state: ExecutorState,
  task: AgentTask,
  result: TaskResult
): ExecutorState {
  // 创建新的 Map 和数组，避免直接修改原对象
  const newCompleted = new Map(state.completed);
  newCompleted.set(task.id, result);

  const newFailed = result.success
    ? state.failed
    : [...state.failed, task.id];

  return {
    ...state,
    completed: newCompleted,
    failed: newFailed,
    running: state.running.filter(id => id !== task.id),
  };
}

/**
 * 更新执行状态
 */
export function updateExecutorState(
  state: ExecutorState,
  status: ExecutorState['status']
): ExecutorState {
  return { ...state, status };
}

/**
 * 追踪进度（日志）
 */
export function trackProgress(state: ExecutorState): string {
  return `[TaskExecutor] Progress: ${state.completed.size}/${state.dag.tasks.length} tasks, ${state.failed.length} failed`;
}

/**
 * 构建执行摘要
 */
export function buildExecutionSummary(state: ExecutorState): {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  parallelTasks: number;
  totalDurationMs: number;
} {
  const parallelTasks = state.dag.tasks.filter(t => t.parallelGroup).length;
  const totalDurationMs = Date.now() - state.startTime;

  let completedDuration = 0;
  for (const [, result] of state.completed) {
    completedDuration += result.durationMs;
  }

  return {
    totalTasks: state.dag.tasks.length,
    completedTasks: state.completed.size,
    failedTasks: state.failed.length,
    parallelTasks,
    totalDurationMs,
  };
}

/**
 * 延迟函数
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 创建任务执行器
 */
export function createTaskExecutor(): {
  execute: typeof execute;
  findReadyTasks: typeof findReadyTasks;
  updateState: typeof updateExecutorState;
  trackProgress: typeof trackProgress;
  buildSummary: typeof buildExecutionSummary;
} {
  return {
    execute,
    findReadyTasks,
    updateState: updateExecutorState,
    trackProgress,
    buildSummary: buildExecutionSummary,
  };
}