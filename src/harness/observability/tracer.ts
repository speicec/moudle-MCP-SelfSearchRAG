/**
 * @spec harness.md#链路追踪
 * @layer 5
 * @description 链路追踪实现
 */

export interface TraceSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operation: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  status: 'started' | 'completed' | 'error';
  attributes: Record<string, unknown>;
  events: Array<{ name: string; timestamp: Date; attributes?: Record<string, unknown> }>;
}

export interface ITracer {
  startSpan(operation: string, parentSpanId?: string): string;
  endSpan(spanId: string, status?: 'completed' | 'error'): void;
  addEvent(spanId: string, name: string, attributes?: Record<string, unknown>): void;
  setAttribute(spanId: string, key: string, value: unknown): void;
  getSpan(spanId: string): TraceSpan | undefined;
  getTrace(traceId: string): TraceSpan[];
  getCurrentTraceId(): string;
  setCurrentTraceId(traceId: string): void;
}

export class Tracer implements ITracer {
  private spans: Map<string, TraceSpan> = new Map();
  private traceSpans: Map<string, string[]> = new Map();
  private currentTraceId: string = this.generateId();

  startSpan(operation: string, parentSpanId?: string): string {
    const spanId = this.generateId();
    const parentSpan = parentSpanId ? this.spans.get(parentSpanId) : undefined;

    const span: TraceSpan = {
      traceId: parentSpan?.traceId || this.currentTraceId,
      spanId,
      parentSpanId,
      operation,
      startTime: new Date(),
      status: 'started',
      attributes: {},
      events: []
    };

    this.spans.set(spanId, span);

    // Track spans by trace
    const traceId = span.traceId;
    if (!this.traceSpans.has(traceId)) {
      this.traceSpans.set(traceId, []);
    }
    this.traceSpans.get(traceId)!.push(spanId);

    return spanId;
  }

  endSpan(spanId: string, status: 'completed' | 'error' = 'completed'): void {
    const span = this.spans.get(spanId);
    if (span) {
      span.endTime = new Date();
      span.duration = span.endTime.getTime() - span.startTime.getTime();
      span.status = status;
    }
  }

  addEvent(spanId: string, name: string, attributes?: Record<string, unknown>): void {
    const span = this.spans.get(spanId);
    if (span) {
      span.events.push({
        name,
        timestamp: new Date(),
        attributes
      });
    }
  }

  setAttribute(spanId: string, key: string, value: unknown): void {
    const span = this.spans.get(spanId);
    if (span) {
      span.attributes[key] = value;
    }
  }

  getSpan(spanId: string): TraceSpan | undefined {
    return this.spans.get(spanId);
  }

  getTrace(traceId: string): TraceSpan[] {
    const spanIds = this.traceSpans.get(traceId) || [];
    return spanIds.map(id => this.spans.get(id)).filter((s): s is TraceSpan => s !== undefined);
  }

  getCurrentTraceId(): string {
    return this.currentTraceId;
  }

  setCurrentTraceId(traceId: string): void {
    this.currentTraceId = traceId;
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }
}

export const tracer = new Tracer();