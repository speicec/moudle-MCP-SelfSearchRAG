/**
 * TraceContext - 统一的追踪上下文容器
 *
 * 在 Agent 执行过程中累积追踪数据，最终持久化到 SQLite
 */

import { v4 as uuidv4 } from 'uuid';
import type { MedicalEntities } from '../medical/types.js';
import type { ComplexityAssessment } from '../medical/agent/ExecutionTypes.js';
import type {
  TraceSpan,
  RetrievedChunk,
  LLMCallRecord,
  TraceContextData,
} from './types.js';

/**
 * TraceContext - 统一的追踪上下文容器
 *
 * 整合 TraceVisualizer 和 EvaluationCollector 的数据
 */
export class TraceContext {
  readonly traceId: string;
  readonly sessionId?: string;
  readonly timestamp: string;

  private spans: TraceSpan[] = [];
  private llmCalls: LLMCallRecord[] = [];
  private retrievalChunks: RetrievedChunk[] = [];

  private queryData: {
    raw: string;
    rewritten?: string;
    entities?: MedicalEntities;
    complexity?: ComplexityAssessment;
  } = { raw: '' };

  private answerData?: {
    text: string;
    confidence?: number;
    sources?: string[];
  };

  private retrievalConfig: {
    topK: number;
    threshold: number;
    mode: 'dense' | 'sparse' | 'hybrid';
  } = {
    topK: 10,
    threshold: 0.3,
    mode: 'hybrid',
  };

  private status: 'running' | 'completed' | 'failed' = 'running';
  private error?: string;

  constructor(sessionId?: string) {
    this.traceId = uuidv4();
    if (sessionId !== undefined) {
      this.sessionId = sessionId;
    }
    this.timestamp = new Date().toISOString();
  }

  /**
   * 设置查询信息
   */
  setQuery(raw: string, rewritten?: string): void {
    this.queryData = {
      raw,
      ...(rewritten && { rewritten }),
    };
  }

  /**
   * 设置实体识别结果
   */
  setEntities(entities: MedicalEntities): void {
    this.queryData.entities = entities;
  }

  /**
   * 设置复杂度评估结果
   */
  setComplexity(complexity: ComplexityAssessment): void {
    this.queryData.complexity = complexity;
  }

  /**
   * 设置检索配置
   */
  setRetrievalConfig(config: {
    topK?: number;
    threshold?: number;
    mode?: 'dense' | 'sparse' | 'hybrid';
  }): void {
    if (config.topK !== undefined) this.retrievalConfig.topK = config.topK;
    if (config.threshold !== undefined) this.retrievalConfig.threshold = config.threshold;
    if (config.mode !== undefined) this.retrievalConfig.mode = config.mode;
  }

  /**
   * 记录阶段
   */
  recordSpan(span: TraceSpan): void {
    this.spans.push(span);
  }

  /**
   * 创建并记录阶段
   * @returns spanId 用于后续关联
   */
  createSpan(
    phase: TraceSpan['phase'],
    input: unknown,
    parentSpanId?: string
  ): string {
    const spanId = `${phase}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    return spanId;
  }

  /**
   * 结束阶段记录
   */
  endSpan(
    spanId: string,
    phase: TraceSpan['phase'],
    startTime: number,
    input: unknown,
    output: unknown,
    metadata?: Record<string, unknown>,
    parentSpanId?: string
  ): void {
    const endTime = Date.now();
    const span: TraceSpan = {
      spanId,
      phase,
      startTime,
      endTime,
      durationMs: endTime - startTime,
      input,
      output,
      ...(parentSpanId && { parentSpanId }),
    };

    if (metadata) {
      span.metadata = metadata;
    }

    this.spans.push(span);
  }

  /**
   * 记录 LLM 调用
   */
  recordLLMCall(call: LLMCallRecord): void {
    this.llmCalls.push(call);
  }

  /**
   * 记录检索结果
   */
  recordRetrieval(chunks: RetrievedChunk[]): void {
    this.retrievalChunks = chunks;
  }

  /**
   * 设置答案
   */
  setAnswer(answer: string, confidence?: number, sources?: string[]): void {
    this.answerData = {
      text: answer,
      ...(confidence && { confidence }),
      ...(sources && sources.length > 0 && { sources }),
    };
  }

  /**
   * 标记完成
   */
  complete(): void {
    this.status = 'completed';
  }

  /**
   * 标记失败
   */
  fail(error: string): void {
    this.status = 'failed';
    this.error = error;
  }

  /**
   * 获取当前状态
   */
  getStatus(): 'running' | 'completed' | 'failed' {
    return this.status;
  }

  /**
   * 构建完整的追踪数据
   */
  build(): TraceContextData {
    return {
      traceId: this.traceId,
      ...(this.sessionId && { sessionId: this.sessionId }),
      timestamp: this.timestamp,
      query: this.queryData,
      phases: this.spans,
      retrieval: {
        chunks: this.retrievalChunks,
        topK: this.retrievalChunks.length || this.retrievalConfig.topK,
        threshold: this.retrievalConfig.threshold,
        mode: this.retrievalConfig.mode,
      },
      llmCalls: this.llmCalls,
      answer: this.answerData ?? { text: '' },
      status: this.status,
      ...(this.error && { error: this.error }),
    };
  }

  /**
   * 获取追踪 ID
   */
  getTraceId(): string {
    return this.traceId;
  }

  /**
   * 获取 LLM 调用计数
   */
  getLLMCallCount(): number {
    return this.llmCalls.length;
  }

  /**
   * 获取阶段计数
   */
  getSpanCount(): number {
    return this.spans.length;
  }

  /**
   * 获取检索 chunk 计数
   */
  getChunkCount(): number {
    return this.retrievalChunks.length;
  }

  /**
   * 获取总耗时（从第一个阶段到最后一个阶段）
   */
  getTotalDurationMs(): number {
    if (this.spans.length === 0) return 0;
    const firstPhase = this.spans[0];
    const lastPhase = this.spans[this.spans.length - 1];
    if (!firstPhase || !lastPhase) return 0;
    return lastPhase.endTime - firstPhase.startTime;
  }
}

/**
 * 创建 TraceContext 实例
 */
export function createTraceContext(sessionId?: string): TraceContext {
  return new TraceContext(sessionId);
}