/**
 * TraceStorage - SQLite 持久化存储
 *
 * 使用 sql.js (纯 JS SQLite 实现) 存储追踪数据和评估结果
 */

import initSqlJs, { type Database } from 'sql.js';
import type {
  TraceContextData,
  TraceSpan,
  LLMCallRecord,
  EvaluationResult,
  EvaluationTrendData,
} from './types.js';
import type {
  AlertEvent,
  AlertStatus,
  ReviewItem,
  ReviewStatus,
  ScaleEvent,
} from '../alert/types.js';

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

-- 告警表 (AlertHandler)
CREATE TABLE IF NOT EXISTS alerts (
  alert_id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  type TEXT NOT NULL,
  severity TEXT NOT NULL,
  trace_id TEXT,
  evaluation_id TEXT,
  details_json TEXT,
  suggested_actions_json TEXT,
  status TEXT DEFAULT 'active',
  acknowledged_by TEXT,
  resolved_at TEXT
);

-- 告警索引
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
CREATE INDEX IF NOT EXISTS idx_alerts_type ON alerts(type);
CREATE INDEX IF NOT EXISTS idx_alerts_timestamp ON alerts(timestamp);

-- 人工审核队列表 (HumanReviewQueue)
CREATE TABLE IF NOT EXISTS human_review_queue (
  review_id TEXT PRIMARY KEY,
  trace_id TEXT NOT NULL,
  evaluation_id TEXT NOT NULL,
  alert_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  priority TEXT NOT NULL DEFAULT 'medium',
  created_at TEXT NOT NULL,
  assigned_to TEXT,
  reviewed_at TEXT,
  resolved_at TEXT,
  review_notes TEXT,
  result TEXT,
  details_json TEXT NOT NULL
);

-- 审核队列索引
CREATE INDEX IF NOT EXISTS idx_review_status ON human_review_queue(status);
CREATE INDEX IF NOT EXISTS idx_review_priority ON human_review_queue(priority);
CREATE INDEX IF NOT EXISTS idx_review_created ON human_review_queue(created_at);

-- 扩缩容事件表 (EvaluationAutoscaler)
CREATE TABLE IF NOT EXISTS scale_events (
  event_id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  type TEXT NOT NULL,
  from_replicas INTEGER NOT NULL,
  to_replicas INTEGER NOT NULL,
  reason TEXT NOT NULL,
  triggered_by TEXT NOT NULL,
  success INTEGER NOT NULL DEFAULT 1,
  error TEXT
);

