/**
 * AgentEvaluationService - Agent 评估集成服务
 *
 * 集成评估队列到 Medical Agent 执行流程
 */

import { EvaluationQueue, createEvaluationQueue } from '../queue/EvaluationQueue.js';
import { createTraceStorage, TraceStorage } from '../tracing/TraceStorage.js';
import type { TraceContextData, EvaluationResult } from '../tracing/types.js';
import type { ExtendedEvaluationResult } from '../evaluation/types.js';
import type { AgentResult } from '../medical/agent/types.js';

/**
 * 评估结果处理器
 */
export interface EvaluationResultHandlers {
  onSuccess?: (result: ExtendedEvaluationResult) => void;
  onError?: (error: Error) => void;
  onProgress?: (progress: number) => void;
}

/**
 * AgentEvaluationService 配置
 */
export interface AgentEvaluationConfig {
  redis?: {
    host: string;
    port: number;
    password?: string;
  };
  dbPath?: string;
  enableEvaluation?: boolean;
  priority?: 'high' | 'normal' | 'low';
}

const DEFAULT_CONFIG: AgentEvaluationConfig = {
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    ...(process.env.REDIS_PASSWORD && { password: process.env.REDIS_PASSWORD }),
  },
  dbPath: process.env.TRACE_DB_PATH ?? './data/traces.db',
  enableEvaluation: true,
  priority: 'normal',
};

/**
 * AgentEvaluationService - 评估服务
 */
export class AgentEvaluationService {
  private queue: EvaluationQueue | null = null;
  private storage: TraceStorage | null = null;
  private config: AgentEvaluationConfig;
  private initialized: boolean = false;

  constructor(config?: Partial<AgentEvaluationConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 初始化服务
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    try {
      // 初始化存储
      this.storage = await createTraceStorage(this.config.dbPath);

      // 初始化队列
      if (this.config.enableEvaluation) {
        this.queue = await createEvaluationQueue(this.config.redis);
      }

      this.initialized = true;
    } catch (error) {
      console.error('[AgentEvaluationService] Init failed:', error);
      // 不抛出错误，允许服务在没有 Redis 时运行
      this.initialized = true;
    }
  }

  /**
   * 提交评估任务（不阻塞）
   */
  async submitEvaluation(
    traceData: TraceContextData,
    handlers?: EvaluationResultHandlers
  ): Promise<{ jobId: string; submitted: boolean }> {
    if (!this.queue) {
      console.warn('[AgentEvaluationService] Queue not initialized, skipping evaluation');
      return { jobId: '', submitted: false };
    }

    try {
      const job = await this.queue.addJob(traceData, this.config.priority ?? 'normal', {
        onSuccess: (result) => {
          // Cast result through unknown for handler compatibility
          handlers?.onSuccess?.(result as unknown as ExtendedEvaluationResult);
          // 持久化评估结果
          this.saveEvaluationResult(result as unknown as ExtendedEvaluationResult).catch(console.error);
        },
        onError: (error) => {
          handlers?.onError?.(error);
        },
        onProgress: (progress) => {
          handlers?.onProgress?.(progress);
        },
      });

      return { jobId: String(job.id), submitted: true };
    } catch (error) {
      console.error('[AgentEvaluationService] Submit failed:', error);
      return { jobId: '', submitted: false };
    }
  }

  /**
   * 持久化评估结果
   */
  private async saveEvaluationResult(result: ExtendedEvaluationResult): Promise<void> {
    if (!this.storage) return;

    // 构建符合 EvaluationResult 结构的对象
    const evaluationResult: EvaluationResult = {
      evaluationId: result.evaluationId,
      traceId: result.traceId,
      timestamp: result.timestamp,
      metrics: {
        faithfulness: {
          score: result.metrics.faithfulness.score,
          verdicts: [],
        },
        contextRelevance: {
          score: result.metrics.contextRelevance.score,
          chunkScores: [],
        },
        answerRelevance: {
          score: result.metrics.answerRelevance.score,
          generatedQuestions: [],
        },
      },
      overallScore: result.overallScore,
      metadata: {
        evaluatorModel: '',
        evaluationDurationMs: 0,
        retryCount: 0,
      },
    };

    await this.storage.saveEvaluation(evaluationResult);
  }

