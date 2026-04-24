/**
 * TraceStorage - SQLite 持久化存储
 *
 * 使用 sql.js (纯 JS SQLite 实现) 存储追踪数据和评估结果
 */

import initSqlJs, { Database } from 'sql.js';
import type {
  TraceContextData,
  TraceSpan,
  LLMCallRecord,
  EvaluationResult,
  EvaluationTrendData,
} from './types.js';

/**
 * SQL Schema 定义
 */
const SCHEMA_SQL = `
-- 追踪表
CREATE TABLE IF NOT EXISTS traces (
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

  -- 索引字段
  created_at INTEGER NOT NULL
);

-- 阶段表
CREATE TABLE IF NOT EXISTS spans (
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
  metadata_json TEXT
);

-- LLM 调用表
CREATE TABLE IF NOT EXISTS llm_calls (
  call_id TEXT PRIMARY KEY,
  trace_id TEXT NOT NULL,
  span_id TEXT,
  model TEXT NOT NULL,
  provider TEXT NOT NULL,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  latency_ms INTEGER NOT NULL,
  prompt_preview TEXT,
  response_preview TEXT
);

-- 评估结果表
CREATE TABLE IF NOT EXISTS evaluations (
  evaluation_id TEXT PRIMARY KEY,
  trace_id TEXT NOT NULL,
  timestamp TEXT NOT NULL,

  -- 基础评估分数
  faithfulness_score REAL,
  context_relevance_score REAL,
  answer_relevance_score REAL,
  overall_score REAL,

  -- 详细评估 (JSON)
  metrics_json TEXT,

  -- 元数据 (JSON)
  metadata_json TEXT
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_traces_timestamp ON traces(timestamp);
CREATE INDEX IF NOT EXISTS idx_traces_session ON traces(session_id);
CREATE INDEX IF NOT EXISTS idx_traces_status ON traces(status);
CREATE INDEX IF NOT EXISTS idx_spans_trace ON spans(trace_id);
CREATE INDEX IF NOT EXISTS idx_spans_phase ON spans(phase);
CREATE INDEX IF NOT EXISTS idx_llm_calls_trace ON llm_calls(trace_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_trace ON evaluations(trace_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_timestamp ON evaluations(timestamp);
`;

/**
 * TraceStorage - SQLite 持久化存储
 *
 * 提供追踪数据的 CRUD 操作
 */
export class TraceStorage {
  private db: Database | null = null;
  private dbPath: string;
  private initialized: boolean = false;

  constructor(dbPath: string = './data/traces.db') {
    this.dbPath = dbPath;
  }

  /**
   * 初始化数据库连接
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    const SQL = await initSqlJs();

    // 尝试加载现有数据库文件
    try {
      const fs = await import('fs/promises');
      const buffer = await fs.readFile(this.dbPath);
      this.db = new SQL.Database(buffer);
    } catch {
      // 文件不存在，创建新数据库
      this.db = new SQL.Database();
    }

    // 初始化 schema
    this.db!.run(SCHEMA_SQL);
    this.initialized = true;
  }

  /**
   * 确保数据库已初始化
   */
  private ensureInit(): void {
    if (!this.initialized || !this.db) {
      throw new Error('TraceStorage not initialized. Call init() first.');
    }
  }

