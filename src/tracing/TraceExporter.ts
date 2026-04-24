/**
 * TraceExporter - OpenTelemetry 导出器
 *
 * 将追踪数据导出为 OTLP 格式，支持推送到 OpenTelemetry Collector
 */

import type { TraceContextData, TraceSpan, RetrievedChunk } from '../tracing/types.js';

/**
 * OTLP Span 结构
 */
interface OTLPSpan {
  traceId: string;
  spanId: string;
  name: string;
  kind: number; // 1 = INTERNAL, 2 = SERVER, 3 = CLIENT, etc.
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  attributes: Record<string, string | number | boolean>;
  status: { code: number; message?: string };
  events: Array<{
    timeUnixNano: string;
    name: string;
    attributes: Record<string, string | number | boolean>;
  }>;
}

/**
 * OTLP Trace 数据
 */
interface OTLPTraceData {
  resourceSpans: Array<{
    resource: {
      attributes: Record<string, string | number | boolean>;
    };
    scopeSpans: Array<{
      scope: { name: string };
      spans: OTLPSpan[];
    }>;
  }>;
}

/**
 * Exporter 配置
 */
export interface TraceExporterConfig {
  /** Collector endpoint (e.g., http://localhost:4318) */
  endpoint?: string;
  /** Service name */
  serviceName: string;
  /** Service version */
  serviceVersion?: string;
  /** Enable export (default: true) */
  enabled?: boolean;
  /** Export timeout in ms (default: 5000) */
  timeout?: number;
}

const DEFAULT_CONFIG: TraceExporterConfig = {
  endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318',
  serviceName: 'medical-rag-agent',
  serviceVersion: '1.0.0',
  enabled: true,
  timeout: 5000,
};

/**
 * TraceExporter - OpenTelemetry 导出器
 */
export class TraceExporter {
  private config: TraceExporterConfig;

