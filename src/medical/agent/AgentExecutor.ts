/**
 * Agent Executor - Agent 执行器
 *
 * 支持双模式：ReAct 循环 + PlanAndExecute 流程
 */

import type {
  AgentState,
  AgentAction,
  AgentActionType,
  AgentDecision,
  AgentConfig,
  AgentContext,
  Observation,
  AgentResult,
  MedicalAnswer,
  SourceCitation,
} from './types.js';
import type { SafetyAssessment, ExtractedThreshold } from './types.js';
import type { RetrievalVisualization, ExecutionTrace } from './types.js';
import {
  createInitialState,
  setStatus,
  incrementIteration,
  addReasoningStep,
  updateRetrievalResults,
  markSatisfied,
  setAnswer,
  isMaxIterationsReached,
  canContinue,
  serializeState,
} from './AgentState.js';
import type { MedicalEntities, EvidenceEvaluation } from '../types.js';
import { extractThresholds } from '../threshold-extractor.js';
import { performSafetyCheck } from '../safety-layer.js';
import { evaluateMultipleSources, calculateOverallGrade } from '../evidence-evaluator.js';

// Planning mode imports
import type { TaskDAG, ExecutorState, ComplexityLevel, PlanningResult, ReplanningDecision } from './ExecutionTypes.js';
import { plan } from './TaskPlanner.js';
import { execute, buildExecutionSummary } from './TaskExecutor.js';
import { evaluateReplanningNeed, createReplanningEngine } from './ReplanningEngine.js';
import { validateDAG, autoCorrectDAG } from './DAGValidator.js';
import { assessComplexity } from './ComplexityJudge.js';

// Visualization imports
import { AgentLogger, createAgentLogger } from './AgentLogger.js';
import { VisualizationCollector, createVisualizationCollector } from './RetrievalVisualization.js';
import { TraceVisualizer, createTraceVisualizer } from './TraceVisualizer.js';
import type { TemplateAttempt } from './RetrievalVisualization.js';

/**
 * 扩展的 Agent 配置
 */
export interface ExtendedAgentConfig extends AgentConfig {
  enablePlanning?: boolean;
  maxReplanRounds?: number;
  // confidenceThreshold 继承自 AgentConfig，不再重复声明
}

/**
 * Planning 模式执行结果
 */
export interface PlanningModeResult {
  answer: MedicalAnswer;
  dag?: TaskDAG | undefined;
  replanningHistory?: ReplanningDecision[] | undefined;
  complexityLevel?: ComplexityLevel | undefined;
  matchedTemplate?: string | undefined;
  stats: {
    totalTasks: number;
    completedTasks: number;
    failedTasks: number;
    parallelTasks: number;
    totalDurationMs: number;
    llmCallCount: number;
    replanningRounds: number;
  };
  fallbackReason?: string | undefined;
}

/**
 * AgentExecutor - 执行 Agent 循环
 */
export class AgentExecutor {
  private config: ExtendedAgentConfig;
  private context: AgentContext;
  private startTime: number;
  private logger: AgentLogger;
  private collector: VisualizationCollector;
  private tracer: TraceVisualizer;

  constructor(config: ExtendedAgentConfig, context: AgentContext) {
    this.config = config;
    this.context = context;
    this.startTime = 0;
    this.logger = createAgentLogger(config.enableTraceLogging ? 'debug' : 'info');
    this.collector = createVisualizationCollector();
    this.tracer = createTraceVisualizer();
  }

