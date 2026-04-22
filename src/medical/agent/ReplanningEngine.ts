/**
 * Replanning Engine - 重规划引擎
 *
 * 基于阈值的多维度触发判断
 */

import type {
  TaskDAG,
  TaskResult,
  ExecutorState,
  TriggerReason,
  ReplanningDecision,
  AgentTask,
  ReplanningLimits,
} from './ExecutionTypes.js';
import { DEFAULT_REPLANNING_LIMITS } from './ExecutionTypes.js';
import type { MedicalEntities } from '../types.js';

/**
 * 重规划 Prompt 模板
 */
export const REPLANNING_PROMPT = `你是一个医学任务重规划专家。

当前执行结果不满足要求，需要生成补充任务。

## 执行结果摘要
- 已完成任务: {completedTasks}
- 失败任务: {failedTasks}
- 实体覆盖率: {coverage}
- 证据质量评分: {evidenceScore}
- 综合满意度: {compositeScore}

## 触发原因
{triggers}

## 原始查询
{query}

## 实体信息
- 疾病: {diseases}
- 药物: {drugs}
- 指标: {indicators}

## 任务限制
- 最大补充任务数: {maxSupplementalTasks}
- 当前补充任务数: {currentSupplementalTasks}

## 可选补充任务类型
1. **补充检索** - 针对缺失实体的额外检索
2. **重试任务** - 重试失败的关键任务
3. **替代任务** - 使用替代策略完成任务
4. **指南检索** - 添加高质量指南来源

## 输出格式
{
  "supplementalTasks": [
    {
      "id": "sup_task_1",
      "type": "retrieve|retry|alternative",
      "params": { ... },
      "dependencies": ["..."],
      "priority": 1-7,
      "reason": "触发原因说明"
    }
  ],
  "strategy": "补充|重试|替代",
  "estimatedImprovement": 0.1-0.5
}

请根据执行结果输出补充任务列表。`;

/**
 * 评估重规划需求
 */
export function evaluateReplanningNeed(
  state: ExecutorState,
  entities: MedicalEntities,
  limits: ReplanningLimits = DEFAULT_REPLANNING_LIMITS
): ReplanningDecision {
  const triggers: TriggerReason[] = [];
  let urgency: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';

  // 1. 覆盖率检查
  const coverage = calculateCoverage(state, entities);
  if (coverage < 0.8) {
    triggers.push('coverage_threshold');
    if (coverage < 0.5) {
      urgency = 'CRITICAL';
    } else {
      urgency = Math.max(urgency.charCodeAt(0), 'HIGH'.charCodeAt(0)) === urgency.charCodeAt(0) ? urgency : 'HIGH';
    }
  }

  // 2. 关键实体缺失检查
  if (checkCriticalEntityMissing(state, entities)) {
    triggers.push('critical_entity_missing');
    urgency = 'CRITICAL';
  }

  // 3. 证据质量检查
  const evidenceScore = calculateEvidenceScore(state);
  if (evidenceScore < 0.3) {
    triggers.push('evidence_quality');
    urgency = Math.max(urgency.charCodeAt(0), 'MEDIUM'.charCodeAt(0)) === urgency.charCodeAt(0) ? urgency : 'MEDIUM';
  }

  // 4. 执行失败检查
  const failedRatio = calculateFailedRatio(state);
  if (failedRatio > 0.2) {
    triggers.push('execution_failure');
    urgency = Math.max(urgency.charCodeAt(0), 'HIGH'.charCodeAt(0)) === urgency.charCodeAt(0) ? urgency : 'HIGH';
  }

  // 5. 关键任务失败检查
  if (checkCriticalTaskFailure(state)) {
    triggers.push('critical_task_failure');
    urgency = 'CRITICAL';
  }

  // 计算综合评分
  const compositeScore = calculateCompositeScore(state, entities);

  // 检查限制
  const limitResult = checkReplanningLimits(state, limits);

  // 如果触发但达到限制
  if (triggers.length > 0 && limitResult.limitReached) {
    return {
      shouldReplan: false,
      urgency,
      triggers,
      compositeScore,
      supplementalTasks: [],
      limitReached: limitResult.reason,
    };
  }

  // 如果触发且未达限制
  if (triggers.length > 0) {
    // 生成补充任务
    const supplementalTasks = generateSupplementalTasks(state, entities, triggers, limits);

    return {
      shouldReplan: true,
      urgency,
      triggers,
      compositeScore,
      supplementalTasks,
    };
  }

  // 综合评分低于阈值
  if (compositeScore < 0.65 && !limitResult.limitReached) {
    const supplementalTasks = generateSupplementalTasks(state, entities, ['coverage_threshold'], limits);
    return {
      shouldReplan: true,
      urgency: 'MEDIUM',
      triggers: ['coverage_threshold'],
      compositeScore,
      supplementalTasks,
    };
  }

  return {
    shouldReplan: false,
    urgency: 'LOW',
    triggers: [],
    compositeScore,
    supplementalTasks: [],
  };
}

