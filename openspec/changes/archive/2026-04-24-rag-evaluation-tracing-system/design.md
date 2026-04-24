# Design: RAG Evaluation & Tracing System

## 1. 架构总览

### 1.1 系统分层

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Layer 4: 可视化层                                                            │
│   StatsDashboard (扩展) │ TraceExplorer │ EvaluationTrendChart              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ WebSocket + REST API
┌─────────────────────────────────────────────────────────────────────────────┐
│ Layer 3: 聚合层                                                              │
│   MetricsAggregator → 整合追踪指标 + 评估分数 → 推送到前端                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Layer 2: 处理层                                                              │
│   TraceStorage │ EvaluationPipeline │ TraceExporter (可选)                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Layer 1: 收集层                                                              │
│   TraceVisualizer (扩展) │ EvaluationCollector │ TraceContext              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Layer 0: 业务层                                                              │
│   MedicalAgent │ LLMCaller │ EnhancedRetrievalPipeline                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 模块依赖关系

```
                    MedicalAgent
                         │
         ┌───────────────┼───────────────┐
         │               │               │
         ▼               ▼               ▼
  TraceVisualizer  LLMCaller    RetrievalPipeline
         │               │               │
         │    ┌──────────┴──────────┐    │
         │    │                     │    │
         ▼    ▼                     ▼    ▼
    TraceContext ──────────────────▶ EvaluationCollector
         │                                 │
         │                                 │
         └─────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
         ▼               ▼               ▼
   TraceStorage   EvaluationPipeline   TraceExporter
         │               │               │
         └───────────────┴───────────────┘
                         │
                         ▼
              MetricsAggregator
                         │
                         ▼
                  StatsDashboard
```

---

## 2. 数据模型

### 2.1 TraceContext - 统一追踪上下文

```typescript
/**
 * TraceContext - 统一的追踪上下文容器
 *
 * 整合 TraceVisualizer 和 EvaluationCollector 的数据
 */
interface TraceContext {
  // 基础标识
  traceId: string;                    // 唯一追踪 ID (UUID)
  sessionId: string;                  // 会话 ID (可选)
  timestamp: string;                  // 创建时间 (ISO)
  
  // 查询信息
  query: {
    raw: string;                      // 原始查询
    rewritten?: string;               // 重写后的查询
    entities?: MedicalEntities;       // 识别的医疗实体
    complexity?: ComplexityAssessment;// 复杂度评估
  };
  
  // 执行阶段 (来自 TraceVisualizer)
  phases: TraceSpan[];
  
  // 检索信息 (用于评估)
  retrieval: {
    chunks: RetrievedChunk[];         // 检索到的 chunks
    topK: number;                     // 检索参数
    threshold: number;                // 阈值
    mode: 'dense' | 'sparse' | 'hybrid'; // 检索模式
  };
  
  // LLM 调用记录
  llmCalls: LLMCallRecord[];
  
  // 生成的答案 (用于评估)
  answer: {
    text: string;                     // 答案文本
    confidence?: number;              // 答案置信度
    sources?: string[];               // 引用来源
  };
  
  // 评估结果 (由 EvaluationPipeline 填充)
  evaluation?: EvaluationResult;
  
  // 执行状态
  status: 'running' | 'completed' | 'failed';
  error?: string;
}

/**
 * TraceSpan - 单个阶段的追踪记录
 */
interface TraceSpan {
  spanId: string;                     // 阶段 ID
  parentSpanId?: string;              // 父阶段 ID (用于嵌套)
  phase: TracePhase;                  // 阶段名称
  startTime: number;                  // 开始时间 (ms)
  endTime: number;                    // 结束时间 (ms)
  durationMs: number;                 // 耗时
  
  input: unknown;                     // 输入数据
  output: unknown;                    // 输出数据
  
  metadata?: Record<string, unknown>; // 额外元数据
}

/**
 * RetrievedChunk - 检索到的 chunk (用于评估)
 */
interface RetrievedChunk {
  chunkId: string;
  content: string;                    // chunk 内容
  sourceDocumentId: string;
  sourcePage?: number;
  similarityScore: number;            // 相似度分数
  confidenceLevel: 'high' | 'medium' | 'low';
  
  // 检索来源标记
  source: 'dense' | 'sparse' | 'hybrid';
}

/**
 * LLMCallRecord - LLM 调用记录
 */
interface LLMCallRecord {
  callId: string;
  model: string;                      // 模型名称
  provider: LLMProvider;              // anthropic / openai / deepseek
  
  promptTokens?: number;              // 输入 tokens (估算)
  completionTokens?: number;          // 输出 tokens (估算)
  
  latencyMs: number;                  // 调用延迟
  phase: TracePhase;                  // 调用阶段
  
  // 可选: 记录 prompt 和 response (用于调试)
  promptPreview?: string;             // prompt 前 200 字符
  responsePreview?: string;           // response 前 200 字符
}
```

### 2.2 EvaluationResult - RAGAS 评估结果

