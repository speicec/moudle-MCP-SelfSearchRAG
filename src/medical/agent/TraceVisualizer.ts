/**
 * Trace Visualizer - 链路追踪可视化
 *
 * 定义白箱链路追踪类型和追踪收集器
 */

import type { MedicalEntities } from '../types.js';
import type {
  IntentAnalysis,
  ComplexityAssessment,
  TaskDAG,
  ExecutorState,
} from './ExecutionTypes.js';

/**
 * 追踪节点类型
 */
export type TracePhase =
  | 'input'
  | 'entityRecognition'
  | 'complexityAssessment'
  | 'modeSelection'
  | 'planning'
  | 'execution'
  | 'answer';

/**
 * 追踪节点结构
 */
export interface TraceNode {
  phase: TracePhase;
  timestamp: string;
  startTime: number;
  endTime: number;
  durationMs: number;
  input: unknown;
  output: unknown;
  metadata?: Record<string, unknown>;
}

/**
 * 执行追踪数据
 */
export interface ExecutionTrace {
  query: string;
  phases: TraceNode[];
  summary: {
    totalDurationMs: number;
    executionMode: 'react' | 'planning';
    totalTaskCount: number;
    replanningRounds: number;
    llmCallCount: number;
  };
}

/**
 * 链路追踪收集器
 */
export class TraceVisualizer {
  private query: string = '';
  private phases: TraceNode[] = [];
  private currentPhaseStart: number = 0;
  private currentPhaseName: TracePhase | null = null;
  private llmCallCount: number = 0;
  private executionMode: 'react' | 'planning' = 'react';
  private totalTaskCount: number = 0;
  private replanningRounds: number = 0;

  /**
   * 设置查询
   */
  setQuery(query: string): void {
    this.query = query;
  }

  /**
   * 开始阶段
   */
  startPhase(phase: TracePhase): void {
    this.currentPhaseStart = Date.now();
    this.currentPhaseName = phase;
  }

  /**
   * 结束阶段
   */
  endPhase(phase: TracePhase, input: unknown, output: unknown, metadata?: Record<string, unknown>): void {
    const endTime = Date.now();
    const startTime = this.currentPhaseStart;

    // 检查是否使用了 LLM
    if (metadata?.usedLLM === true) {
      this.llmCallCount++;
    }

    const node: TraceNode = {
      phase,
      timestamp: new Date(startTime).toISOString(),
      startTime,
      endTime,
      durationMs: endTime - startTime,
      input,
      output,
    };

    // 仅在存在时添加 metadata
    if (metadata) {
      node.metadata = metadata;
    }

    this.phases.push(node);

    this.currentPhaseStart = 0;
    this.currentPhaseName = null;
  }

  /**
   * 收集输入阶段
   */
  collectInputPhase(query: string): void {
    this.startPhase('input');
    this.endPhase('input', { query }, { query });
  }

  /**
   * 收集实体识别阶段
   */
  collectEntityRecognitionPhase(query: string, entities: MedicalEntities): void {
    this.startPhase('entityRecognition');
    this.endPhase('entityRecognition', { query }, {
      entities,
      recognizer: 'DictionaryMatcher',
    }, {
      diseaseCount: entities.diseases.length,
      drugCount: entities.drugs.length,
      indicatorCount: entities.indicators.length,
    });
  }

  /**
   * 收集复杂度评估阶段
   */
  collectComplexityAssessmentPhase(entities: MedicalEntities, complexity: ComplexityAssessment): void {
    this.startPhase('complexityAssessment');
    this.endPhase('complexityAssessment', { entities }, {
      complexity,
    }, {
      needsPlanning: complexity.needsPlanning,
      level: complexity.level,
    });
  }

  /**
   * 收集模式选择阶段
   */
  collectModeSelectionPhase(
    complexity: ComplexityAssessment,
    mode: 'react' | 'planning',
    reason: string
  ): void {
    this.executionMode = mode;
    this.startPhase('modeSelection');
    this.endPhase('modeSelection', { complexity, enablePlanning: true }, {
      mode,
      reason,
    });
  }

