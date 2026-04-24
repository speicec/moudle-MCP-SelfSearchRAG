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
import {
  evaluateMultipleSources,
  evaluateMultipleSourcesEnhanced,
  sortEvidenceByQuality,
  calculateOverallGrade,
} from '../evidence-evaluator.js';

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

// Tracing imports (新增)
import { createTraceStorage, TraceStorage } from '../../tracing/TraceStorage.js';
import type { TraceContextData, RetrievedChunk } from '../../tracing/types.js';

/**
 * 规则化决策阈值配置
 */
export interface RuleThresholds {
  /** 最小检索结果数量触发满足（默认 3） */
  minRetrievalCount: number;
  /** 最小相似度阈值触发满足（默认 0.7） */
  minSimilarityScore: number;
  /** 最小实体覆盖率触发满足（默认 0.8） */
  minEntityCoverage: number;
}

/**
 * 默认规则阈值
 */
export const DEFAULT_RULE_THRESHOLDS: RuleThresholds = {
  minRetrievalCount: 3,
  minSimilarityScore: 0.7,
  minEntityCoverage: 0.8,
};

/**
 * 规则命中类型
 */
export type RuleHitType =
  | 'retrieval_count'
  | 'high_similarity'
  | 'entity_coverage'
  | 'absolute_contraindication'
  | 'none';

/**
 * 规则命中记录
 */
export interface RuleHitRecord {
  ruleType: RuleHitType;
  threshold: number;
  actualValue: number;
  timestamp: number;
}

/**
 * 扩展的 Agent 配置
 */
export interface ExtendedAgentConfig extends AgentConfig {
  enablePlanning?: boolean;
  maxReplanRounds?: number;
  // confidenceThreshold 继承自 AgentConfig，不再重复声明

  // 低置信度直接检索阈值（默认 0.3）
  lowConfidenceThreshold?: number;

  // 规则化决策配置
  useRuleBasedDecide?: boolean;  // 是否使用规则化决策（默认 true）
  ruleThresholds?: RuleThresholds;  // 自定义规则阈值
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
  private visualizationCallback?: (phase: string, data: unknown) => void;
  private ruleThresholds: RuleThresholds;
  private ruleHits: RuleHitRecord[];  // 记录规则命中
  private traceStorage?: TraceStorage;  // 新增: 追踪存储（可选）

  constructor(config: ExtendedAgentConfig, context: AgentContext, visualizationCallback?: (phase: string, data: unknown) => void) {
    this.config = config;
    this.context = context;
    this.startTime = 0;
    this.logger = createAgentLogger(config.enableTraceLogging ? 'debug' : 'info');
    this.collector = createVisualizationCollector();
    this.tracer = createTraceVisualizer();
    this.ruleThresholds = config.ruleThresholds ?? DEFAULT_RULE_THRESHOLDS;
    this.ruleHits = [];
    if (visualizationCallback !== undefined) {
      this.visualizationCallback = visualizationCallback;
    }
  }

  /**
   * 初始化追踪存储 (新增)
   */
  async initTraceStorage(dbPath?: string): Promise<void> {
    this.traceStorage = await createTraceStorage(dbPath);
  }

  /**
   * 持久化追踪数据 (新增)
   */
  async persistTrace(): Promise<void> {
    if (!this.traceStorage) return;
    const traceContext = this.tracer.getTraceContext();
    if (traceContext) {
      const traceData = traceContext.build();
      await this.traceStorage.saveTrace(traceData);
    }
  }

  /**
   * 获取低置信度阈值（带默认值）
   */
  private getLowConfidenceThreshold(): number {
    const threshold = this.config.lowConfidenceThreshold ?? 0.3;
    // 验证阈值范围 [0, 1]
    if (threshold < 0 || threshold > 1) {
      return 0.3; // 无效值使用默认
    }
    return threshold;
  }

  /**
   * 设置可视化回调
   */
  setVisualizationCallback(cb: (phase: string, data: unknown) => void): void {
    this.visualizationCallback = cb;
  }