```typescript
/**
 * EvaluationResult - RAGAS 风格的评估结果
 */
interface EvaluationResult {
  evaluationId: string;               // 评估 ID
  traceId: string;                    // 关联的追踪 ID
  timestamp: string;                  // 评估时间
  
  // RAGAS 指标
  metrics: {
    // Faithfulness: 答案是否忠实于检索内容 (关键!)
    faithfulness: {
      score: number;                  // 0.0 - 1.0
      verdicts: FaithfulnessVerdict[];// 每个声称的判定
    };
    
    // Context Relevance: 检索内容是否与问题相关
    contextRelevance: {
      score: number;                  // 0.0 - 1.0
      chunkScores: number[];          // 每个 chunk 的相关性分数
    };
    
    // Answer Relevance: 答案是否回答了问题
    answerRelevance: {
      score: number;                  // 0.0 - 1.0
      generatedQuestions: string[];   // 从答案生成的问题 (用于验证)
    };
    
    // Context Recall: 检索是否覆盖了答案需要的信息 (需要 ground truth)
    // 可选，因为需要标注数据
    contextRecall?: {
      score: number;
      groundTruth?: string;
    };
  };
  
  // 综合分数
  overallScore: number;               // 加权平均
  
  // 评估元数据
  metadata: {
    evaluatorModel: string;           // 用于评估的 LLM
    evaluationDurationMs: number;     // 评估耗时
    retryCount: number;               // 重试次数 (LLM 不稳定时)
  };
}

/**
 * FaithfulnessVerdict - 答案中每个声称的判定
 */
interface FaithfulnessVerdict {
  claim: string;                      // 答案中的声称
  verdict: 'supported' | 'unsupported' | 'partial';
  evidence?: string;                  // 支持证据 (来自 chunk)
  chunkId?: string;                   // 关联的 chunk ID
}
```

### 2.3 SQLite 存储模型

```sql
-- 追踪表
CREATE TABLE traces (
  trace_id TEXT PRIMARY KEY,
  session_id TEXT,
  timestamp TEXT NOT NULL,
  query_raw TEXT NOT NULL,
  query_rewritten TEXT,
  status TEXT NOT NULL,
  error TEXT,
  
  -- 检索信息 (JSON)
  retrieval_json TEXT,
  
  -- 答案信息 (JSON)
  answer_json TEXT,
  
  -- 摘要信息 (JSON)
  summary_json TEXT,
  
  -- 索引
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_traces_timestamp ON traces(timestamp);
CREATE INDEX idx_traces_session ON traces(session_id);
CREATE INDEX idx_traces_status ON traces(status);

-- 阶段表
CREATE TABLE spans (
  span_id TEXT PRIMARY KEY,
  trace_id TEXT NOT NULL,
  parent_span_id TEXT,
  phase TEXT NOT NULL,
  start_time INTEGER NOT NULL,
  end_time INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL,
  
  -- 输入输出 (JSON)
  input_json TEXT,
  output_json TEXT,
  metadata_json TEXT,
  
  FOREIGN KEY (trace_id) REFERENCES traces(trace_id)
);

CREATE INDEX idx_spans_trace ON spans(trace_id);
CREATE INDEX idx_spans_phase ON spans(phase);

-- LLM 调用表
CREATE TABLE llm_calls (
  call_id TEXT PRIMARY KEY,
  trace_id TEXT NOT NULL,
  span_id TEXT,
  model TEXT NOT NULL,
  provider TEXT NOT NULL,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  latency_ms INTEGER NOT NULL,
  
  FOREIGN KEY (trace_id) REFERENCES traces(trace_id),
  FOREIGN KEY (span_id) REFERENCES spans(span_id)
);

CREATE INDEX idx_llm_calls_trace ON llm_calls(trace_id);

-- 评估结果表
CREATE TABLE evaluations (
  evaluation_id TEXT PRIMARY KEY,
  trace_id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  
  -- 评估分数
  faithfulness_score REAL,
  context_relevance_score REAL,
  answer_relevance_score REAL,
  overall_score REAL,
  
  -- 详细评估 (JSON)
  metrics_json TEXT,
  
  -- 元数据 (JSON)
  metadata_json TEXT,
  
  FOREIGN KEY (trace_id) REFERENCES traces(trace_id)
);

CREATE INDEX idx_evaluations_trace ON evaluations(trace_id);
CREATE INDEX idx_evaluations_timestamp ON evaluations(timestamp);

-- 评估历史趋势查询视图
CREATE VIEW evaluation_trends AS
SELECT 
  DATE(timestamp) as date,
  COUNT(*) as total_evaluations,
  AVG(faithfulness_score) as avg_faithfulness,
  AVG(context_relevance_score) as avg_context_relevance,
  AVG(answer_relevance_score) as avg_answer_relevance,
  AVG(overall_score) as avg_overall
FROM evaluations
GROUP BY DATE(timestamp)
ORDER BY date DESC;
```

---

## 3. 核心模块设计

### 3.1 TraceContext (新增)

