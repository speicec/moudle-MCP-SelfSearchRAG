/**
 * Medical Agent - 医学智能 Agent
 *
 * 主入口，协调实体识别、检索、推理和回答生成
 */

import type { LLMCaller } from '../../config/llm-config.js';
import type {
  AgentConfig,
  AgentResult,
  AgentContext,
  SourceCitation,
} from './types.js';
import type { MedicalQueryInput } from '../types.js';
import { DEFAULT_AGENT_CONFIG } from './types.js';
import { AgentExecutor } from './AgentExecutor.js';
import { MedicalReasoner, createMedicalReasoner } from './MedicalReasoner.js';
import { extractMedicalEntities } from '../entity-recognizer.js';
import { buildQueryStrategy } from '../query-planner.js';

/**
 * Retrieval function type
 */
type RetrievalFunction = (query: string, options?: {
  topK?: number;
  threshold?: number;
}) => Promise<Array<{
  content: string;
  source: SourceCitation;
}>>;

/**
 * MedicalAgent - 医学智能 Agent
 */
export class MedicalAgent {
  private config: AgentConfig;
  private reasoner: MedicalReasoner;
  private retrieval?: RetrievalFunction;

  constructor(
    llmCaller: LLMCaller,
    retrieval?: RetrievalFunction,
    config?: Partial<AgentConfig>,
  ) {
    this.config = {
      ...DEFAULT_AGENT_CONFIG,
      ...config,
    };

    this.reasoner = createMedicalReasoner(llmCaller, {
      maxIterations: this.config.maxIterations,
      confidenceThreshold: this.config.confidenceThreshold,
    });

    if (retrieval !== undefined) {
      this.retrieval = retrieval;
    }
  }

  /**
   * 执行医学查询
   */
  async run(input: MedicalQueryInput): Promise<AgentResult> {
    // 如果没有检索服务，提供默认的空检索
    const retrievalFn = this.retrieval !== undefined
      ? this.retrieval
      : this.createEmptyRetrieval();

    // 构建 Agent 上下文
    const context: AgentContext = {
      retrieval: retrievalFn,
      reasoner: {
        reasonClinical: async (state) => {
          // Build ReasoningState object
          const reasoningStateArgs: {
            entities: typeof state.entities;
            iteration: number;
            reasoningTrace: string[];
            satisfied: boolean;
          } & { retrievalResults?: typeof state.retrievalResults } = {
            entities: state.entities,
            iteration: state.iteration,
            reasoningTrace: state.reasoningTrace.map(s => s.action.reason),
            satisfied: state.satisfied,
          };
          if (state.retrievalResults !== undefined) {
            reasoningStateArgs.retrievalResults = state.retrievalResults;
          }
          const decision = await this.reasoner.reasonClinical(reasoningStateArgs);
          return {
            action: decision.action as 'retrieve' | 'expand_query' | 'generate_answer' | 'stop',
            confidence: decision.confidence,
            reason: decision.reason,
            needsMoreInfo: decision.action !== 'answer',
          };
        },
        decide: async (state) => {
          // Build ReasoningState object
          const decideStateArgs: {
            entities: typeof state.entities;
            iteration: number;
            reasoningTrace: string[];
            satisfied: boolean;
          } & { retrievalResults?: typeof state.retrievalResults } = {
            entities: state.entities,
            iteration: state.iteration,
            reasoningTrace: [],
            satisfied: state.satisfied,
          };
          if (state.retrievalResults !== undefined) {
            decideStateArgs.retrievalResults = state.retrievalResults;
          }
          return await this.reasoner.decide(decideStateArgs);
        },
        generateAnswer: async (entities, retrievalResults, safetyAssessment, evidenceEvaluation) => {
          return await this.reasoner.generateMedicalAnswer(
            entities,
            retrievalResults,
            safetyAssessment,
            evidenceEvaluation,
          );
        },
        checkQuality: async (answer) => {
          return await this.reasoner.checkAnswerQuality(answer);
        },
      },
      extractEntities: (query) => extractMedicalEntities(query),
      buildQueryStrategy: (entities) => {
        const strategy = buildQueryStrategy({
          query: entities.rawQuery,
          domain: 'all',
          include_guidelines: true,
        });
        return {
          primaryQuery: strategy.primaryQuery,
          expandedTerms: strategy.expandedTerms,
        };
      },
    };

    // 执行 Agent
    const executor = new AgentExecutor(this.config, context);
    return await executor.run(input.query);
  }

  /**
   * 创建空检索（当没有检索服务时）
   */
  private createEmptyRetrieval(): RetrievalFunction {
    return async () => {
      console.warn('[MedicalAgent] No retrieval service configured, returning empty results');
      return [];
    };
  }

  /**
   * 设置检索服务
   */
  setRetrieval(retrieval: RetrievalFunction): void {
    this.retrieval = retrieval;
  }

  /**
   * 获取配置
   */
  getConfig(): AgentConfig {
    return this.config;
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<AgentConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }
}

/**
 * 创建 MedicalAgent
 */
export function createMedicalAgent(
  llmCaller: LLMCaller,
  retrieval?: RetrievalFunction,
  config?: Partial<AgentConfig>,
): MedicalAgent {
  return new MedicalAgent(llmCaller, retrieval, config);
}