  /**
   * 保存追踪数据
   */
  async saveTrace(trace: TraceContextData): Promise<void> {
    this.ensureInit();

    // 计算摘要
    const summary = {
      totalDurationMs: trace.phases.reduce((sum, p) => sum + p.durationMs, 0),
      llmCallCount: trace.llmCalls.length,
      retrievalCount: trace.retrieval.chunks.length,
    };

    // 插入主记录
    this.db!.run(
      `INSERT OR REPLACE INTO traces (
        trace_id, session_id, timestamp, query_raw, query_rewritten,
        status, error, retrieval_json, answer_json, summary_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        trace.traceId,
        trace.sessionId ?? null,
        trace.timestamp,
        trace.query.raw,
        trace.query.rewritten ?? null,
        trace.status,
        trace.error ?? null,
        JSON.stringify(trace.retrieval),
        JSON.stringify(trace.answer),
        JSON.stringify(summary),
        Date.now(),
      ]
    );

    // 保存 spans
    this.saveSpans(trace.traceId, trace.phases);

    // 保存 llm_calls
    this.saveLLMCalls(trace.traceId, trace.llmCalls);

    // 持久化到文件
    await this.persist();
  }

  /**
   * 保存阶段数据
   */
  private saveSpans(traceId: string, spans: TraceSpan[]): void {
    // 先删除旧的 spans
    this.db!.run('DELETE FROM spans WHERE trace_id = ?', [traceId]);

    for (const span of spans) {
      this.db!.run(
        `INSERT INTO spans (
          span_id, trace_id, parent_span_id, phase, start_time, end_time,
          duration_ms, input_json, output_json, metadata_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          span.spanId,
          traceId,
          span.parentSpanId ?? null,
          span.phase,
          span.startTime,
          span.endTime,
          span.durationMs,
          JSON.stringify(span.input),
          JSON.stringify(span.output),
          JSON.stringify(span.metadata ?? {}),
        ]
      );
    }
  }

  /**
   * 保存 LLM 调用数据
   */
  private saveLLMCalls(traceId: string, calls: LLMCallRecord[]): void {
    // 先删除旧的 llm_calls
    this.db!.run('DELETE FROM llm_calls WHERE trace_id = ?', [traceId]);

    for (const call of calls) {
      this.db!.run(
        `INSERT INTO llm_calls (
          call_id, trace_id, span_id, model, provider, prompt_tokens,
          completion_tokens, latency_ms, prompt_preview, response_preview
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          call.callId,
          traceId,
          call.phase ?? null,
          call.model,
          call.provider,
          call.promptTokens ?? null,
          call.completionTokens ?? null,
          call.latencyMs,
          call.promptPreview ?? null,
          call.responsePreview ?? null,
        ]
      );
    }
  }

  /**
   * 保存评估结果
   */
  async saveEvaluation(result: EvaluationResult): Promise<void> {
    this.ensureInit();

    this.db!.run(
      `INSERT OR REPLACE INTO evaluations (
        evaluation_id, trace_id, timestamp, faithfulness_score,
        context_relevance_score, answer_relevance_score, overall_score,
        metrics_json, metadata_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        result.evaluationId,
        result.traceId,
        result.timestamp,
        result.metrics.faithfulness.score,
        result.metrics.contextRelevance.score,
        result.metrics.answerRelevance.score,
        result.overallScore,
        JSON.stringify(result.metrics),
        JSON.stringify(result.metadata),
      ]
    );

    await this.persist();
  }

  /**
   * 查询追踪记录
   */
  getTrace(traceId: string): TraceContextData | null {
    this.ensureInit();

    const rows = this.db!.exec(
      'SELECT * FROM traces WHERE trace_id = ?',
      [traceId]
    );

    if (rows.length === 0 || !rows[0]?.values || rows[0].values.length === 0) {
      return null;
    }

    const result = rows[0];
    const row = result.values[0];
    const columns = result.columns;

    if (!row) return null;

    // 构建结果对象
    const trace = this.buildTraceFromRow(row, columns);

    // 加载关联数据
    trace.phases = this.getSpans(traceId);
    trace.llmCalls = this.getLLMCalls(traceId);

    return trace;
  }

  /**
   * 从行数据构建 TraceContextData
   */
  private buildTraceFromRow(row: unknown[], columns: string[]): TraceContextData {
    const getValue = (colName: string) => row[columns.indexOf(colName)];

    const sessionIdValue = getValue('session_id') as string | undefined;
    const rewrittenValue = getValue('query_rewritten') as string | undefined;
    const errorValue = getValue('error') as string | undefined;

    return {
      traceId: getValue('trace_id') as string,
      ...(sessionIdValue && { sessionId: sessionIdValue }),
      timestamp: getValue('timestamp') as string,
      query: {
        raw: getValue('query_raw') as string,
        ...(rewrittenValue && { rewritten: rewrittenValue }),
      },
      phases: [],
      retrieval: JSON.parse(getValue('retrieval_json') as string || '{"chunks":[]}'),
      llmCalls: [],
      answer: JSON.parse(getValue('answer_json') as string || '{"text":""}'),
      status: getValue('status') as 'running' | 'completed' | 'failed',
      ...(errorValue && { error: errorValue }),
    };
  }

  /**
   * 获取阶段数据
   */
  private getSpans(traceId: string): TraceSpan[] {
    const rows = this.db!.exec(
      'SELECT * FROM spans WHERE trace_id = ? ORDER BY start_time',
      [traceId]
    );

    if (rows.length === 0 || !rows[0]?.values) return [];

    const result = rows[0];
    return result.values.map((row: unknown[]) => {
      const columns = result.columns;
      const getValue = (colName: string) => row[columns.indexOf(colName)];

      const parentSpanIdValue = getValue('parent_span_id') as string | undefined;
      const metadataValue = getValue('metadata_json') as string | undefined;

      return {
        spanId: getValue('span_id') as string,
        ...(parentSpanIdValue && { parentSpanId: parentSpanIdValue }),
        phase: getValue('phase') as TraceSpan['phase'],
        startTime: getValue('start_time') as number,
        endTime: getValue('end_time') as number,
        durationMs: getValue('duration_ms') as number,
        input: JSON.parse(getValue('input_json') as string || 'null'),
        output: JSON.parse(getValue('output_json') as string || 'null'),
        ...(metadataValue && metadataValue !== 'undefined' && { metadata: JSON.parse(metadataValue) }),
      };
    });
  }

  /**
   * 获取 LLM 调用数据
   */
  private getLLMCalls(traceId: string): LLMCallRecord[] {
    const rows = this.db!.exec(
      'SELECT * FROM llm_calls WHERE trace_id = ?',
      [traceId]
    );

    if (rows.length === 0 || !rows[0]?.values) return [];

    const result = rows[0];
    return result.values.map((row: unknown[]) => {
      const columns = result.columns;
      const getValue = (colName: string) => row[columns.indexOf(colName)];

      const promptTokens = getValue('prompt_tokens');
      const completionTokens = getValue('completion_tokens');
      const phase = getValue('span_id');
      const promptPreview = getValue('prompt_preview');
      const responsePreview = getValue('response_preview');

      return {
        callId: getValue('call_id') as string,
        model: getValue('model') as string,
        provider: getValue('provider') as LLMCallRecord['provider'],
        latencyMs: getValue('latency_ms') as number,
        ...(promptTokens !== null && promptTokens !== undefined && { promptTokens: promptTokens as number }),
        ...(completionTokens !== null && completionTokens !== undefined && { completionTokens: completionTokens as number }),
        ...(phase !== null && phase !== undefined && { phase: phase as string }),
        ...(promptPreview !== null && promptPreview !== undefined && { promptPreview: promptPreview as string }),
        ...(responsePreview !== null && responsePreview !== undefined && { responsePreview: responsePreview as string }),
      };
    });
  }

  /**
   * 查询最近的追踪记录
   */
  getRecentTraces(limit: number = 50): TraceContextData[] {
    this.ensureInit();

    const rows = this.db!.exec(
      'SELECT * FROM traces ORDER BY created_at DESC LIMIT ?',
      [limit]
    );

    if (rows.length === 0 || !rows[0]?.values) return [];

    const result = rows[0];
    return result.values.map(row => {
      const trace = this.buildTraceFromRow(row, result.columns);
      trace.phases = this.getSpans(trace.traceId);
      trace.llmCalls = this.getLLMCalls(trace.traceId);
      return trace;
    });
  }

  /**
   * 查询评估趋势
   */
  getEvaluationTrends(days: number = 30): EvaluationTrendData[] {
    this.ensureInit();

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const rows = this.db!.exec(
      `SELECT
        DATE(timestamp) as date,
        COUNT(*) as total_evaluations,
        AVG(faithfulness_score) as avg_faithfulness,
        AVG(context_relevance_score) as avg_context_relevance,
        AVG(answer_relevance_score) as avg_answer_relevance,
        AVG(overall_score) as avg_overall
      FROM evaluations
      WHERE timestamp >= ?
      GROUP BY DATE(timestamp)
      ORDER BY date DESC`,
      [startDate.toISOString()]
    );

    if (rows.length === 0 || !rows[0]?.values) return [];

    const result = rows[0];
    return result.values.map((row: unknown[]) => {
      const columns = result.columns;
      const getValue = (colName: string) => row[columns.indexOf(colName)];

      return {
        date: getValue('date') as string,
        total_evaluations: getValue('total_evaluations') as number,
        avg_faithfulness: getValue('avg_faithfulness') as number,
        avg_context_relevance: getValue('avg_context_relevance') as number,
        avg_answer_relevance: getValue('avg_answer_relevance') as number,
        avg_overall: getValue('avg_overall') as number,
      };
    });
  }

  /**
   * 清理旧数据
   */
  async clearOldTraces(days: number): Promise<void> {
    this.ensureInit();

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffTimestamp = cutoffDate.getTime();

    // 删除关联数据
    const traceIds = this.db!.exec(
      'SELECT trace_id FROM traces WHERE created_at < ?',
      [cutoffTimestamp]
    );

    if (traceIds.length > 0 && traceIds[0]?.values && traceIds[0].values.length > 0) {
      const result = traceIds[0];
      for (const row of result.values) {
        const traceId = row[0] as string;
        this.db!.run('DELETE FROM spans WHERE trace_id = ?', [traceId]);
        this.db!.run('DELETE FROM llm_calls WHERE trace_id = ?', [traceId]);
        this.db!.run('DELETE FROM evaluations WHERE trace_id = ?', [traceId]);
      }
    }

    // 删除主记录
    this.db!.run('DELETE FROM traces WHERE created_at < ?', [cutoffTimestamp]);

    await this.persist();
  }

  /**
   * 清理所有数据
   */
  async clear(): Promise<void> {
    this.ensureInit();

    this.db!.run('DELETE FROM spans');
    this.db!.run('DELETE FROM llm_calls');
    this.db!.run('DELETE FROM evaluations');
    this.db!.run('DELETE FROM traces');

    await this.persist();
  }

  /**
   * 持久化到文件
   */
  private async persist(): Promise<void> {
    if (!this.db) return;

    // 跳过内存数据库
    if (this.dbPath === ':memory:') return;

    try {
      const fs = await import('fs/promises');
      const path = await import('path');

      // 确保目录存在
      const dir = path.dirname(this.dbPath);
      await fs.mkdir(dir, { recursive: true });

      // 写入数据库文件
      const data = this.db.export();
      await fs.writeFile(this.dbPath, Buffer.from(data));
    } catch (error) {
      console.error('[TraceStorage] Failed to persist:', error);
    }
  }

  /**
   * 关闭数据库连接
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.initialized = false;
    }
  }
}

/**
 * 创建 TraceStorage 实例
 */
export async function createTraceStorage(dbPath?: string): Promise<TraceStorage> {
  const storage = new TraceStorage(dbPath);
  await storage.init();
  return storage;
}