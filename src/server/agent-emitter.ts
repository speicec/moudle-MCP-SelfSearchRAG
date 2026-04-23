/**
 * Agent Emitter - Agent 可视化事件发射器
 *
 * 发送 Agent 执行各阶段的 WebSocket 事件
 */

import { WebSocketHandler } from './websocket-handler.js';
import type { PipelineEvent } from './types.js';
import type { MedicalEntities } from '../medical/types.js';
import type {
  ComplexityAssessment,
  TaskDAG,
  ExecutorState,
} from '../medical/agent/ExecutionTypes.js';
import type { TemplateAttempt } from '../medical/agent/RetrievalVisualization.js';
import type { AgentResult } from '../medical/agent/types.js';

/**
 * Query strategy for rewriting (simplified version for events)
 */
export interface AgentQueryStrategy {
  primaryQuery: string;
  expandedTerms: string[];
}

/**
 * AgentEmitter - 发送 Agent 可视化事件
 */
export class AgentEmitter {
  constructor(private wsHandler: WebSocketHandler) {}

  /**
   * 发送基础事件
   */
  private emit(phase: string, data: Record<string, unknown>): void {
    const event: PipelineEvent = {
      type: `agent:${phase}` as PipelineEvent['type'],
      timestamp: Date.now(),
      ...data,
    };
    // Only set agentPhase if phase is valid
    const validPhases = ['input', 'entities', 'complexity', 'mode', 'query_rewrite', 'template', 'dag', 'execution', 'complete'];
    if (validPhases.includes(phase)) {
      (event as { agentPhase: typeof phase }).agentPhase = phase;
    }
    this.wsHandler.broadcast(event);
  }

  /**
   * 发送输入阶段事件
   */
  emitInput(query: string): void {
    this.emit('input', { query });
  }

  /**
   * 发送实体识别事件
   */
  emitEntities(entities: MedicalEntities): void {
    const entityMatches = [];

    // 转换疾病实体
    for (const disease of entities.diseases) {
      entityMatches.push({
        matchedTerm: disease.matchedTerm,
        canonicalName: disease.canonicalName,
        entityType: 'disease',
        confidence: entities.confidence,
      });
    }

    // 转换药物实体
    for (const drug of entities.drugs) {
      entityMatches.push({
        matchedTerm: drug.matchedTerm,
        canonicalName: drug.canonicalName,
        entityType: 'drug',
        confidence: entities.confidence,
      });
    }

    // 转换指标实体
    for (const indicator of entities.indicators) {
      entityMatches.push({
        matchedTerm: indicator.matchedTerm,
        canonicalName: indicator.canonicalName,
        entityType: 'indicator',
        confidence: entities.confidence,
        value: indicator.value,
        unit: indicator.unit,
      });
    }

    this.emit('entities', { entityMatches });
  }

  /**
   * 发送复杂度评估事件
   */
  emitComplexity(complexity: ComplexityAssessment): void {
    this.emit('complexity', {
      complexity: {
        level: complexity.level,
        needsPlanning: complexity.needsPlanning,
        entityCount: complexity.entityCount,
        hasComparison: complexity.hasComparison,
        hasConditions: complexity.hasConditions,
        hasInteraction: complexity.hasInteraction,
        reason: complexity.reason,
      },
    });
  }

  /**
   * 发送模式选择事件
   */
  emitMode(mode: 'react' | 'planning', reason: string, matchedTemplate?: string): void {
    this.emit('mode', {
      executionMode: mode,
      executionReason: reason,
      matchedTemplate,
    });
  }

  /**
   * 发送查询改写事件
   */
  emitQueryRewriting(strategy: AgentQueryStrategy, originalQuery?: string): void {
    this.emit('query_rewrite', {
      queryRewriting: {
        primaryQuery: strategy.primaryQuery,
        expandedTerms: strategy.expandedTerms,
      },
      query: originalQuery,
    });
  }

  /**
   * 发送模板匹配事件
   */
  emitTemplate(attempts: TemplateAttempt[], matchedTemplate?: string): void {
    const templateAttempts = attempts.map((a) => ({
      templateId: a.templateId,
      templateName: a.templateName,
      matched: a.matched,
      rejectionReason: a.rejectionReason,
    }));

    this.emit('template', {
      templateAttempts,
      matchedTemplate,
    });
  }

  /**
   * 发送 DAG 事件 (Planning 模式)
   */
  emitDAG(dag: TaskDAG): void {
    const tasks = dag.tasks.map((t) => ({
      id: t.id,
      type: t.type,
      params: t.params,
      dependencies: t.dependencies,
      priority: t.priority,
    }));

    this.emit('dag', {
      dag: {
        tasks,
        entryTasks: dag.entryTasks,
        exitTasks: dag.exitTasks,
        parallelGroups: dag.parallelGroups,
      },
    });
  }

  /**
   * 发送执行进度事件
   */
  emitExecution(state: ExecutorState): void {
    const completedCount = state.completed.size;
    const failedCount = state.failed.length;
    const runningTasks = Array.from(state.running);

    this.emit('execution', {
      executorState: {
        status: state.status,
        currentRound: state.currentRound,
        completedCount,
        failedCount,
        runningTasks,
      },
    });
  }

  /**
   * 发送完成事件
   */
  emitComplete(result: AgentResult): void {
    this.emit('complete', {
      agentResult: {
        satisfied: result.satisfied,
        retrievalCount: result.visualization?.retrievalResultCount ?? 0,
        totalTimeMs: result.stats.totalTimeMs,
        iterations: result.stats.iterations,
        llmCallCount: result.stats.llmCalls,
      },
    });
  }
}

/**
 * 创建 AgentEmitter
 */
export function createAgentEmitter(wsHandler: WebSocketHandler): AgentEmitter {
  return new AgentEmitter(wsHandler);
}