  /**
   * 执行 Agent 循环（支持双模式）
   */
  async run(query: string): Promise<AgentResult> {
    this.startTime = Date.now();

    // 设置查询（用于日志和追踪）
    this.logger.setQuery(query);
    this.tracer.setQuery(query);

    // 收集输入阶段
    this.collector.collectInputPhase(query);
    this.tracer.collectInputPhase(query);

    // 选择执行模式
    const entities = this.context.extractEntities(query);

    // 收集实体识别阶段
    this.collector.collectEntityMatches(entities);
    this.tracer.collectEntityRecognitionPhase(query, entities);

    const mode = this.chooseExecutionMode(entities, query);

    if (mode === 'planning' && this.config.enablePlanning) {
      // 尝试 Planning 模式
      try {
        const planningResult = await this.executePlanningMode(query, entities);
        return this.convertPlanningResult(planningResult, entities);
      } catch (error) {
        // Planning 失败，回退到 ReAct
        this.logger.log(0, 'think', 'Planning mode failed, falling back to ReAct', {
          error: error instanceof Error ? error.message : 'Unknown error',
        }, 'warn');
        return this.executeReactMode(query, entities, `Planning failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // 默认使用 ReAct 模式
    return this.executeReactMode(query, entities);
  }

  /**
   * 选择执行模式
   */
  private chooseExecutionMode(entities: MedicalEntities, query: string): 'react' | 'planning' {
    if (!this.config.enablePlanning) {
      // 收集模式选择阶段（禁用 Planning）
      this.collector.collectModeSelectionPhase('react', 'Planning mode disabled in config');
      this.tracer.collectModeSelectionPhase(
        { level: 'simple', needsPlanning: false, reason: 'Planning disabled', entityCount: 0, hasComparison: false, hasConditions: false, hasInteraction: false },
        'react',
        'Planning mode disabled in config'
      );
      return 'react';
    }

    // 复杂度判断
    const complexity = assessComplexity(entities, query);

    // 收集复杂度评估阶段
    this.collector.collectComplexityPhase(complexity);
    this.tracer.collectComplexityAssessmentPhase(entities, complexity);

    if (!complexity.needsPlanning) {
      // 收集模式选择阶段
      this.collector.collectModeSelectionPhase('react', complexity.reason);
      this.tracer.collectModeSelectionPhase(complexity, 'react', complexity.reason);
      return 'react';
    }

    // 收集模式选择阶段
    this.collector.collectModeSelectionPhase('planning', complexity.reason);
    this.tracer.collectModeSelectionPhase(complexity, 'planning', complexity.reason);

    return 'planning';
  }

  /**
   * 执行 Planning 模式
   */
  private async executePlanningMode(query: string, entities: MedicalEntities): Promise<PlanningModeResult> {
    // 0. 构建优化查询策略（在规划前完成）
    const queryStrategy = this.context.buildQueryStrategy(entities);
    const optimizedQuery = queryStrategy.primaryQuery;

    // 收集查询重写
    this.collector.collectQueryRewriting(queryStrategy);

    this.logger.log(0, 'think', 'Query optimization', {
      originalQuery: query,
      optimizedQuery,
      expandedTerms: queryStrategy.expandedTerms,
    });

    // 1. 规划（传递优化查询策略）
    const planningResult = await plan(entities, query, {
      llmCall: async (prompt: string) => {
        // 使用优化查询生成基础 DAG
        return JSON.stringify({
          tasks: [
            { id: 'retrieve_1', type: 'retrieve', params: { query: optimizedQuery }, dependencies: [], priority: 1 },
            { id: 'evaluate_1', type: 'evaluate', params: {}, dependencies: ['retrieve_1'], priority: 4 },
            { id: 'answer', type: 'generate_answer', params: {}, dependencies: ['evaluate_1'], priority: 7 },
          ],
          parallelGroups: [],
        });
      },
      enableLLMFallback: true,
      queryStrategy, // 传递优化查询策略给模板
    });

    if (!planningResult.success || !planningResult.dag) {
      throw new Error(planningResult.validationErrors?.join(', ') || 'Planning failed');
    }

    // 收集规划阶段
    this.tracer.collectPlanningPhase(
      entities,
      planningResult.intentAnalysis,
      planningResult.dag,
      planningResult.matchedTemplate,
      planningResult.usedLLM
    );

    // 收集模板匹配阶段
    const templateAttempts: TemplateAttempt[] = planningResult.templateAttempts?.map(a => ({
      templateId: a.templateId,
      templateName: a.templateName,
      matched: a.matched,
      rejectionReason: a.rejectionReason,
    })) ?? [];
    this.collector.collectTemplatePhase(templateAttempts, planningResult.matchedTemplate);

    // 2. 验证 DAG
    const validation = validateDAG(planningResult.dag);
    let dag = planningResult.dag;

    if (!validation.valid) {
      const correction = autoCorrectDAG(dag);
      if (correction.remainingErrors.length > 0) {
        throw new Error(`DAG validation failed: ${correction.remainingErrors.map(e => e.message).join(', ')}`);
      }
      dag = correction.correctedDag;
    }

    // 收集 DAG 阶段
    this.collector.collectDAGPhase(dag);

    // 3. 执行 DAG（支持重规划）
    const replanningHistory: ReplanningDecision[] = [];
    const maxRounds = this.config.maxReplanRounds ?? 2;
    let currentRound = 0;

    const executionContext = {
      retrieval: this.context.retrieval,
      entities,
      query,
    };

    let executorState = await execute(dag, executionContext);

    // 收集执行阶段
    this.collector.collectExecutionPhase(executorState);
    this.tracer.collectExecutionPhase(dag, executorState);

    // 4. 重规划循环
    while (currentRound < maxRounds) {
      const replanDecision = evaluateReplanningNeed(executorState, entities);

      if (!replanDecision.shouldReplan) {
        break;
      }

      replanningHistory.push(replanDecision);
      this.tracer.collectReplanningPhase(currentRound + 1);

      // 添加补充任务到 DAG
      if (replanDecision.supplementalTasks.length > 0) {
        dag = {
          ...dag,
          tasks: [...dag.tasks, ...replanDecision.supplementalTasks],
          entryTasks: [...dag.entryTasks, ...replanDecision.supplementalTasks.map(t => t.id)],
        };

        // 执行补充任务
        executorState = await execute(dag, executionContext);
        this.collector.collectExecutionPhase(executorState);
      }

      currentRound++;
      executorState = { ...executorState, currentRound };
    }

    // 5. 生成答案
    const answer = await this.generateAnswerFromState(executorState, entities);

    // 收集答案阶段
    this.collector.collectAnswerPhase(answer);
    this.tracer.collectAnswerPhase(entities, executorState, answer);

    // 6. 构建统计
    const summary = buildExecutionSummary(executorState);

    return {
      answer,
      dag,
      replanningHistory,
      complexityLevel: planningResult.complexityLevel ?? undefined,
      matchedTemplate: planningResult.matchedTemplate ?? undefined,
      stats: {
        ...summary,
        llmCallCount: planningResult.usedLLM ? 1 : 0,
        replanningRounds: currentRound,
      },
    };
  }

  /**
   * 执行 ReAct 模式
   */
  private async executeReactMode(query: string, entities: MedicalEntities, fallbackReason?: string): Promise<AgentResult> {
    // 1. 初始化状态
    let state = createInitialState(query, entities, this.config.maxIterations);

    // 1.1 提取阈值条件（用于安全预检查）
    const thresholds: ExtractedThreshold[] = extractThresholds(query);
    state.thresholds = thresholds;

    // 1.2 执行安全预检查
    const safetyAssessment: SafetyAssessment = performSafetyCheck(entities, thresholds);
    state.safetyAssessment = safetyAssessment;

    this.logger.log(0, 'think', 'Safety assessment', {
      severity: safetyAssessment.severity,
      hasContraindications: safetyAssessment.contraindicationMatches.length > 0,
      hasInteractions: safetyAssessment.interactions.length > 0,
    });

    // 2. 主循环
    while (canContinue(state)) {
      state = incrementIteration(state);

      // Think: 分析当前状态
      state = setStatus(state, 'thinking');
      const decision = await this.think(state);
      this.logger.logThink(state, decision);

      // 检查是否应该停止
      if (decision.action === 'stop' || decision.needsMoreInfo === false && decision.confidence >= this.config.confidenceThreshold) {
        state = markSatisfied(state, true);
        break;
      }

      // Act: 执行动作
      state = setStatus(state, 'acting');
      const action = this.decideAction(decision, state);
      const observation = await this.executeAction(action, state);
      this.logger.logAct(state, action);

      // Observe: 记录观察
      state = setStatus(state, 'observing');
      state = addReasoningStep(state, action, observation, decision);
      this.logger.logObserve(state, observation);

      // 更新状态
      if (observation.success && observation.type === 'retrieval') {
        const retrievalData = observation.data as Array<{
          content: string;
          source: SourceCitation;
        }>;
        state = updateRetrievalResults(state, retrievalData);

        // 证据质量评估
        const evidenceEval: EvidenceEvaluation[] = evaluateMultipleSources(
          retrievalData.map(r => r.source)
        );
        state.evidenceEvaluation = evidenceEval;

        const overallGrade = calculateOverallGrade(evidenceEval);
        this.logger.log(state.iteration, 'observe', 'Evidence evaluation', {
          overallGrade,
          evaluatedSources: evidenceEval.length,
        });
      }

      // Decide: 判断是否满足
      state = setStatus(state, 'deciding');
      const satisfied = await this.decide(state);
      state = markSatisfied(state, satisfied);
      this.logger.logDecide(state, satisfied);

      this.logger.log(state.iteration, 'decide', 'Iteration summary', {
        action: action.type,
        satisfied,
        confidence: decision.confidence,
      });

      // 检查最大迭代
      if (isMaxIterationsReached(state)) {
        this.logger.log(state.iteration, 'complete', 'Max iterations reached', {}, 'warn');
        break;
      }
    }

    // 3. 生成回答
    state = setStatus(state, 'answering');
    const answer = await this.generateAnswer(state);
    state = setAnswer(state, answer);
    this.logger.logAnswer(state);

    // 4. 质量检查（可选）
    if (this.config.enableQualityCheck && this.context.reasoner.checkQuality) {
      const qualityResult = await this.context.reasoner.checkQuality(answer);
      if (!qualityResult.isValid) {
        this.logger.log(state.iteration, 'answer', 'Quality issues detected', {
          issues: qualityResult.issues,
        }, 'warn');
      }
    }

    // 5. 完成
    state = setStatus(state, 'completed');
    this.logger.logComplete(state);

    const result = this.buildResult(state);
    if (fallbackReason) {
      result.fallbackReason = fallbackReason;
    }

    // 添加可视化数据到结果
    result.visualization = this.collector.buildVisualization();
    result.executionTrace = this.tracer.buildTrace();

    return result;
  }

  /**
   * 从执行状态生成答案
   */
  private async generateAnswerFromState(executorState: ExecutorState, entities: MedicalEntities): Promise<MedicalAnswer> {
    // 从完成的任务中收集检索结果
    const retrievalResults: Array<{ content: string; source: SourceCitation }> = [];

    for (const task of executorState.dag.tasks) {
      if (task.type === 'retrieve') {
        const result = executorState.completed.get(task.id);
        if (result?.success && result.data) {
          const data = result.data as { results?: Array<{ content: string; source: SourceCitation }> };
          if (data.results) {
            retrievalResults.push(...data.results);
          }
        }
      }
    }

    // 使用现有的答案生成器
    return await this.context.reasoner.generateAnswer(
      entities,
      retrievalResults,
      performSafetyCheck(entities, []),
      [],
    );
  }

  /**
   * 转换 Planning 结果为 Agent 结果
   */
  private convertPlanningResult(planningResult: PlanningModeResult, entities: MedicalEntities): AgentResult {
    const result: AgentResult = {
      answer: planningResult.answer,
      entities,
      stats: {
        iterations: 0,
        actionsExecuted: planningResult.stats.totalTasks,
        retrievalCalls: planningResult.stats.totalTasks,
        llmCalls: planningResult.stats.llmCallCount,
        totalTimeMs: planningResult.stats.totalDurationMs,
      },
      reasoningTrace: [],
      success: planningResult.stats.failedTasks === 0,
      satisfied: true,
    };

    // 添加额外信息（使用扩展字段）
    (result as AgentResult & { planningInfo?: PlanningModeResult }).planningInfo = planningResult;

    // 添加可视化数据
    result.visualization = this.collector.buildVisualization();
    result.executionTrace = this.tracer.buildTrace();

    return result;
  }

  /**
   * Think: 分析状态并决策
   */
  private async think(state: AgentState): Promise<AgentDecision> {
    return await this.context.reasoner.reasonClinical(state);
  }

  /**
   * Decide: 判断是否满足
   */
  private async decide(state: AgentState): Promise<boolean> {
    // 如果没有检索结果，不满足
    if (!state.retrievalResults || state.retrievalResults.length === 0) {
      return false;
    }

    // 使用 LLM 判断
    return await this.context.reasoner.decide(state);
  }

  /**
   * 根据决策选择动作
   */
  private decideAction(decision: AgentDecision, state: AgentState): AgentAction {
    // 如果没有检索结果，执行检索
    if (!state.retrievalResults || state.retrievalResults.length === 0) {
      return {
        type: 'retrieve',
        reason: '首次检索，获取相关文档',
      };
    }

    // 根据决策选择动作
    const actionType: AgentActionType = decision.action === 'stop'
      ? 'generate_answer'
      : (decision.action as AgentActionType);

    const action: AgentAction = {
      type: actionType,
      reason: decision.reason,
    };
    if (actionType === 'retrieve') {
      action.params = { query: this.buildQuery(state.entities) };
    }
    return action;
  }

  /**
   * Execute: 执行动作
   */
  private async executeAction(action: AgentAction, state: AgentState): Promise<Observation> {
    try {
      switch (action.type) {
        case 'retrieve':
          return await this.executeRetrieve(state);

        case 'expand_query':
          return await this.executeExpandQuery(state);

        case 'evaluate':
          return await this.executeEvaluate(state);

        case 'generate_answer':
          return await this.executeGenerateAnswer(state);

        case 'extract_entities':
          return this.executeExtractEntities(state);

        default:
          return {
            type: 'retrieval',
            data: null,
            success: false,
            message: `Unknown action type: ${action.type}`,
          };
      }
    } catch (error) {
      return {
        type: 'retrieval',
        data: null,
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 执行检索
   */
  private async executeRetrieve(state: AgentState): Promise<Observation> {
    const query = this.buildQuery(state.entities);
    const results = await this.context.retrieval(query, {
      topK: this.config.retrievalTopK,
      threshold: this.config.retrievalThreshold,
    });

    return {
      type: 'retrieval',
      data: results,
      success: results.length > 0,
      message: results.length > 0
        ? `找到 ${results.length} 个相关文档`
        : '未找到相关文档',
    };
  }

  /**
   * 执行查询扩展
   */
  private async executeExpandQuery(state: AgentState): Promise<Observation> {
    const strategy = this.context.buildQueryStrategy(state.entities);
    const expandedQuery = strategy.expandedTerms.join(' ');

    const results = await this.context.retrieval(expandedQuery, {
      topK: this.config.retrievalTopK,
      threshold: this.config.retrievalThreshold,
    });

    return {
      type: 'retrieval',
      data: results,
      success: results.length > 0,
      message: `使用扩展查询找到 ${results.length} 个文档`,
    };
  }

  /**
   * 执行评估
   */
  private async executeEvaluate(state: AgentState): Promise<Observation> {
    // 简化的评估逻辑
    const hasGoodResults = state.retrievalResults?.some(r => r.similarityScore && r.similarityScore > 0.7);

    return {
      type: 'evaluation',
      data: { hasGoodResults },
      success: hasGoodResults ?? false,
      message: hasGoodResults ? '存在高质量检索结果' : '检索结果质量较低',
    };
  }

  /**
   * 执行回答生成
   */
  private async executeGenerateAnswer(state: AgentState): Promise<Observation> {
    const answer = await this.context.reasoner.generateAnswer(
      state.entities,
      state.retrievalResults,
      state.safetyAssessment,
      state.evidenceEvaluation,
    );

    return {
      type: 'answer',
      data: answer,
      success: true,
      message: '成功生成回答',
    };
  }

  /**
   * 执行实体提取
   */
  private executeExtractEntities(state: AgentState): Observation {
    const entities = this.context.extractEntities(state.query);

    return {
      type: 'entity',
      data: entities,
      success: entities.confidence > 0.5,
      message: `识别到 ${entities.diseases.length + entities.drugs.length + entities.indicators.length} 个实体`,
    };
  }

  /**
   * 构建检索查询
   */
  private buildQuery(entities: MedicalEntities): string {
    const strategy = this.context.buildQueryStrategy(entities);
    return strategy.primaryQuery;
  }

  /**
   * 生成最终回答
   */
  private async generateAnswer(state: AgentState): Promise<MedicalAnswer> {
    return await this.context.reasoner.generateAnswer(
      state.entities,
      state.retrievalResults,
      state.safetyAssessment,
      state.evidenceEvaluation,
    );
  }

  /**
   * 构建结果
   */
  private buildResult(state: AgentState): AgentResult {
    const result: AgentResult = {
      answer: state.answer!,
      entities: state.entities,
      stats: {
        iterations: state.iteration,
        actionsExecuted: state.reasoningTrace.length,
        retrievalCalls: state.reasoningTrace.filter(s => s.action.type === 'retrieve').length,
        llmCalls: state.reasoningTrace.filter(s => s.decision !== undefined).length,
        totalTimeMs: Date.now() - this.startTime,
      },
      reasoningTrace: state.reasoningTrace,
      success: state.status === 'completed' && state.answer !== undefined,
      satisfied: state.satisfied,
    };
    if (state.retrievalResults !== undefined) {
      result.retrievalResults = state.retrievalResults;
    }
    if (state.error !== undefined) {
      result.error = state.error;
    }
    return result;
  }
}

/**
 * 创建 AgentExecutor
 */
export function createAgentExecutor(config: ExtendedAgentConfig, context: AgentContext): AgentExecutor {
  return new AgentExecutor(config, context);
}