  /**
   * 执行 Agent 循环（支持双模式）
   */
  async run(query: string): Promise<AgentResult> {
    this.startTime = Date.now();

    // 创建 TraceContext (新增)
    this.tracer.createTraceContext();

    // 设置查询（用于日志和追踪）
    this.logger.setQuery(query);
    this.tracer.setQuery(query);

    // 收集输入阶段
    this.collector.collectInputPhase(query);
    this.tracer.collectInputPhase(query);
    this.visualizationCallback?.('input', { query });

    // 选择执行模式
    const entities = this.context.extractEntities(query);

    // 收集实体识别阶段
    this.collector.collectEntityMatches(entities);
    this.tracer.collectEntityRecognitionPhase(query, entities);
    this.visualizationCallback?.('entities', entities);

    // 智能判断：低置信度时跳过 Agent 循环，直接检索
    const lowConfidenceThreshold = this.getLowConfidenceThreshold();
    if (entities.confidence < lowConfidenceThreshold) {
      // 收集模式选择阶段
      this.collector.collectModeSelectionPhase('direct_retrieval', `Low confidence (${entities.confidence}) < threshold (${lowConfidenceThreshold})`);
      this.tracer.collectModeSelectionPhase(
        { level: 'simple', needsPlanning: false, reason: 'Low confidence', entityCount: 0, hasComparison: false, hasConditions: false, hasInteraction: false },
        'direct_retrieval',
        `Low confidence (${entities.confidence}) < threshold (${lowConfidenceThreshold})`
      );
      this.visualizationCallback?.('mode', {
        mode: 'direct_retrieval',
        reason: `Low confidence (${entities.confidence.toFixed(2)}) < threshold (${lowConfidenceThreshold.toFixed(2)})`,
      });

      return this.executeDirectRetrieval(query, entities);
    }

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
      this.visualizationCallback?.('mode', { mode: 'react', reason: 'Planning mode disabled in config' });
      return 'react';
    }

    // 复杂度判断
    const complexity = assessComplexity(entities, query);

    // 收集复杂度评估阶段
    this.collector.collectComplexityPhase(complexity);
    this.tracer.collectComplexityAssessmentPhase(entities, complexity);
    this.visualizationCallback?.('complexity', complexity);

    if (!complexity.needsPlanning) {
      // 收集模式选择阶段
      this.collector.collectModeSelectionPhase('react', complexity.reason);
      this.tracer.collectModeSelectionPhase(complexity, 'react', complexity.reason);
      this.visualizationCallback?.('mode', { mode: 'react', reason: complexity.reason });
      return 'react';
    }

    // 收集模式选择阶段
    this.collector.collectModeSelectionPhase('planning', complexity.reason);
    this.tracer.collectModeSelectionPhase(complexity, 'planning', complexity.reason);
    this.visualizationCallback?.('mode', { mode: 'planning', reason: complexity.reason });