  /**
   * 收集规划阶段
   */
  collectPlanningPhase(
    entities: MedicalEntities,
    intentAnalysis: IntentAnalysis,
    dag: TaskDAG,
    matchedTemplate?: string,
    usedLLM?: boolean
  ): void {
    this.totalTaskCount = dag.tasks.length;
    this.startPhase('planning');
    this.endPhase('planning', { entities, intentAnalysis }, {
      dag,
      intentAnalysis,
      matchedTemplate,
    }, {
      matchedTemplate,
      usedLLM,
    });
  }

  /**
   * 收集执行阶段
   */
  collectExecutionPhase(
    dag: TaskDAG,
    executorState: ExecutorState,
    iterations?: number
  ): void {
    this.startPhase('execution');

    // 计算完成的任务数
    const completedCount = executorState.completed.size;
    const failedCount = executorState.failed.length;

    this.endPhase('execution', { dag }, {
      completedTasks: completedCount,
      failedTasks: failedCount,
      executorState: {
        status: executorState.status,
        currentRound: executorState.currentRound,
      },
    }, {
      completedCount,
      failedCount,
      iterations,
    });
  }

  /**
   * 收集重规划信息
   */
  collectReplanningPhase(round: number): void {
    this.replanningRounds = round;
  }

  /**
   * 收集答案生成阶段
   */
  collectAnswerPhase(
    entities: MedicalEntities,
    retrievalResults: unknown,
    answer: unknown
  ): void {
    this.startPhase('answer');
    this.endPhase('answer', { entities, retrievalResults }, { answer });
  }

  /**
   * 构建追踪数据
   */
  buildTrace(): ExecutionTrace {
    // 计算总耗时
    const firstPhase = this.phases[0];
    const lastPhase = this.phases[this.phases.length - 1];
    const totalDurationMs = lastPhase ? lastPhase.endTime - (firstPhase?.startTime ?? 0) : 0;

    return {
      query: this.query,
      phases: this.phases,
      summary: {
        totalDurationMs,
        executionMode: this.executionMode,
        totalTaskCount: this.totalTaskCount,
        replanningRounds: this.replanningRounds,
        llmCallCount: this.llmCallCount,
      },
    };
  }

  /**
   * 格式化追踪报告（用于 Logger）
   */
  formatTraceReport(): string {
    const trace = this.buildTrace();
    const lines: string[] = [];

    lines.push('## 执行链路追踪报告');
    lines.push('');

    // 概览
    lines.push('### 概览');
    lines.push(`**查询**: "${trace.query}"`);
    lines.push(`**执行模式**: ${trace.summary.executionMode}`);
    lines.push(`**总耗时**: ${trace.summary.totalDurationMs}ms`);
    lines.push(`**任务数**: ${trace.summary.totalTaskCount}`);
    lines.push(`**重规划轮次**: ${trace.summary.replanningRounds}`);
    lines.push(`**LLM 调用**: ${trace.summary.llmCallCount} 次`);
    lines.push('');

    // 各阶段详情
    for (const phase of trace.phases) {
      lines.push(`### Phase: ${phase.phase}`);
      lines.push(`**时间**: ${phase.timestamp}`);
      lines.push(`**耗时**: ${phase.durationMs}ms`);
      lines.push('');

      // 输入
      lines.push('**输入**:');
      lines.push('```json');
      lines.push(JSON.stringify(phase.input, null, 2));
      lines.push('```');
      lines.push('');

      // 输出
      lines.push('**输出**:');
      lines.push('```json');
      lines.push(JSON.stringify(phase.output, null, 2));
      lines.push('```');

      if (phase.metadata) {
        lines.push('');
        lines.push('**元数据**:');
        for (const [key, value] of Object.entries(phase.metadata)) {
          lines.push(`- ${key}: ${value}`);
        }
      }

      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * 格式化简要追踪（用于调试）
   */
  formatBriefTrace(): string {
    const trace = this.buildTrace();
    const lines: string[] = [];

    lines.push(`**执行追踪**: ${trace.summary.executionMode} 模式`);
    lines.push(`**耗时**: ${trace.summary.totalDurationMs}ms`);
    lines.push(`**阶段**: ${trace.phases.map(p => `${p.phase}(${p.durationMs}ms)`).join(' → ')}`);

    return lines.join('\n');
  }
}

/**
 * 创建链路追踪收集器
 */
export function createTraceVisualizer(): TraceVisualizer {
  return new TraceVisualizer();
}