/**
 * 计算实体覆盖率
 */
export function calculateCoverage(state: ExecutorState, entities: MedicalEntities): number {
  const allEntityIds = [
    ...entities.diseases.map(d => d.id),
    ...entities.drugs.map(d => d.id),
    ...entities.indicators.map(i => i.id),
  ];

  if (allEntityIds.length === 0) {
    return 1;
  }

  // 检查检索结果中覆盖的实体
  const coveredEntities = new Set<string>();
  for (const [, result] of state.completed) {
    if (result.success && result.data) {
      // 简化检查：假设检索任务结果包含 entity 字段
      const data = result.data as Record<string, unknown>;
      if (data.entity) {
        coveredEntities.add(data.entity as string);
      }
      // 或者检查任务参数中的实体引用
    }
  }

  // 检查任务参数中的实体引用
  for (const task of state.dag.tasks) {
    if (task.params.entity || task.params.drug || task.params.indicator || task.params.disease) {
      const entityId = task.params.entity || task.params.drug || task.params.indicator || task.params.disease;
      coveredEntities.add(entityId as string);
    }
  }

  return coveredEntities.size / allEntityIds.length;
}

/**
 * 检查关键实体缺失
 */
function checkCriticalEntityMissing(state: ExecutorState, entities: MedicalEntities): boolean {
  // 主焦点实体应该被覆盖
  // 检查是否有失败的检索任务且该实体是主要焦点

  for (const task of state.dag.tasks) {
    if (task.type === 'retrieve' && task.priority === 1) {
      const result = state.completed.get(task.id);
      if (!result || !result.success) {
        // 关键检索任务失败
        return true;
      }
    }
  }

  return false;
}

/**
 * 计算证据质量评分
 */
export function calculateEvidenceScore(state: ExecutorState): number {
  // 基于完成的评估任务计算
  let totalScore = 0;
  let evalCount = 0;

  for (const task of state.dag.tasks) {
    if (task.type === 'evaluate') {
      const result = state.completed.get(task.id);
      if (result?.success && result.data) {
        const data = result.data as Record<string, unknown>;
        if (data.score !== undefined) {
          totalScore += data.score as number;
          evalCount++;
        }
      }
    }
  }

  if (evalCount === 0) {
    // 如果没有评估任务，基于检索结果数量估计
    const retrieveCount = state.dag.tasks.filter(t => t.type === 'retrieve').length;
    const successfulRetrieve = state.dag.tasks
      .filter(t => t.type === 'retrieve')
      .filter(t => state.completed.get(t.id)?.success)
      .length;

    return retrieveCount > 0 ? successfulRetrieve / retrieveCount : 0;
  }

  return totalScore / evalCount;
}

/**
 * 计算失败任务比例
 */
export function calculateFailedRatio(state: ExecutorState): number {
  const totalTasks = state.dag.tasks.length;
  if (totalTasks === 0) {
    return 0;
  }

  return state.failed.length / totalTasks;
}

/**
 * 检查关键任务失败
 */
function checkCriticalTaskFailure(state: ExecutorState): boolean {
  // 关键任务：retrieve 和 check_contraindication
  const criticalTypes = ['retrieve', 'check_contraindication'];

  for (const taskId of state.failed) {
    const task = state.dag.tasks.find(t => t.id === taskId);
    if (task && criticalTypes.includes(task.type)) {
      return true;
    }
  }

  return false;
}

/**
 * 计算综合满意度
 */
export function calculateCompositeScore(state: ExecutorState, entities: MedicalEntities): number {
  const coverage = calculateCoverage(state, entities);
  const evidence = calculateEvidenceScore(state);
  const execution = 1 - calculateFailedRatio(state);

  // 权重：coverage 40%, evidence 25%, execution 15%, answerScore 20%
  // answerScore 简化为：是否有成功的 generate_answer 任务
  let answerScore = 0;
  for (const task of state.dag.tasks) {
    if (task.type === 'generate_answer') {
      const result = state.completed.get(task.id);
      if (result?.success) {
        answerScore = 1;
      }
    }
  }

  const compositeScore =
    coverage * 0.4 +
    evidence * 0.25 +
    execution * 0.15 +
    answerScore * 0.2;

  return compositeScore;
}

/**
 * 检查重规划限制
 */