-- 扩缩容事件索引
CREATE INDEX IF NOT EXISTS idx_scale_timestamp ON scale_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_scale_type ON scale_events(type);
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

  // ==================== Alert Methods ====================

  /**
   * 保存告警
   */
  async saveAlert(alert: AlertEvent): Promise<void> {
    this.ensureInit();

    this.db!.run(
      `INSERT OR REPLACE INTO alerts (
        alert_id, timestamp, type, severity, trace_id, evaluation_id,
        details_json, suggested_actions_json, status, acknowledged_by, resolved_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        alert.alertId,
        alert.timestamp,
        alert.type,
        alert.severity,
        alert.traceId ?? null,
        alert.evaluationId ?? null,
        JSON.stringify(alert.details),
        JSON.stringify(alert.suggestedActions),
        alert.status,
        alert.acknowledgedBy ?? null,
        alert.resolvedAt ?? null,
      ]
    );

    await this.persist();
  }

  /**
   * 查询告警列表
   */
  getAlerts(options?: {
    status?: AlertStatus;
    type?: string;
    limit?: number;
    offset?: number;
  }): AlertEvent[] {
    this.ensureInit();

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (options?.status) {
      conditions.push('status = ?');
      params.push(options.status);
    }
    if (options?.type) {
      conditions.push('type = ?');
      params.push(options.type);
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    const limitClause = options?.limit
      ? `LIMIT ${options.limit}${options?.offset ? ` OFFSET ${options.offset}` : ''}`
      : '';

    const rows = this.db!.exec(
      `SELECT * FROM alerts ${whereClause} ORDER BY timestamp DESC ${limitClause}`,
      params
    );

    if (rows.length === 0 || !rows[0]?.values) return [];

    const result = rows[0];
    return result.values.map((row: unknown[]) => {
      const columns = result.columns;
      const getValue = (colName: string) => row[columns.indexOf(colName)];

      const traceIdValue = getValue('trace_id') as string | null;
      const evaluationIdValue = getValue('evaluation_id') as string | null;
      const acknowledgedByValue = getValue('acknowledged_by') as string | null;
      const resolvedAtValue = getValue('resolved_at') as string | null;

      return {
        alertId: getValue('alert_id') as string,
        timestamp: getValue('timestamp') as string,
        type: getValue('type') as AlertEvent['type'],
        severity: getValue('severity') as AlertEvent['severity'],
        ...(traceIdValue && { traceId: traceIdValue }),
        ...(evaluationIdValue && { evaluationId: evaluationIdValue }),
        details: JSON.parse(getValue('details_json') as string || '{}'),
        suggestedActions: JSON.parse(getValue('suggested_actions_json') as string || '[]'),
        status: getValue('status') as AlertStatus,
        ...(acknowledgedByValue && { acknowledgedBy: acknowledgedByValue }),
        ...(resolvedAtValue && { resolvedAt: resolvedAtValue }),
      };
    });
  }

  /**
   * 查询单个告警
   */
  getAlert(alertId: string): AlertEvent | null {
    const alerts = this.getAlerts({ limit: 1 });
    const rows = this.db!.exec(
      'SELECT * FROM alerts WHERE alert_id = ?',
      [alertId]
    );

    if (rows.length === 0 || !rows[0]?.values || rows[0].values.length === 0) {
      return null;
    }

    const result = rows[0];
    const row = result.values[0];
    if (!row) return null;

    const columns = result.columns;
    const getValue = (colName: string) => row[columns.indexOf(colName)];

    const traceIdValue = getValue('trace_id') as string | null;
    const evaluationIdValue = getValue('evaluation_id') as string | null;
    const acknowledgedByValue = getValue('acknowledged_by') as string | null;
    const resolvedAtValue = getValue('resolved_at') as string | null;

    return {
      alertId: getValue('alert_id') as string,
      timestamp: getValue('timestamp') as string,
      type: getValue('type') as AlertEvent['type'],
      severity: getValue('severity') as AlertEvent['severity'],
      ...(traceIdValue && { traceId: traceIdValue }),
      ...(evaluationIdValue && { evaluationId: evaluationIdValue }),
      details: JSON.parse(getValue('details_json') as string || '{}'),
      suggestedActions: JSON.parse(getValue('suggested_actions_json') as string || '[]'),
      status: getValue('status') as AlertStatus,
      ...(acknowledgedByValue && { acknowledgedBy: acknowledgedByValue }),
      ...(resolvedAtValue && { resolvedAt: resolvedAtValue }),
    };
  }

  /**
   * 确认告警
   */
  async acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<void> {
    this.ensureInit();

    this.db!.run(
      `UPDATE alerts SET status = 'acknowledged', acknowledged_by = ? WHERE alert_id = ?`,
      [acknowledgedBy, alertId]
    );

    await this.persist();
  }

  /**
   * 解决告警
   */
  async resolveAlert(alertId: string): Promise<void> {
    this.ensureInit();

    this.db!.run(
      `UPDATE alerts SET status = 'resolved', resolved_at = ? WHERE alert_id = ?`,
      [new Date().toISOString(), alertId]
    );

    await this.persist();
  }

  // ==================== Review Methods ====================

  /**
   * 保存审核项
   */
  async saveReviewItem(item: ReviewItem): Promise<void> {
    this.ensureInit();

    this.db!.run(
      `INSERT OR REPLACE INTO human_review_queue (
        review_id, trace_id, evaluation_id, alert_id, status, priority,
        created_at, assigned_to, reviewed_at, resolved_at, review_notes,
        result, details_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        item.reviewId,
        item.traceId,
        item.evaluationId,
        item.alertId ?? null,
        item.status,
        item.priority,
        item.createdAt,
        item.assignedTo ?? null,
        item.reviewedAt ?? null,
        item.resolvedAt ?? null,
        item.reviewNotes ?? null,
        item.result ?? null,
        JSON.stringify(item.details),
      ]
    );

    await this.persist();
  }

  /**
   * 查询审核项列表
   */
  getReviewItems(options?: {
    status?: ReviewStatus;
    priority?: string;
    limit?: number;
    offset?: number;
  }): ReviewItem[] {
    this.ensureInit();

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (options?.status) {
      conditions.push('status = ?');
      params.push(options.status);
    }
    if (options?.priority) {
      conditions.push('priority = ?');
      params.push(options.priority);
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    const limitClause = options?.limit
      ? `LIMIT ${options.limit}${options?.offset ? ` OFFSET ${options.offset}` : ''}`
      : '';

    const rows = this.db!.exec(
      `SELECT * FROM human_review_queue ${whereClause} ORDER BY
        CASE priority
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
        END,
        created_at DESC ${limitClause}`,
      params
    );

    if (rows.length === 0 || !rows[0]?.values) return [];

    const result = rows[0];
    return result.values.map((row: unknown[]) => {
      const columns = result.columns;
      const getValue = (colName: string) => row[columns.indexOf(colName)];

      const alertIdValue = getValue('alert_id') as string | null;
      const assignedToValue = getValue('assigned_to') as string | null;
      const reviewedAtValue = getValue('reviewed_at') as string | null;
      const resolvedAtValue = getValue('resolved_at') as string | null;
      const reviewNotesValue = getValue('review_notes') as string | null;
      const resultValue = getValue('result') as string | null;

      return {
        reviewId: getValue('review_id') as string,
        traceId: getValue('trace_id') as string,
        evaluationId: getValue('evaluation_id') as string,
        ...(alertIdValue && { alertId: alertIdValue }),
        status: getValue('status') as ReviewStatus,
        priority: getValue('priority') as ReviewItem['priority'],
        createdAt: getValue('created_at') as string,
        ...(assignedToValue && { assignedTo: assignedToValue }),
        ...(reviewedAtValue && { reviewedAt: reviewedAtValue }),
        ...(resolvedAtValue && { resolvedAt: resolvedAtValue }),
        ...(reviewNotesValue && { reviewNotes: reviewNotesValue }),
        ...(resultValue && { result: resultValue as 'approved' | 'rejected' | 'modified' }),
        details: JSON.parse(getValue('details_json') as string || '{}'),
      };
    });
  }

  /**
   * 获取审核项计数
   */
  getReviewCount(status?: ReviewStatus): number {
    this.ensureInit();

    const rows = this.db!.exec(
      status
        ? 'SELECT COUNT(*) as count FROM human_review_queue WHERE status = ?'
        : 'SELECT COUNT(*) as count FROM human_review_queue',
      status ? [status] : []
    );

    if (rows.length === 0 || !rows[0]?.values || !rows[0].values[0]) return 0;
    return rows[0].values[0][0] as number;
  }

  /**
   * 更新审核项
   */
  async updateReviewItem(
    reviewId: string,
    updates: Partial<Pick<ReviewItem, 'status' | 'assignedTo' | 'reviewedAt' | 'resolvedAt' | 'reviewNotes' | 'result'>>
  ): Promise<void> {
    this.ensureInit();

    const setClauses: string[] = [];
    const params: unknown[] = [];

    if (updates.status) {
      setClauses.push('status = ?');
      params.push(updates.status);
    }
    if (updates.assignedTo) {
      setClauses.push('assigned_to = ?');
      params.push(updates.assignedTo);
    }
    if (updates.reviewedAt) {
      setClauses.push('reviewed_at = ?');
      params.push(updates.reviewedAt);
    }
    if (updates.resolvedAt) {
      setClauses.push('resolved_at = ?');
      params.push(updates.resolvedAt);
    }
    if (updates.reviewNotes) {
      setClauses.push('review_notes = ?');
      params.push(updates.reviewNotes);
    }
    if (updates.result) {
      setClauses.push('result = ?');
      params.push(updates.result);
    }

    if (setClauses.length === 0) return;

    params.push(reviewId);
    this.db!.run(
      `UPDATE human_review_queue SET ${setClauses.join(', ')} WHERE review_id = ?`,
      params
    );

    await this.persist();
  }

  // ==================== Scale Event Methods ====================

  /**
   * 保存扩缩容事件
   */
  async saveScaleEvent(event: ScaleEvent): Promise<void> {
    this.ensureInit();

    this.db!.run(
      `INSERT INTO scale_events (
        event_id, timestamp, type, from_replicas, to_replicas,
        reason, triggered_by, success, error
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        event.eventId,
        event.timestamp,
        event.type,
        event.fromReplicas,
        event.toReplicas,
        event.reason,
        event.triggeredBy,
        event.success ? 1 : 0,
        event.error ?? null,
      ]
    );

    await this.persist();
  }

  /**
   * 查询扩缩容事件历史
   */
  getScaleEvents(limit?: number): ScaleEvent[] {
    this.ensureInit();

    const rows = this.db!.exec(
      `SELECT * FROM scale_events ORDER BY timestamp DESC ${limit ? `LIMIT ${limit}` : ''}`
    );

    if (rows.length === 0 || !rows[0]?.values) return [];

    const result = rows[0];
    return result.values.map((row: unknown[]) => {
      const columns = result.columns;
      const getValue = (colName: string) => row[columns.indexOf(colName)];

      const errorValue = getValue('error') as string | null;

      return {
        eventId: getValue('event_id') as string,
        timestamp: getValue('timestamp') as string,
        type: getValue('type') as ScaleEvent['type'],
        fromReplicas: getValue('from_replicas') as number,
        toReplicas: getValue('to_replicas') as number,
        reason: getValue('reason') as string,
        triggeredBy: getValue('triggered_by') as ScaleEvent['triggeredBy'],
        success: getValue('success') === 1,
        ...(errorValue && { error: errorValue }),
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
    this.db!.run('DELETE FROM alerts');
    this.db!.run('DELETE FROM human_review_queue');
    this.db!.run('DELETE FROM scale_events');

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
   * 获取数据库实例（用于直接查询）
   */
  getDatabase(): Database | null {
    return this.db;
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

  // ==================== Schema Helper Methods ====================

  /**
   * 获取所有表名
   */
  getTables(): string[] {
    this.ensureInit();

    const rows = this.db!.exec(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    );

    if (rows.length === 0 || !rows[0]?.values) return [];

    return rows[0].values.map(row => row[0] as string);
  }

  /**
   * 获取表的列名
   */
  getTableColumns(tableName: string): string[] {
    this.ensureInit();

    const rows = this.db!.exec(
      `PRAGMA table_info(${tableName})`
    );

    if (rows.length === 0 || !rows[0]?.values) return [];

    return rows[0].values.map(row => row[1] as string);
  }

  /**
   * 获取所有索引名
   */
  getIndexes(): string[] {
    this.ensureInit();

    const rows = this.db!.exec(
      "SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    );

    if (rows.length === 0 || !rows[0]?.values) return [];

    return rows[0].values.map(row => row[0] as string);
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