```typescript
// src/tracing/TraceContext.ts

import { v4 as uuidv4 } from 'uuid';
import type { TraceSpan, RetrievedChunk, LLMCallRecord } from './types.js';

/**
 * TraceContext - 统一的追踪上下文容器
 *
 * 在 Agent 执行过程中累积追踪数据，最终持久化到 SQLite
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
  };
  
  private answerData?: {
    text: string;
    confidence?: number;
    sources?: string[];
  };
  
  private status: 'running' | 'completed' | 'failed' = 'running';
  private error?: string;
  
  constructor(sessionId?: string) {
    this.traceId = uuidv4();
    this.sessionId = sessionId;
    this.timestamp = new Date().toISOString();
  }
  
  /**
   * 设置查询信息
   */
  setQuery(raw: string, rewritten?: string): void {
    this.queryData = { raw, rewritten };
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
   * 记录阶段
   */
  recordSpan(span: TraceSpan): void {
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
    this.answerData = { text: answer, confidence, sources };
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
   * 构建完整的追踪数据
   */
  build(): TraceContextData {
    return {
      traceId: this.traceId,
      sessionId: this.sessionId,
      timestamp: this.timestamp,
      query: this.queryData,
      phases: this.spans,
      retrieval: {
        chunks: this.retrievalChunks,
        // 从检索阶段推断
        topK: this.retrievalChunks.length,
        threshold: 0.3, // 默认值
        mode: 'hybrid',
      },
      llmCalls: this.llmCalls,
      answer: this.answerData ?? { text: '' },
      evaluation: undefined, // 由 EvaluationPipeline 填充
      status: this.status,
      error: this.error,
    };
  }
  
  /**
   * 获取追踪 ID
   */
  getTraceId(): string {
    return this.traceId;
  }
}
```

### 3.2 TraceStorage (新增)