  constructor(config?: Partial<TraceExporterConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 将 TraceContextData 转换为 OTLP 格式
   */
  convertToOTLP(traceData: TraceContextData): OTLPTraceData {
    const spans: OTLPSpan[] = [];

    // 主 span（整体执行）
    const mainSpan = this.createMainSpan(traceData);
    spans.push(mainSpan);

    // 子 spans（各阶段）
    if (traceData.spans) {
      for (const span of traceData.spans) {
        const otlpSpan = this.convertSpan(span, traceData.traceId);
        spans.push(otlpSpan);
      }
    }

    // 检索子 spans
    if (traceData.retrieval?.chunks) {
      for (const chunk of traceData.retrieval.chunks) {
        const retrievalSpan = this.createRetrievalSpan(chunk, traceData.traceId);
        spans.push(retrievalSpan);
      }
    }

    return {
      resourceSpans: [
        {
          resource: {
            attributes: {
              'service.name': this.config.serviceName,
              'service.version': this.config.serviceVersion ?? '1.0.0',
              'deployment.environment': process.env.NODE_ENV ?? 'development',
            },
          },
          scopeSpans: [
            {
              scope: { name: 'medical-rag-agent' },
              spans,
            },
          ],
        },
      ],
    };
  }

  /**
   * 创建主 span
   */
  private createMainSpan(traceData: TraceContextData): OTLPSpan {
    const startTimeNano = (traceData.startTime ?? Date.now()) * 1_000_000;
    const endTimeNano = (traceData.endTime ?? Date.now()) * 1_000_000;

    return {
      traceId: this.formatTraceId(traceData.traceId),
      spanId: this.generateSpanId(),
      name: `medical-query: ${traceData.query.raw.slice(0, 50)}...`,
      kind: 1, // INTERNAL
      startTimeUnixNano: String(startTimeNano),
      endTimeUnixNano: String(endTimeNano),
      attributes: {
        'query.raw': traceData.query.raw,
        'query.rewritten': traceData.query.rewritten ?? '',
        'answer.confidence': traceData.answer?.confidence ?? 0,
        'answer.length': traceData.answer?.text?.length ?? 0,
        'status': traceData.status,
        'duration_ms': traceData.durationMs ?? 0,
        'retrieval.count': traceData.retrieval?.topK ?? 0,
      },
      status: {
        code: traceData.status === 'completed' ? 1 : 2, // Ok or Error
        ...(traceData.status === 'failed' && traceData.error && { message: traceData.error }),
      },
      events: [],
    };
  }

  /**
   * 转换子 span
   */
  private convertSpan(span: TraceSpan, traceId: string): OTLPSpan {
    const startTimeNano = span.startTime * 1_000_000;
    const endTimeNano = span.endTime * 1_000_000;

    return {
      traceId: this.formatTraceId(traceId),
      spanId: this.formatSpanId(span.spanId),
      name: span.phase,
      kind: 1, // INTERNAL
      startTimeUnixNano: String(startTimeNano),
      endTimeUnixNano: String(endTimeNano),
      attributes: {
        'phase': span.phase,
        'duration_ms': span.durationMs,
        ...this.flattenAttributes(span.metadata ?? {}),
      },
      status: {
        code: 1, // Ok
      },
      events: [],
    };
  }

  /**
   * 创建检索 span
   */
  private createRetrievalSpan(chunk: RetrievedChunk, traceId: string): OTLPSpan {
    const startTimeNano = Date.now() * 1_000_000;

    return {
      traceId: this.formatTraceId(traceId),
      spanId: this.generateSpanId(),
      name: 'retrieval.chunk',
      kind: 3, // CLIENT
      startTimeUnixNano: String(startTimeNano),
      endTimeUnixNano: String(startTimeNano + 1_000_000), // 1ms
      attributes: {
        'chunk.id': chunk.chunkId,
        'chunk.similarity': chunk.similarityScore,
        'chunk.content_length': chunk.content.length,
        ...this.flattenAttributes(chunk.metadata ?? {}),
      },
      status: {
        code: 1,
      },
      events: [],
    };
  }

  /**
   * 导出追踪数据到 Collector
   */
  async export(traceData: TraceContextData): Promise<boolean> {
    if (!this.config.enabled) {
      console.log('[TraceExporter] Export disabled');
      return false;
    }

    const otlpData = this.convertToOTLP(traceData);

    try {
      const response = await fetch(`${this.config.endpoint}/v1/traces`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(otlpData),
        signal: AbortSignal.timeout(this.config.timeout ?? 5000),
      });

      if (!response.ok) {
        console.error('[TraceExporter] Export failed:', response.status);
        return false;
      }

      console.log('[TraceExporter] Export successful:', traceData.traceId);
      return true;
    } catch (error) {
      console.error('[TraceExporter] Export error:', error);
      return false;
    }
  }

  /**
   * 批量导出追踪数据
   */
  async exportBatch(traceDataList: TraceContextData[]): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const traceData of traceDataList) {
      const result = await this.export(traceData);
      if (result) {
        success++;
      } else {
        failed++;
      }
    }

    return { success, failed };
  }

  /**
   * 格式化 TraceId（OTLP 要求 32 字符 hex）
   */
  private formatTraceId(traceId: string): string {
    // 移除非 hex 字符，填充到 32 字符
    const hex = traceId.replace(/[^a-f0-9]/g, '').padEnd(32, '0').slice(0, 32);
    return hex;
  }

  /**
   * 格式化 SpanId（OTLP 要求 16 字符 hex）
   */
  private formatSpanId(spanId: string): string {
    const hex = spanId.replace(/[^a-f0-9]/g, '').padEnd(16, '0').slice(0, 16);
    return hex;
  }

  /**
   * 生成随机 SpanId
   */
  private generateSpanId(): string {
    return Array.from({ length: 16 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
  }

  /**
   * 展平属性对象
   */
  private flattenAttributes(obj: Record<string, unknown>, prefix = ''): Record<string, string | number | boolean> {
    const result: Record<string, string | number | boolean> = {};

    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        result[fullKey] = value;
      } else if (typeof value === 'object' && value !== null) {
        const flattened = this.flattenAttributes(value as Record<string, unknown>, fullKey);
        Object.assign(result, flattened);
      }
    }

    return result;
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<TraceExporterConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取当前配置
   */
  getConfig(): TraceExporterConfig {
    return this.config;
  }
}

/**
 * 创建 TraceExporter
 */
export function createTraceExporter(config?: Partial<TraceExporterConfig>): TraceExporter {
  return new TraceExporter(config);
}