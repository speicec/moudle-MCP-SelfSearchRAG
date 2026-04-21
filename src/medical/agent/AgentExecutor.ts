/**
 * Agent Executor - Agent 执行器
 *
 * 实现 ReAct 循环：Think → Act → Observe → Decide
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
import type { MedicalEntities } from '../types.js';

/**
 * AgentExecutor - 执行 Agent 循环
 */
export class AgentExecutor {
  private config: AgentConfig;
  private context: AgentContext;
  private startTime: number;

  constructor(config: AgentConfig, context: AgentContext) {
    this.config = config;
    this.context = context;
    this.startTime = 0;
  }

  /**
   * 执行 Agent 循环
   */
  async run(query: string): Promise<AgentResult> {
    this.startTime = Date.now();

    // 1. 初始化状态
    const entities = this.context.extractEntities(query);
    let state = createInitialState(query, entities, this.config.maxIterations);

    if (this.config.enableTraceLogging) {
      console.log('[AgentExecutor] Initial state:', serializeState(state));
    }

    // 2. 主循环
    while (canContinue(state)) {
      state = incrementIteration(state);

      // Think: 分析当前状态
      state = setStatus(state, 'thinking');
      const decision = await this.think(state);

      // 检查是否应该停止
      if (decision.action === 'stop' || decision.needsMoreInfo === false && decision.confidence >= this.config.confidenceThreshold) {
        state = markSatisfied(state, true);
        break;
      }

      // Act: 执行动作
      state = setStatus(state, 'acting');
      const action = this.decideAction(decision, state);
      const observation = await this.executeAction(action, state);

      // Observe: 记录观察
      state = setStatus(state, 'observing');
      state = addReasoningStep(state, action, observation, decision);

      // 更新状态
      if (observation.success && observation.type === 'retrieval') {
        const retrievalData = observation.data as Array<{
          content: string;
          source: SourceCitation;
        }>;
        state = updateRetrievalResults(state, retrievalData);
      }

      // Decide: 判断是否满足
      state = setStatus(state, 'deciding');
      const satisfied = await this.decide(state);
      state = markSatisfied(state, satisfied);

      if (this.config.enableTraceLogging) {
        console.log(`[AgentExecutor] Iteration ${state.iteration}:`, {
          action: action.type,
          satisfied,
          confidence: decision.confidence,
        });
      }

      // 检查最大迭代
      if (isMaxIterationsReached(state)) {
        if (this.config.enableTraceLogging) {
          console.log('[AgentExecutor] Max iterations reached');
        }
        break;
      }
    }

    // 3. 生成回答
    state = setStatus(state, 'answering');
    const answer = await this.generateAnswer(state);
    state = setAnswer(state, answer);

    // 4. 质量检查（可选）
    if (this.config.enableQualityCheck && this.context.reasoner.checkQuality) {
      const qualityResult = await this.context.reasoner.checkQuality(answer);
      if (!qualityResult.isValid && this.config.enableTraceLogging) {
        console.log('[AgentExecutor] Quality issues:', qualityResult.issues);
      }
    }

    // 5. 完成
    state = setStatus(state, 'completed');

    return this.buildResult(state);
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
export function createAgentExecutor(config: AgentConfig, context: AgentContext): AgentExecutor {
  return new AgentExecutor(config, context);
}