export function checkReplanningLimits(
  state: ExecutorState,
  limits: ReplanningLimits
): { limitReached: boolean; reason?: string } {
  // 轮数限制
  if (state.currentRound >= limits.maxReplanRounds) {
    return { limitReached: true, reason: `Max replan rounds (${limits.maxReplanRounds}) reached` };
  }

  // 任务数量限制
  const supplementalCount = state.dag.tasks.filter(t => t.id.startsWith('sup_')).length;
  if (supplementalCount >= limits.maxSupplementalTasks) {
    return { limitReached: true, reason: `Max supplemental tasks (${limits.maxSupplementalTasks}) reached` };
  }

  return { limitReached: false };
}

/**
 * 生成补充任务
 */
function generateSupplementalTasks(
  state: ExecutorState,
  entities: MedicalEntities,
  triggers: TriggerReason[],
  limits: ReplanningLimits
): AgentTask[] {
  const tasks: AgentTask[] = [];
  const currentSupplemental = state.dag.tasks.filter(t => t.id.startsWith('sup_')).length;
  const remainingSlots = limits.maxSupplementalTasks - currentSupplemental;

  if (remainingSlots <= 0) {
    return [];
  }

  // 根据触发原因生成任务
  for (const trigger of triggers) {
    switch (trigger) {
      case 'coverage_threshold':
        // 补充缺失实体的检索
        const coveredEntities = getCoveredEntities(state);
        for (const drug of entities.drugs) {
          if (!coveredEntities.has(drug.id) && tasks.length < remainingSlots) {
            tasks.push({
              id: `sup_retrieve_${drug.id}_${Date.now()}`,
              type: 'retrieve',
              params: { query: drug.canonicalName },
              dependencies: [],
              priority: 1,
            });
          }
        }
        break;

      case 'critical_entity_missing':
        // 关键实体检索
        if (tasks.length < remainingSlots) {
          tasks.push({
            id: `sup_critical_retrieve_${Date.now()}`,
            type: 'retrieve',
            params: { query: entities.rawQuery },
            dependencies: [],
            priority: 1,
          });
        }
        break;

      case 'critical_task_failure':
        // 重试关键任务
        for (const taskId of state.failed) {
          const failedTask = state.dag.tasks.find(t => t.id === taskId);
          if (failedTask && failedTask.type === 'retrieve' && tasks.length < remainingSlots) {
            tasks.push({
              id: `sup_retry_${taskId}_${Date.now()}`,
              type: 'retrieve',
              params: failedTask.params,
              dependencies: [],
              priority: 1,
            });
          }
        }
        break;

      case 'evidence_quality':
        // 添加指南检索
        if (tasks.length < remainingSlots) {
          tasks.push({
            id: `sup_guideline_${Date.now()}`,
            type: 'retrieve',
            params: {
              query: `${entities.diseases[0]?.canonicalName || ''}指南 guideline`,
              filters: { sourceType: 'guideline' },
            },
            dependencies: [],
            priority: 2,
          });
        }
        break;

      case 'execution_failure':
        // 一般重试
        for (const taskId of state.failed.slice(0, remainingSlots - tasks.length)) {
          const failedTask = state.dag.tasks.find(t => t.id === taskId);
          if (failedTask) {
            tasks.push({
              id: `sup_retry_${taskId}_${Date.now()}`,
              type: failedTask.type,
              params: failedTask.params,
              dependencies: [],
              priority: failedTask.priority,
            });
          }
        }
        break;
    }
  }

  return tasks.slice(0, remainingSlots);
}

/**
 * 获取已覆盖实体
 */
function getCoveredEntities(state: ExecutorState): Set<string> {
  const covered = new Set<string>();

  for (const task of state.dag.tasks) {
    if (task.params.entity) covered.add(task.params.entity as string);
    if (task.params.drug) covered.add(task.params.drug as string);
    if (task.params.indicator) covered.add(task.params.indicator as string);
    if (task.params.disease) covered.add(task.params.disease as string);
  }

  return covered;
}

/**
 * 创建重规划引擎
 */
export function createReplanningEngine(): {
  evaluate: typeof evaluateReplanningNeed;
  calculateCoverage: typeof calculateCoverage;
  calculateEvidenceScore: typeof calculateEvidenceScore;
  calculateFailedRatio: typeof calculateFailedRatio;
  calculateCompositeScore: typeof calculateCompositeScore;
  checkLimits: typeof checkReplanningLimits;
} {
  return {
    evaluate: evaluateReplanningNeed,
    calculateCoverage,
    calculateEvidenceScore,
    calculateFailedRatio,
    calculateCompositeScore,
    checkLimits: checkReplanningLimits,
  };
}