```typescript
// src/tracing/TraceStorage.ts

import Database from 'better-sqlite3';
import type { TraceContextData, TraceSpan, LLMCallRecord, EvaluationResult } from './types.js';

/**
 * TraceStorage - SQLite 持久化存储
 *
 * 提供追踪数据的 CRUD 操作
 */
export class TraceStorage {
  private db: Database.Database;
  private dbPath: string;
  
  constructor(dbPath: string = './data/traces.db') {
    this.dbPath = dbPath;
    this.db = new Database(dbPath);
    this.initSchema();
  }
  
  /**
   * 初始化数据库 schema
   */
  private initSchema(): void {
    // 执行上面的 SQL schema
    this.db.exec(SCHEMA_SQL);
  }
  
  /**
   * 保存追踪数据
   */
  saveTrace(trace: TraceContextData): void {
    const stmt = this.db.prepare(`
      INSERT INTO traces (
        trace_id, session_id, timestamp, query_raw, query_rewritten,
        status, error, retrieval_json, answer_json, summary_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      trace.traceId,
      trace.sessionId ?? null,
      trace.timestamp,
      trace.query.raw,
      trace.query.rewritten ?? null,
      trace.status,
      trace.error ?? null,
      JSON.stringify(trace.retrieval),
      JSON.stringify(trace.answer),
      JSON.stringify({
        totalDurationMs: trace.phases.reduce((sum, p) => sum + p.durationMs, 0),
        llmCallCount: trace.llmCalls.length,
        retrievalCount: trace.retrieval.chunks.length,
      }),
      Date.now()
    );
    
    // 保存 spans
    this.saveSpans(trace.traceId, trace.phases);
    
    // 保存 llm_calls
    this.saveLLMCalls(trace.traceId, trace.llmCalls);
  }
  
  /**
   * 保存阶段数据
   */
  private saveSpans(traceId: string, spans: TraceSpan[]): void {
    const stmt = this.db.prepare(`
      INSERT INTO spans (
        span_id, trace_id, parent_span_id, phase, start_time, end_time,
        duration_ms, input_json, output_json, metadata_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    for (const span of spans) {
      stmt.run(
        span.spanId,
        traceId,
        span.parentSpanId ?? null,
        span.phase,
        span.startTime,
        span.endTime,
        span.durationMs,
        JSON.stringify(span.input),
        JSON.stringify(span.output),
        JSON.stringify(span.metadata ?? {})
      );
    }
  }
  
  /**
   * 保存 LLM 调用数据
   */
  private saveLLMCalls(traceId: string, calls: LLMCallRecord[]): void {
    const stmt = this.db.prepare(`
      INSERT INTO llm_calls (
        call_id, trace_id, span_id, model, provider, prompt_tokens,
        completion_tokens, latency_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    for (const call of calls) {
      stmt.run(
        call.callId,
        traceId,
        call.phase ?? null,
        call.model,
        call.provider,
        call.promptTokens ?? null,
        call.completionTokens ?? null,
        call.latencyMs
      );
    }
  }
  
  /**
   * 保存评估结果
   */
  saveEvaluation(result: EvaluationResult): void {
    const stmt = this.db.prepare(`
      INSERT INTO evaluations (
        evaluation_id, trace_id, timestamp, faithfulness_score,
        context_relevance_score, answer_relevance_score, overall_score,
        metrics_json, metadata_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      result.evaluationId,
      result.traceId,
      result.timestamp,
      result.metrics.faithfulness.score,
      result.metrics.contextRelevance.score,
      result.metrics.answerRelevance.score,
      result.overallScore,
      JSON.stringify(result.metrics),
      JSON.stringify(result.metadata)
    );
  }
  
  /**
   * 查询追踪记录
   */
  getTrace(traceId: string): TraceContextData | null {
    // 实现查询逻辑...
  }
  
  /**
   * 查询最近的追踪记录
   */
  getRecentTraces(limit: number = 50): TraceContextData[] {
    // 实现查询逻辑...
  }
  
  /**
   * 查询评估趋势
   */
  getEvaluationTrends(days: number = 30): EvaluationTrendData[] {
    const stmt = this.db.prepare(`
      SELECT * FROM evaluation_trends
      WHERE date >= DATE('now', '-${days} days')
    `);
    return stmt.all() as EvaluationTrendData[];
  }
  
  /**
   * 关闭数据库连接
   */
  close(): void {
    this.db.close();
  }
}
```

### 3.3 EvaluationPipeline (新增)

```typescript
// src/evaluation/EvaluationPipeline.ts

import type { LLMCaller } from '../config/llm-config.js';
import type { EvaluationResult, TraceContextData } from './types.js';

/**
 * EvaluationPipeline - RAGAS 风格的评估流水线
 *
 * 使用 LLM-as-Judge 方法评估 RAG 系统质量
 */
export class EvaluationPipeline {
  private llmCaller: LLMCaller;
  private retryCount: number = 3;
  
  constructor(llmCaller: LLMCaller) {
    this.llmCaller = llmCaller;
  }
  
  /**
   * 评估完整追踪
   */
  async evaluate(trace: TraceContextData): Promise<EvaluationResult> {
    const startTime = Date.now();
    
    // 1. Faithfulness 评估
    const faithfulness = await this.evaluateFaithfulness(
      trace.answer.text,
      trace.retrieval.chunks.map(c => c.content)
    );
    
    // 2. Context Relevance 评估
    const contextRelevance = await this.evaluateContextRelevance(
      trace.query.raw,
      trace.retrieval.chunks.map(c => c.content)
    );
    
    // 3. Answer Relevance 评估
    const answerRelevance = await this.evaluateAnswerRelevance(
      trace.query.raw,
      trace.answer.text
    );
    
    // 计算综合分数 (加权平均)
    const overallScore = this.calculateOverallScore({
      faithfulness: faithfulness.score,
      contextRelevance: contextRelevance.score,
      answerRelevance: answerRelevance.score,
    });
    
    return {
      evaluationId: uuidv4(),
      traceId: trace.traceId,
      timestamp: new Date().toISOString(),
      metrics: {
        faithfulness,
        contextRelevance,
        answerRelevance,
      },
      overallScore,
      metadata: {
        evaluatorModel: 'deepseek-reasoner',
        evaluationDurationMs: Date.now() - startTime,
        retryCount: 0,
      },
    };
  }
  
  /**
   * Faithfulness 评估
   *
   * 判断答案中的每个声称是否被检索内容支持
   */
  private async evaluateFaithfulness(
    answer: string,
    contexts: string[]
  ): Promise<{ score: number; verdicts: FaithfulnessVerdict[] }> {
    // Step 1: 从答案中提取声称
    const claims = await this.extractClaims(answer);
    
    // Step 2: 对每个声称判断是否被支持
    const verdicts: FaithfulnessVerdict[] = [];
    
    for (const claim of claims) {
      const verdict = await this.judgeClaimSupport(claim, contexts);
      verdicts.push(verdict);
    }
    
    // Step 3: 计算分数 (supported / total)
    const supportedCount = verdicts.filter(v => v.verdict === 'supported').length;
    const score = verdicts.length > 0 ? supportedCount / verdicts.length : 1.0;
    
    return { score, verdicts };
  }
  
  /**
   * Context Relevance 评估
   *
   * 判断检索内容是否与问题相关
   */
  private async evaluateContextRelevance(
    query: string,
    contexts: string[]
  ): Promise<{ score: number; chunkScores: number[] }> {
    const chunkScores: number[] = [];
    
    for (const context of contexts) {
      const relevance = await this.judgeContextRelevance(query, context);
      chunkScores.push(relevance);
    }
    
    // 平均分数
    const score = chunkScores.length > 0
      ? chunkScores.reduce((a, b) => a + b, 0) / chunkScores.length
      : 0;
    
    return { score, chunkScores };
  }
  
  /**
   * Answer Relevance 评估
   *
   * 判断答案是否回答了问题
   * 方法: 从答案生成问题，看是否与原问题相似
   */
  private async evaluateAnswerRelevance(
    query: string,
    answer: string
  ): Promise<{ score: number; generatedQuestions: string[] }> {
    // Step 1: 从答案生成可能的问题
    const generatedQuestions = await this.generateQuestionsFromAnswer(answer, 3);
    
    // Step 2: 判断生成的问题与原问题的相似度
    const similarities = await Promise.all(
      generatedQuestions.map(q => this.judgeQuestionSimilarity(query, q))
    );
    
    // Step 3: 取最高相似度
    const score = Math.max(...similarities, 0);
    
    return { score, generatedQuestions };
  }
  
  /**
   * 从答案中提取声称
   */
  private async extractClaims(answer: string): Promise<string[]> {
    const prompt = `
请从以下答案中提取所有事实性声称。每个声称应该是一个独立的、可以验证的陈述。

答案:
${answer}

请以 JSON 数组格式输出，每个元素是一个声称字符串。
例如: ["声称1", "声称2", "声称3"]

只输出 JSON 数组，不要其他内容。
`;
    
    const response = await this.callLLMWithRetry(prompt);
    
    try {
      return JSON.parse(response);
    } catch {
      // 如果解析失败，尝试简单的句子分割
      return answer.split(/[。！？.!?]/).filter(s => s.trim().length > 5);
    }
  }
  
  /**
   * 判断声称是否被上下文支持
   */
  private async judgeClaimSupport(
    claim: string,
    contexts: string[]
  ): Promise<FaithfulnessVerdict> {
    const prompt = `
请判断以下声称是否被提供的上下文内容支持。

声称: "${claim}"

上下文内容:
${contexts.join('\n---\n')}

请以 JSON 格式输出:
{
  "verdict": "supported" | "unsupported" | "partial",
  "evidence": "支持证据（如果 supported）",
  "reason": "判定理由"
}

判定标准:
- supported: 上下文中有明确的证据支持该声称
- unsupported: 上下文中没有相关证据，或证据与声称矛盾
- partial: 上下文有部分相关信息，但不完全支持

只输出 JSON，不要其他内容。
`;
    
    const response = await this.callLLMWithRetry(prompt);
    
    try {
      const result = JSON.parse(response);
      return {
        claim,
        verdict: result.verdict,
        evidence: result.evidence,
      };
    } catch {
      // 默认为 unsupported
      return { claim, verdict: 'unsupported' };
    }
  }
  
  /**
   * 判断上下文与问题的相关性
   */
  private async judgeContextRelevance(query: string, context: string): Promise<number> {
    const prompt = `
请判断以下检索内容与用户问题的相关性。

用户问题: "${query}"

检索内容: "${context.slice(0, 500)}"

请输出一个相关性分数 (0.0 到 1.0):
- 1.0: 高度相关，直接回答问题
- 0.5: 部分相关，包含有用信息但不直接
- 0.0: 不相关，没有有用信息

只输出分数数字，不要其他内容。
`;
    
    const response = await this.callLLMWithRetry(prompt);
    const score = parseFloat(response.trim());
    
    return Math.max(0, Math.min(1, score));
  }
  
  /**
   * 从答案生成问题
   */
  private async generateQuestionsFromAnswer(answer: string, count: number): Promise<string[]> {
    const prompt = `
假设你看到以下答案，请生成 ${count} 个可能导致这个答案的问题。

答案: "${answer.slice(0, 1000)}"

请以 JSON 数组格式输出 ${count} 个问题字符串。
例如: ["问题1", "问题2", "问题3"]

只输出 JSON 数组，不要其他内容。
`;
    
    const response = await this.callLLMWithRetry(prompt);
    
    try {
      return JSON.parse(response);
    } catch {
      return [];
    }
  }
  
  /**
   * 判断问题相似度
   */
  private async judgeQuestionSimilarity(q1: string, q2: string): Promise<number> {
    const prompt = `
请判断以下两个问题的语义相似度。

问题1: "${q1}"
问题2: "${q2}"

请输出相似度分数 (0.0 到 1.0):
- 1.0: 完全相同的意图
- 0.5: 相关但不完全相同
- 0.0: 完全不相关

只输出分数数字，不要其他内容。
`;
    
    const response = await this.callLLMWithRetry(prompt);
    const score = parseFloat(response.trim());
    
    return Math.max(0, Math.min(1, score));
  }
  
  /**
   * 带重试的 LLM 调用
   */
  private async callLLMWithRetry(prompt: string): Promise<string> {
    for (let i = 0; i < this.retryCount; i++) {
      try {
        return await this.llmCaller(prompt);
      } catch (error) {
        if (i === this.retryCount - 1) {
          throw error;
        }
        // 等待后重试
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
    throw new Error('LLM call failed after retries');
  }
  
  /**
   * 计算综合分数
   *
   * Faithfulness 权重最高 (医疗领域关键)
   */
  private calculateOverallScore(scores: {
    faithfulness: number;
    contextRelevance: number;
    answerRelevance: number;
  }): number {
    // 权重: faithfulness 0.4, context 0.3, answer 0.3
    return (
      scores.faithfulness * 0.4 +
      scores.contextRelevance * 0.3 +
      scores.answerRelevance * 0.3
    );
  }
}
```

### 3.4 MetricsAggregator (新增)

```typescript
// src/tracing/MetricsAggregator.ts

import type { TraceStorage } from './TraceStorage.js';

/**
 * MetricsAggregator - 整合追踪指标和评估分数
 *
 * 推送数据到 StatsDashboard
 */
export class MetricsAggregator {
  private storage: TraceStorage;
  private broadcastFn?: (event: AggregationEvent) => void;
  
  constructor(storage: TraceStorage) {
    this.storage = storage;
  }
  
  /**
   * 设置 WebSocket 广播函数
   */
  setBroadcast(fn: (event: AggregationEvent) => void): void {
    this.broadcastFn = fn;
  }
  
  /**
   * 获取评估指标摘要
   */
  getEvaluationMetrics(): EvaluationMetrics {
    const trends = this.storage.getEvaluationTrends(7);
    
    if (trends.length === 0) {
      return {
        avgFaithfulness: 0,
        avgContextRelevance: 0,
        avgAnswerRelevance: 0,
        avgOverall: 0,
        totalEvaluations: 0,
        last7Days: [],
      };
    }
    
    const latest = trends[0];
    
    return {
      avgFaithfulness: latest.avg_faithfulness,
      avgContextRelevance: latest.avg_context_relevance,
      avgAnswerRelevance: latest.avg_answer_relevance,
      avgOverall: latest.avg_overall,
      totalEvaluations: latest.total_evaluations,
      last7Days: trends,
    };
  }
  
  /**
   * 获取追踪指标摘要
   */
  getTraceMetrics(): TraceMetrics {
    // 从 traces 表查询...
  }
  
  /**
   * 推送实时更新
   */
  broadcastUpdate(trace: TraceContextData, evaluation?: EvaluationResult): void {
    if (!this.broadcastFn) return;
    
    this.broadcastFn({
      type: 'metrics:update',
      traceId: trace.traceId,
      evaluation: evaluation ? {
        overallScore: evaluation.overallScore,
        faithfulness: evaluation.metrics.faithfulness.score,
        contextRelevance: evaluation.metrics.contextRelevance.score,
        answerRelevance: evaluation.metrics.answerRelevance.score,
      } : undefined,
      trace: {
        status: trace.status,
        durationMs: trace.phases.reduce((s, p) => s + p.durationMs, 0),
        llmCallCount: trace.llmCalls.length,
      },
      timestamp: Date.now(),
    });
  }
}

interface EvaluationMetrics {
  avgFaithfulness: number;
  avgContextRelevance: number;
  avgAnswerRelevance: number;
  avgOverall: number;
  totalEvaluations: number;
  last7Days: EvaluationTrendData[];
}

interface TraceMetrics {
  totalTraces: number;
  avgDurationMs: number;
  avgLlmCallCount: number;
  successRate: number;
}

interface AggregationEvent {
  type: 'metrics:update';
  traceId: string;
  evaluation?: {
    overallScore: number;
    faithfulness: number;
    contextRelevance: number;
    answerRelevance: number;
  };
  trace?: {
    status: string;
    durationMs: number;
    llmCallCount: number;
  };
  timestamp: number;
}
```

---

## 4. 与现有系统集成

### 4.1 扩展 TraceVisualizer

```typescript
// src/medical/agent/TraceVisualizer.ts (扩展)

import { TraceContext } from '../../tracing/TraceContext.js';

export class TraceVisualizer {
  // 新增: TraceContext 实例
  private traceContext: TraceContext | null = null;
  
  /**
   * 创建新的追踪上下文 (新增)
   */
  createTraceContext(sessionId?: string): TraceContext {
    this.traceContext = new TraceContext(sessionId);
    return this.traceContext;
  }
  
  /**
   * 获取当前追踪上下文 (新增)
   */
  getTraceContext(): TraceContext | null {
    return this.traceContext;
  }
  
  /**
   * 结束阶段 (扩展)
   */
  endPhase(phase: TracePhase, input: unknown, output: unknown, metadata?: Record<string, unknown>): void {
    // 原有逻辑...
    const node: TraceNode = { ... };
    this.phases.push(node);
    
    // 新增: 同步到 TraceContext
    if (this.traceContext) {
      this.traceContext.recordSpan({
        spanId: `${phase}-${Date.now()}`,
        phase,
        startTime: this.currentPhaseStart,
        endTime: Date.now(),
        durationMs: Date.now() - this.currentPhaseStart,
        input,
        output,
        metadata,
      });
    }
  }
  
  /**
   * 收集检索结果 (新增)
   */
  collectRetrievalPhase(chunks: RetrievedChunk[]): void {
    if (this.traceContext) {
      this.traceContext.recordRetrieval(chunks);
    }
    
    // 原有的追踪逻辑...
  }
}
```

### 4.2 包装 LLMCaller

```typescript
// src/config/llm-config.ts (扩展)

import { TraceContext } from '../tracing/TraceContext.js';

/**
 * 创建带追踪的 LLMCaller
 */
export function createTracedLLMCaller(
  baseCaller: LLMCaller,
  traceContext: TraceContext,
  model: string,
  provider: LLMProvider
): LLMCaller {
  return async (prompt: string): Promise<string> => {
    const startTime = Date.now();
    
    try {
      const response = await baseCaller(prompt);
      const endTime = Date.now();
      
      // 记录 LLM 调用
      traceContext.recordLLMCall({
        callId: `llm-${Date.now()}`,
        model,
        provider,
        latencyMs: endTime - startTime,
        promptTokens: Math.ceil(prompt.length / 4),
        completionTokens: Math.ceil(response.length / 4),
        promptPreview: prompt.slice(0, 200),
        responsePreview: response.slice(0, 200),
      });
      
      return response;
    } catch (error) {
      // 记录失败的调用
      traceContext.recordLLMCall({
        callId: `llm-${Date.now()}`,
        model,
        provider,
        latencyMs: Date.now() - startTime,
      });
      
      throw error;
    }
  };
}
```

### 4.3 MedicalAgent 集成点

```typescript
// src/medical/agent/MedicalAgent.ts (集成点示例)

import { TraceContext, TraceStorage, EvaluationPipeline } from '../../tracing/index.js';

export class MedicalAgent {
  private traceVisualizer: TraceVisualizer;
  private traceStorage: TraceStorage;
  private evaluationPipeline: EvaluationPipeline;
  
  constructor() {
    this.traceVisualizer = new TraceVisualizer();
    this.traceStorage = new TraceStorage();
    this.evaluationPipeline = new EvaluationPipeline(createLLMCaller());
  }
  
  /**
   * 执行查询 (集成追踪和评估)
   */
  async execute(query: string): Promise<AgentResult> {
    // 1. 创建追踪上下文
    const traceContext = this.traceVisualizer.createTraceContext();
    
    // 2. 设置查询
    traceContext.setQuery(query);
    
    // 3. 执行 Agent (原有的逻辑)
    const result = await this.executeInternal(query, traceContext);
    
    // 4. 标记完成
    traceContext.complete();
    
    // 5. 持久化追踪数据
    const traceData = traceContext.build();
    this.traceStorage.saveTrace(traceData);
    
    // 6. 异步评估 (不阻塞主流程)
    this.evaluateAsync(traceData);
    
    return result;
  }
  
  /**
   * 异步评估
   */
  private async evaluateAsync(traceData: TraceContextData): Promise<void> {
    try {
      const evaluation = await this.evaluationPipeline.evaluate(traceData);
      
      // 持久化评估结果
      this.traceStorage.saveEvaluation(evaluation);
      
      // 推送实时更新
      this.metricsAggregator.broadcastUpdate(traceData, evaluation);
      
    } catch (error) {
      console.error('[Evaluation] Failed:', error);
      // 评估失败不影响主流程
    }
  }
}
```

### 4.4 StatsDashboard 扩展

```typescript
// src/frontend/store/statsStore.ts (扩展)

interface StatsState {
  // 原有字段...
  
  // 新增: 评估指标
  evaluationMetrics: {
    avgFaithfulness: number;
    avgContextRelevance: number;
    avgAnswerRelevance: number;
    avgOverall: number;
    totalEvaluations: number;
    last7Days: EvaluationTrendData[];
  };
  
  // 新增: 追踪指标
  traceMetrics: {
    totalTraces: number;
    avgDurationMs: number;
    avgLlmCallCount: number;
    successRate: number;
  };
}

// WebSocket 处理新增事件类型
socket.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  if (data.type === 'metrics:update') {
    // 更新评估指标
    set({ evaluationMetrics: data.evaluation });
  }
};
```

---

## 5. 评估流水线触发策略

### 5.1 触发时机

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    评估触发策略                                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Strategy 1: 异步实时评估                                                    │
│  ────────────────────────────────────────────────────────────────────────  │
│  • 每次查询后异步评估                                                        │
│  • 不阻塞主流程                                                              │
│  • 结果持久化后可通过 WebSocket 推送                                         │
│  • 适合: 开发阶段、调试                                                      │
│                                                                             │
│  Strategy 2: 批量定时评估                                                    │
│  ────────────────────────────────────────────────────────────────────────  │
│  • 每小时/每天批量评估最近的追踪                                              │
│  • 统计意义更强                                                              │
│  • 可以用更大的模型 (更准确)                                                  │
│  • 适合: 生产监控、趋势分析                                                   │
│                                                                             │
│  Strategy 3: CI/CD 回归测试                                                  │
│  ────────────────────────────────────────────────────────────────────────  │
│  • 使用固定测试集                                                            │
│  • 对比评估分数变化                                                          │
│  • 检测性能退化                                                              │
│  • 适合: 代码提交前                                                          │
│                                                                             │
│  推荐: 开发阶段用 Strategy 1，生产阶段用 Strategy 2 + 3                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 配置示例

```typescript
// src/config/evaluation-config.ts

interface EvaluationConfig {
  // 评估策略
  strategy: 'async' | 'batch' | 'ci';
  
  // 批量评估间隔 (ms)
  batchInterval: number;
  
  // 评估阈值告警
  thresholds: {
    faithfulness: number;  // 低于此值告警
    contextRelevance: number;
    answerRelevance: number;
    overall: number;
  };
  
  // LLM 评估配置
  evaluator: {
    model: string;
    provider: LLMProvider;
    retryCount: number;
  };
}

const DEFAULT_EVALUATION_CONFIG: EvaluationConfig = {
  strategy: 'async',
  batchInterval: 3600000, // 1 hour
  thresholds: {
    faithfulness: 0.7,   // 医疗领域要求高
    contextRelevance: 0.6,
    answerRelevance: 0.6,
    overall: 0.65,
  },
  evaluator: {
    model: 'deepseek-reasoner',
    provider: 'openai', // DeepSeek 用 OpenAI API 格式
    retryCount: 3,
  },
};
```

---

## 6. OpenTelemetry 导出 (可选)

### 6.1 TraceExporter

```typescript
// src/tracing/TraceExporter.ts

import type { TraceContextData, TraceSpan } from './types.js';

/**
 * OpenTelemetry span 格式
 */
interface OTLPSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind: number; // 1 = INTERNAL
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  attributes: Record<string, string | number>;
  events: OTLPEvent[];
  status: { code: number };
}

/**
 * TraceExporter - 导出为 OpenTelemetry 格式
 */
export class TraceExporter {
  /**
   * 将 TraceContextData 转换为 OTLP span
   */
  export(trace: TraceContextData): OTLPSpan[] {
    const spans: OTLPSpan[] = [];
    
    // 主 span (trace root)
    spans.push({
      traceId: trace.traceId,
      spanId: trace.traceId.slice(0, 16),
      name: `MedicalAgent.execute`,
      kind: 1,
      startTimeUnixNano: String(new Date(trace.timestamp).getTime() * 1000000),
      endTimeUnixNano: String(Date.now() * 1000000),
      attributes: {
        'query.raw': trace.query.raw,
        'query.rewritten': trace.query.rewritten ?? '',
        'status': trace.status,
      },
      events: [],
      status: { code: trace.status === 'completed' ? 1 : 2 },
    });
    
    // 子 spans (phases)
    for (const phase of trace.phases) {
      spans.push(this.exportSpan(phase, trace.traceId));
    }
    
    return spans;
  }
  
  /**
   * 转换单个 span
   */
  private exportSpan(span: TraceSpan, traceId: string): OTLPSpan {
    return {
      traceId,
      spanId: span.spanId,
      parentSpanId: span.parentSpanId ?? traceId.slice(0, 16),
      name: `MedicalAgent.${span.phase}`,
      kind: 1,
      startTimeUnixNano: String(span.startTime * 1000000),
      endTimeUnixNano: String(span.endTime * 1000000),
      attributes: {
        'duration.ms': span.durationMs,
        'phase': span.phase,
      },
      events: [],
      status: { code: 1 },
    };
  }
  
  /**
   * 导出到 OTLP collector
   */
  async exportToCollector(spans: OTLPSpan[], collectorUrl: string): Promise<void> {
    const payload = {
      resourceSpans: [{
        resource: {
          attributes: [
            { key: 'service.name', value: { stringValue: 'medical-agent-rag' } },
          ],
        },
        scopeSpans: [{
          scope: { name: 'medical-agent' },
          spans,
        }],
      }],
    };
    
    await fetch(collectorUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }
}
```

---

## 7. 测试策略

```typescript
// src/__tests__/evaluation.test.ts

describe('EvaluationPipeline', () => {
  it('should evaluate faithfulness correctly', async () => {
    const pipeline = new EvaluationPipeline(mockLLMCaller);
    
    const result = await pipeline.evaluateFaithfulness(
      '高血压患者应该每天服用降压药。',
      ['高血压是一种慢性疾病，需要长期服药控制。']
    );
    
    expect(result.score).toBeGreaterThan(0.7);
    expect(result.verdicts[0].verdict).toBe('supported');
  });
  
  it('should detect hallucination', async () => {
    const result = await pipeline.evaluateFaithfulness(
      '高血压患者应该每天吃苹果可以治愈。',
      ['高血压是一种慢性疾病，需要长期服药控制。']
    );
    
    expect(result.score).toBeLessThan(0.3);
    expect(result.verdicts[0].verdict).toBe('unsupported');
  });
});

describe('TraceStorage', () => {
  it('should persist and retrieve traces', async () => {
    const storage = new TraceStorage(':memory:');
    
    const trace = createMockTraceContext();
    storage.saveTrace(trace);
    
    const retrieved = storage.getTrace(trace.traceId);
    
    expect(retrieved).not.toBeNull();
    expect(retrieved?.query.raw).toBe(trace.query.raw);
  });
});
```

---

## 8. 实现优先级

| 阶段 | 模块 | 依赖 | 优先级 |
|------|------|------|--------|
| Phase 1.1 | TraceContext | 无 | P0 |
| Phase 1.2 | TraceStorage | TraceContext | P0 |
| Phase 1.3 | 扩展 TraceVisualizer | TraceContext | P0 |
| Phase 1.4 | 包装 LLMCaller | TraceContext | P0 |
| Phase 1.5 | EvaluationPipeline | 无 | P1 |
| Phase 1.6 | MetricsAggregator | TraceStorage | P1 |
| Phase 2.1 | StatsDashboard 扩展 | MetricsAggregator | P2 |
| Phase 2.2 | TraceExplorer UI | TraceStorage | P2 |
| Phase 2.3 | EvaluationTrendChart | MetricsAggregator | P2 |
| Phase 3.1 | TraceExporter | TraceContext | P3 |
| Phase 3.2 | 外部系统集成 | TraceExporter | P3 |