  /**
   * 从 AgentResult 创建追踪数据并提交评估
   */
  async submitFromAgentResult(
    result: AgentResult,
    query: string,
    sessionId?: string,
    handlers?: EvaluationResultHandlers
  ): Promise<{ jobId: string; submitted: boolean }> {
    // 从 AgentResult 构建 TraceContextData
    const traceData: TraceContextData = this.buildTraceDataFromResult(result, query, sessionId);

    // 持久化追踪
    if (this.storage) {
      await this.storage.saveTrace(traceData);
    }

    // 提交评估
    return this.submitEvaluation(traceData, handlers);
  }

  /**
   * 从 AgentResult 构建 TraceContextData
   */
  private buildTraceDataFromResult(
    result: AgentResult,
    query: string,
    sessionId?: string
  ): TraceContextData {
    const timestamp = new Date().toISOString();

    // 构建 chunks 用于检索数据 (使用 retrievalResults)
    const retrievalResults = result.retrievalResults ?? [];
    const chunks = retrievalResults.map((item, idx) => ({
      chunkId: `chunk-${idx}`,
      content: item.content ?? '',
      sourceDocumentId: item.source?.documentName ?? '',
      similarityScore: 0.5, // 默认相似度
      confidenceLevel: 'medium' as const,
      source: 'hybrid' as const,
    }));

    // 获取答案文本
    const answerText = typeof result.answer === 'string'
      ? result.answer
      : (result.answer as { text?: string; summary?: string }).text
        ?? (result.answer as { text?: string; summary?: string }).summary
        ?? '';

    // 获取置信度（如果答案对象中有）
    const answerObj = result.answer as { confidence?: number } | undefined;
    const confidence = answerObj?.confidence ?? (result.satisfied ? 0.8 : 0.5);

    return {
      traceId: `trace-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ...(sessionId && { sessionId }),
      timestamp,
      query: {
        raw: query,
      },
      phases: [],
      retrieval: {
        chunks,
        topK: chunks.length,
        threshold: 0.3,
        mode: 'hybrid',
      },
      llmCalls: [],
      answer: {
        text: answerText,
        confidence,
        sources: retrievalResults.map(item => item.source?.documentName ?? ''),
      },
      status: result.success ? 'completed' : (result.satisfied ? 'completed' : 'partial'),
      startTime: Date.now() - result.stats.totalTimeMs,
      endTime: Date.now(),
      durationMs: result.stats.totalTimeMs,
    };
  }

  /**
   * 查询评估任务状态
   */
  async getEvaluationStatus(jobId: string): Promise<string | null> {
    if (!this.queue) return null;
    return this.queue.getJobStatus(jobId);
  }

  /**
   * 获取队列统计
   */
  async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    total: number;
  } | null> {
    if (!this.queue) return null;
    return this.queue.getQueueStats();
  }

  /**
   * 获取最近追踪记录
   */
  async getRecentTraces(limit: number = 100): Promise<TraceContextData[]> {
    if (!this.storage) return [];
    return this.storage.getRecentTraces(limit);
  }

  /**
   * 关闭服务
   */
  async close(): Promise<void> {
    if (this.queue) {
      await this.queue.close();
      this.queue = null;
    }
    if (this.storage) {
      this.storage.close();
      this.storage = null;
    }
    this.initialized = false;
  }

  /**
   * 检查是否初始化
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * 检查队列是否可用
   */
  isQueueAvailable(): boolean {
    return this.queue !== null;
  }
}

/**
 * 创建 AgentEvaluationService
 */
export function createAgentEvaluationService(
  config?: Partial<AgentEvaluationConfig>
): AgentEvaluationService {
  return new AgentEvaluationService(config);
}