    return 'planning';
  }

  /**
   * 执行 Planning 模式
   */
  private async executePlanningMode(query: string, entities: MedicalEntities): Promise<PlanningModeResult> {
    // 关键修复：在规划前调用 buildQueryStrategy() 优化检索查询
    // 原因：之前的实现使用硬编码的假LLM，直接返回原始query作为检索参数
    // 修复：使用 query-planner 构建优化策略，确保所有retrieve任务使用优化后的查询词
    const queryStrategy = this.context.buildQueryStrategy(entities);
    const optimizedQuery = queryStrategy.primaryQuery;

    // 收集查询重写
    this.collector.collectQueryRewriting(queryStrategy);
    this.visualizationCallback?.('query_rewrite', { primaryQuery: optimizedQuery, expandedTerms: queryStrategy.expandedTerms });

    this.logger.log(0, 'think', 'Query optimization', {
      originalQuery: query,
      optimizedQuery,
      expandedTerms: queryStrategy.expandedTerms,
    });

    // 1. 规划（传递优化查询策略）
    // 关键修改：将优化后的查询传递给 plan() 和模板 DAG 生成器
    // 所有 retrieve 任务现在使用 optimizedQuery，而非原始 query
    const planningResult = await plan(entities, query, {
      llmCall: async (prompt: string) => {
        // 假LLM实现：使用优化查询生成基础 DAG（确保检索任务使用优化词）
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
      queryStrategy, // 传递优化查询策略给模板生成器，确保模板DAG也使用优化查询
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
    // 新增：记录模板匹配尝试过程（包括成功和失败的），用于可视化输出
    // 用户可看到每个模板的匹配结果和拒绝原因
    const templateAttempts: TemplateAttempt[] = planningResult.templateAttempts?.map(a => ({
      templateId: a.templateId,
      templateName: a.templateName,
      matched: a.matched,
      rejectionReason: a.rejectionReason,
    })) ?? [];
    this.collector.collectTemplatePhase(templateAttempts, planningResult.matchedTemplate);
    this.visualizationCallback?.('template', { attempts: templateAttempts, matched: planningResult.matchedTemplate });

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
    this.visualizationCallback?.('dag', dag);

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
    this.visualizationCallback?.('execution', executorState);

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
        this.visualizationCallback?.('execution', executorState);
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
    // 0. 构建查询策略（在循环前完成）
    const queryStrategy = this.context.buildQueryStrategy(entities);
    this.collector.collectQueryRewriting(queryStrategy);
    this.visualizationCallback?.('query_rewrite', {
      primaryQuery: queryStrategy.primaryQuery,
      expandedTerms: queryStrategy.expandedTerms
    });

    this.logger.log(0, 'think', 'Query strategy built for ReAct', {
      primaryQuery: queryStrategy.primaryQuery,
      expandedTerms: queryStrategy.expandedTerms,
    });

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

    // 1.3 Early Termination: 绝对禁忌直接跳过循环
    if (safetyAssessment.severity === 'absolute') {
      this.logger.log(0, 'early_termination', 'Absolute contraindication detected, skipping ReAct loop', {
        contraindicationCount: safetyAssessment.contraindicationMatches.length,
        recommendation: safetyAssessment.recommendation,
      });

      // 收集早期终止事件
      this.collector.collectModeSelectionPhase('early_termination', 'Absolute contraindication detected');
      this.visualizationCallback?.('early_termination', {
        reason: 'absolute_contraindication',
        safetyAssessment: {
          severity: safetyAssessment.severity,
          contraindicationCount: safetyAssessment.contraindicationMatches.length,
          recommendation: safetyAssessment.recommendation,
        },
      });

      // 直接生成回答
      const answer = this.generateAnswerFromSafety(entities, safetyAssessment);
      state = setAnswer(state, answer);
      state = markSatisfied(state, true);
      state = setStatus(state, 'completed');

      this.logger.logComplete(state);

      const result: AgentResult = {
        answer,
        entities,
        stats: {
          iterations: 0,
          actionsExecuted: 0,
          retrievalCalls: 0,
          llmCalls: 0,  // 无 LLM 调用
          totalTimeMs: Date.now() - this.startTime,
        },
        reasoningTrace: [],
        success: true,
        satisfied: true,
        visualization: this.collector.buildVisualization(),
        executionTrace: this.tracer.buildTrace(),
      };

      this.visualizationCallback?.('complete', result);
      return result;
    }

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

        // 证据质量评估（增强版）
        const evidenceEval: EvidenceEvaluation[] = evaluateMultipleSourcesEnhanced(
          retrievalData.map(r => ({
            documentName: r.source.documentName,
            ...(r.source.year !== undefined && { year: r.source.year }),
            ...(r.content && { content: r.content }),
          }))
        );
        state.evidenceEvaluation = evidenceEval;

        // 按质量排序证据（高质量优先）
        const sortedEvidence = sortEvidenceByQuality(evidenceEval);
        const overallGrade = calculateOverallGrade(sortedEvidence);

        this.logger.log(state.iteration, 'observe', 'Evidence evaluation', {
          overallGrade,
          evaluatedSources: evidenceEval.length,
          topCompositeScore: sortedEvidence[0]?.compositeScore?.toFixed(2) ?? 'N/A',
          consistencyScore: sortedEvidence[0]?.consistencyScore?.toFixed(2) ?? 'N/A',
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

    // 2.5. 设置检索结果数量（在生成回答前）
    const finalRetrievalCount = state.retrievalResults?.length ?? 0;
    this.collector.setRetrievalResultCount(finalRetrievalCount);
    this.logger.log(state.iteration, 'complete', 'Final retrieval count set', {
      count: finalRetrievalCount,
    });

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

    // 标记 TraceContext 完成 (新增)
    this.tracer.markComplete();

    const result = this.buildResult(state);
    if (fallbackReason) {
      result.fallbackReason = fallbackReason;
    }

    // 添加可视化数据到结果
    result.visualization = this.collector.buildVisualization();
    result.executionTrace = this.tracer.buildTrace();
    this.visualizationCallback?.('complete', result);

    // 异步持久化追踪 (新增)
    this.persistTrace().catch(err => {
      this.logger.log(0, 'complete', 'Failed to persist trace', { error: err.message }, 'warn');
    });

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
    this.visualizationCallback?.('complete', result);

    return result;
  }

  /**
   * 执行直接检索模式
   *
   * 当实体识别置信度低于阈值时，跳过 Agent 循环，直接用原始查询检索
   */
  private async executeDirectRetrieval(query: string, entities: MedicalEntities): Promise<AgentResult> {
    this.logger.log(0, 'think', 'Direct retrieval mode triggered', {
      query,
      confidence: entities.confidence,
      threshold: this.getLowConfidenceThreshold(),
    });

    // 收集查询重写（直接使用原始查询）
    const queryStrategy = {
      primaryQuery: query,
      expandedTerms: [],
    };
    this.collector.collectQueryRewriting(queryStrategy);
    this.visualizationCallback?.('query_rewrite', {
      primaryQuery: query,
      expandedTerms: [],
    });

    // 执行检索
    const results = await this.context.retrieval(query, {
      topK: this.config.retrievalTopK,
      threshold: this.config.retrievalThreshold,
    });

    this.logger.log(0, 'act', 'Direct retrieval completed', {
      resultCount: results.length,
    });

    // 执行安全检查
    const safetyAssessment = performSafetyCheck(entities, []);

    // 生成答案
    const answer = await this.context.reasoner.generateAnswer(
      entities,
      results,
      safetyAssessment,
      [],
    );

    // 构建结果
    const result: AgentResult = {
      answer,
      entities,
      stats: {
        iterations: 0,
        actionsExecuted: 1,
        retrievalCalls: 1,
        llmCalls: 1,
        totalTimeMs: Date.now() - this.startTime,
      },
      reasoningTrace: [],
      success: results.length > 0,
      satisfied: results.length > 0,
      retrievalResults: results,
    };

    // 添加可视化数据
    result.visualization = this.collector.buildVisualization();
    result.executionTrace = this.tracer.buildTrace();
    this.visualizationCallback?.('complete', result);

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
   * 根据配置选择规则化决策或 LLM 决策
   */
  private async decide(state: AgentState): Promise<boolean> {
    // 如果没有检索结果，不满足
    if (!state.retrievalResults || state.retrievalResults.length === 0) {
      return false;
    }

    // 检查是否使用规则化决策（默认启用）
    const useRuleBased = this.config.useRuleBasedDecide ?? true;

    if (useRuleBased) {
      return this.decideByRules(state);
    }

    // 使用 LLM 判断（fallback）
    return await this.context.reasoner.decide(state);
  }

  /**
   * DecideByRules: 规则化决策判断
   *
   * 规则优先级：
   * 1. 检索结果数量 >= minRetrievalCount
   * 2. 最高相似度 > minSimilarityScore
   * 3. 实体覆盖率 >= minEntityCoverage
   * 4. SafetyLayer 绝对禁忌已确定
   */
  private decideByRules(state: AgentState): boolean {
    const thresholds = this.ruleThresholds;
    const now = Date.now();

    // 规则 1: 检索结果数量
    const resultCount = state.retrievalResults?.length ?? 0;
    if (resultCount >= thresholds.minRetrievalCount) {
      this.recordRuleHit('retrieval_count', thresholds.minRetrievalCount, resultCount, now);
      this.logger.log(state.iteration, 'decide_rule', `Rule hit: retrieval_count (${resultCount} >= ${thresholds.minRetrievalCount})`);
      return true;
    }

    // 规则 2: 最高相似度
    const maxSimilarity = Math.max(
      ...state.retrievalResults?.map(r => r.similarityScore ?? 0) ?? [0]
    );
    if (maxSimilarity > thresholds.minSimilarityScore) {
      this.recordRuleHit('high_similarity', thresholds.minSimilarityScore, maxSimilarity, now);
      this.logger.log(state.iteration, 'decide_rule', `Rule hit: high_similarity (${maxSimilarity.toFixed(2)} > ${thresholds.minSimilarityScore})`);
      return true;
    }

    // 规则 3: 实体覆盖率
    const entityCoverage = this.calculateEntityCoverage(state);
    if (entityCoverage >= thresholds.minEntityCoverage) {
      this.recordRuleHit('entity_coverage', thresholds.minEntityCoverage, entityCoverage, now);
      this.logger.log(state.iteration, 'decide_rule', `Rule hit: entity_coverage (${entityCoverage.toFixed(2)} >= ${thresholds.minEntityCoverage})`);
      return true;
    }

    // 规则 4: SafetyLayer 绝对禁忌已确定
    if (state.safetyAssessment?.severity === 'absolute') {
      this.recordRuleHit('absolute_contraindication', 1, 1, now);
      this.logger.log(state.iteration, 'decide_rule', 'Rule hit: absolute_contraindication (no more retrieval needed)');
      return true;
    }

    // 所有规则都不满足
    this.logger.log(state.iteration, 'decide_rule', `No rule hit, continuing iteration`, {
      resultCount,
      maxSimilarity: maxSimilarity.toFixed(2),
      entityCoverage: entityCoverage.toFixed(2),
      safetySeverity: state.safetyAssessment?.severity ?? 'none',
    });

    return false;
  }

  /**
   * 记录规则命中
   */
  private recordRuleHit(ruleType: RuleHitType, threshold: number, actualValue: number, timestamp: number): void {
    this.ruleHits.push({
      ruleType,
      threshold,
      actualValue,
      timestamp,
    });
  }

  /**
   * 计算实体覆盖率
   *
   * 检索结果中覆盖的实体占所有识别实体的比例
   */
  private calculateEntityCoverage(state: AgentState): number {
    const entities = state.entities;
    const allEntityIds = [
      ...entities.diseases.map(d => d.id),
      ...entities.drugs.map(d => d.id),
      ...entities.indicators.map(i => i.id),
    ];

    if (allEntityIds.length === 0) {
      return 1;  // 无实体时默认覆盖
    }

    // 检查检索结果中是否包含实体相关内容
    const coveredEntities = new Set<string>();

    for (const result of state.retrievalResults ?? []) {
      const contentLower = result.content.toLowerCase();

      // 检查疾病实体
      for (const disease of entities.diseases) {
        if (
          contentLower.includes(disease.canonicalName.toLowerCase()) ||
          disease.aliases.some(a => contentLower.includes(a.toLowerCase()))
        ) {
          coveredEntities.add(disease.id);
        }
      }

      // 检查药物实体
      for (const drug of entities.drugs) {
        if (
          contentLower.includes(drug.canonicalName.toLowerCase()) ||
          drug.aliases.some(a => contentLower.includes(a.toLowerCase()))
        ) {
          coveredEntities.add(drug.id);
        }
      }

      // 检查指标实体
      for (const indicator of entities.indicators) {
        if (
          contentLower.includes(indicator.canonicalName.toLowerCase()) ||
          contentLower.includes(indicator.matchedTerm.toLowerCase())
        ) {
          coveredEntities.add(indicator.id);
        }
      }
    }

    return coveredEntities.size / allEntityIds.length;
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
   * 从 SafetyAssessment 生成回答（Early Termination 场景）
   *
   * 当绝对禁忌确定时，无需检索，直接生成回答
   */
  private generateAnswerFromSafety(entities: MedicalEntities, safetyAssessment: SafetyAssessment): MedicalAnswer {
    // 构建结论（使用 SafetyAssessment 的推荐）
    const conclusionText = safetyAssessment.recommendation;

    // 构建详细说明（禁忌描述）
    const detailPoints: Array<{ text: string; sources: SourceCitation[] }> = [];

    for (const match of safetyAssessment.contraindicationMatches) {
      detailPoints.push({
        text: match.contraindication.description,
        sources: [],
      });
    }

    // 添加相互作用信息（如有）
    for (const interaction of safetyAssessment.interactions) {
      detailPoints.push({
        text: `${interaction.description}。建议：${interaction.recommendation}`,
        sources: [],
      });
    }

    // 构建证据等级（指南来源）
    const evidenceGrade = {
      grade: 'B' as const,  // 指南推荐为 B 级
      sourceType: safetyAssessment.sourceGlossary.length > 0
        ? safetyAssessment.sourceGlossary.join(', ')
        : '临床指南',
    };

    // 构建来源引用
    const sources: SourceCitation[] = safetyAssessment.sourceGlossary.map(g => ({
      documentName: g,
    }));

    // 构建警告
    const warnings = [
      '本回答基于禁忌规则直接生成，无需检索',
      '本回答仅供参考，不构成医疗建议',
      '请咨询专业医生后再做决定',
    ];

    return {
      conclusion: {
        text: conclusionText,
        confidence: 'high',
      },
      details: {
        points: detailPoints,
      },
      evidenceGrade,
      sources,
      warnings,
    };
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

    // 添加证据评估结果
    if (state.evidenceEvaluation !== undefined && state.evidenceEvaluation.length > 0) {
      result.evidenceEvaluation = state.evidenceEvaluation;

      // 验证数量一致性
      if (state.retrievalResults !== undefined) {
        const evalCount = state.evidenceEvaluation.length;
        const retrievalCount = state.retrievalResults.length;
        if (evalCount !== retrievalCount) {
          this.logger.log(state.iteration, 'observe', 'Evidence count mismatch', {
            evalCount,
            retrievalCount,
          }, 'warn');
        }
      }

      // 计算整体证据等级
      const sortedEvidence = sortEvidenceByQuality(state.evidenceEvaluation);
      result.overallEvidenceGrade = calculateOverallGrade(sortedEvidence);

      // 计算证据统计信息
      const gradeDistribution: Record<'A' | 'B' | 'C' | 'D', number> = { A: 0, B: 0, C: 0, D: 0 };
      for (const evidenceEvalItem of state.evidenceEvaluation) {
        gradeDistribution[evidenceEvalItem.grade]++;
      }

      const scoresWithComposite = state.evidenceEvaluation.filter(e => e.compositeScore !== undefined);
      const averageCompositeScore = scoresWithComposite.length > 0
        ? scoresWithComposite.reduce((sum, e) => sum + (e.compositeScore ?? 0), 0) / scoresWithComposite.length
        : 0;

      // 检测证据冲突（是否存在不同等级的证据）
      const uniqueGrades = new Set(state.evidenceEvaluation.map(e => e.grade));
      const conflictDetected = uniqueGrades.size > 1 && uniqueGrades.has('A') && (uniqueGrades.has('C') || uniqueGrades.has('D'));

      result.evidenceStatistics = {
        gradeDistribution,
        averageCompositeScore,
        conflictDetected,
      };
    }

    if (state.error !== undefined) {
      result.error = state.error;
    }
    return result;
  }
}

/**
 * 独立导出的 decideByRules 函数（用于测试）
 *
 * 规则优先级：retrieval_count > high_similarity > entity_coverage > absolute_contraindication
 */
export function decideByRules(
  state: AgentState,
  thresholds: RuleThresholds = DEFAULT_RULE_THRESHOLDS
): RuleHitRecord {
  // 规则 1: 检索结果数量
  const resultCount = state.retrievalResults?.length ?? 0;
  if (resultCount >= thresholds.minRetrievalCount) {
    return {
      ruleType: 'retrieval_count',
      threshold: thresholds.minRetrievalCount,
      actualValue: resultCount,
      timestamp: Date.now(),
    };
  }

  // 规则 2: 最高相似度
  const maxSimilarity = Math.max(
    ...state.retrievalResults?.map(r => r.similarityScore ?? 0) ?? [0]
  );
  if (maxSimilarity > thresholds.minSimilarityScore) {
    return {
      ruleType: 'high_similarity',
      threshold: thresholds.minSimilarityScore,
      actualValue: maxSimilarity,
      timestamp: Date.now(),
    };
  }

  // 规则 3: 实体覆盖率
  const entityCoverage = calculateEntityCoverage(state);
  if (entityCoverage >= thresholds.minEntityCoverage) {
    return {
      ruleType: 'entity_coverage',
      threshold: thresholds.minEntityCoverage,
      actualValue: entityCoverage,
      timestamp: Date.now(),
    };
  }

  // 规则 4: SafetyLayer 绝对禁忌已确定
  if (state.safetyAssessment?.severity === 'absolute') {
    return {
      ruleType: 'absolute_contraindication',
      threshold: 1,
      actualValue: 1,
      timestamp: Date.now(),
    };
  }

  // 无规则命中
  return {
    ruleType: 'none',
    threshold: 0,
    actualValue: 0,
    timestamp: Date.now(),
  };
}

/**
 * 独立导出的 calculateEntityCoverage 函数（用于测试）
 */
export function calculateEntityCoverage(
  state: AgentState
): number {
  const entities = state.entities;
  const allEntityTerms = [
    ...entities.diseases.map(d => d.canonicalName),
    ...entities.drugs.map(d => d.canonicalName),
    ...entities.indicators.map(i => i.canonicalName),
  ];

  if (allEntityTerms.length === 0) {
    return 1;  // 无实体时默认覆盖
  }

  // 检查检索结果中是否包含实体相关内容
  const coveredEntities = new Set<string>();

  for (const result of state.retrievalResults ?? []) {
    const content = result.content.toLowerCase();
    for (const term of allEntityTerms) {
      if (content.includes(term.toLowerCase())) {
        coveredEntities.add(term);
      }
    }
  }

  return coveredEntities.size / allEntityTerms.length;
}

/**
 * 独立导出的 generateAnswerFromSafety 函数（用于测试）
 *
 * 根据安全评估直接生成医学回答（早终止场景）
 */
export function generateAnswerFromSafety(
  query: string,
  safetyAssessment: SafetyAssessment
): MedicalAnswer {
  // 构建结论（使用 SafetyAssessment 的推荐）
  const conclusionText = safetyAssessment.recommendation;

  // 构建详细说明（禁忌描述）
  const detailPoints: Array<{ text: string; sources: SourceCitation[] }> = [];

  for (const match of safetyAssessment.contraindicationMatches) {
    detailPoints.push({
      text: match.contraindication.description,
      sources: [],
    });
  }

  // 添加相互作用信息（如有）
  for (const interaction of safetyAssessment.interactions) {
    detailPoints.push({
      text: `${interaction.description}。建议：${interaction.recommendation}`,
      sources: [],
    });
  }

  // 构建证据等级（指南来源）
  const evidenceGrade = {
    grade: 'B' as const,
    sourceType: safetyAssessment.sourceGlossary.length > 0
      ? safetyAssessment.sourceGlossary.join(', ')
      : '临床指南',
  };

  // 构建来源引用
  const sources: SourceCitation[] = safetyAssessment.sourceGlossary.map(g => ({
    documentName: g,
  }));

  // 构建警告
  const warnings = [
    '本回答基于禁忌规则直接生成，无需检索',
    '本回答仅供参考，不构成医疗建议',
    '请咨询专业医生后再做决定',
  ];

  return {
    conclusion: {
      text: conclusionText,
      confidence: 'high',
    },
    details: {
      points: detailPoints,
    },
    evidenceGrade,
    sources,
    warnings,
  };
}

/**
 * 创建 AgentExecutor
 */
export function createAgentExecutor(
  config: ExtendedAgentConfig,
  context: AgentContext,
  visualizationCallback?: (phase: string, data: unknown) => void
): AgentExecutor {
  return new AgentExecutor(config, context, visualizationCallback);
}