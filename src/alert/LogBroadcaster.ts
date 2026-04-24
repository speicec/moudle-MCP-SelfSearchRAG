/**
 * LogBroadcaster - 告警日志广播器
 *
 * 将告警事件记录到日志，用于调试和审计
 */

import type { AlertEvent, AlertSeverity } from './types.js';

/**
 * Log format options
 */
export type LogFormat = 'json' | 'text';

/**
 * LogBroadcaster - 日志广播器
 *
 * 功能：
 * - 将告警事件输出到 console 或文件
 * - 支持不同日志格式（JSON / 文本）
 * - 根据严重程度使用不同的日志级别
 * - 可作为 WebSocket 不可用时的 fallback
 */
export class LogBroadcaster {
  private format: LogFormat;
  private includeDetails: boolean;

  constructor(options?: { format?: LogFormat; includeDetails?: boolean }) {
    this.format = options?.format ?? 'text';
    this.includeDetails = options?.includeDetails ?? true;
  }

  /**
   * 广播告警事件（记录日志）
   *
   * @param event - 告警事件
   */
  broadcast(event: { type: string; alert: AlertEvent }): void {
    const severity = event.alert.severity;
    const logMethod = this.getLogMethod(severity);

    if (this.format === 'json') {
      this.logJson(logMethod, event);
    } else {
      this.logText(logMethod, event);
    }
  }

  /**
   * 广播新告警
   */
  broadcastNew(alert: AlertEvent): void {
    this.broadcast({ type: 'alert:new', alert });
  }

  /**
   * 广播告警更新
   */
  broadcastUpdate(alert: AlertEvent): void {
    this.broadcast({ type: 'alert:update', alert });
  }

  /**
   * 广播告警解决
   */
  broadcastResolved(alert: AlertEvent): void {
    this.broadcast({ type: 'alert:resolved', alert });
  }

  /**
   * 获取日志方法
   */
  private getLogMethod(severity: AlertSeverity): (...args: unknown[]) => void {
    switch (severity) {
      case 'critical':
        return console.error;
      case 'warning':
        return console.warn;
      case 'info':
        return console.info;
      default:
        return console.log;
    }
  }

  /**
   * JSON 格式日志
   */
  private logJson(logMethod: (...args: unknown[]) => void, event: { type: string; alert: AlertEvent }): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      eventType: event.type,
      alert: {
        alertId: event.alert.alertId,
        type: event.alert.type,
        severity: event.alert.severity,
        status: event.alert.status,
        traceId: event.alert.traceId,
        evaluationId: event.alert.evaluationId,
        ...(this.includeDetails && { details: event.alert.details }),
        suggestedActions: event.alert.suggestedActions,
      },
    };

    logMethod(JSON.stringify(logEntry));
  }

  /**
   * 文本格式日志
   */
  private logText(logMethod: (...args: unknown[]) => void, event: { type: string; alert: AlertEvent }): void {
    const alert = event.alert;
    const header = `[${alert.severity.toUpperCase()}] ${alert.type} - ${alert.alertId}`;

    const lines = [
      header,
      `  Timestamp: ${alert.timestamp}`,
      `  Status: ${alert.status}`,
      ...(alert.traceId ? [`  Trace ID: ${alert.traceId}`] : []),
      ...(alert.evaluationId ? [`  Evaluation ID: ${alert.evaluationId}`] : []),
    ];

    if (this.includeDetails) {
      lines.push('  Details:');
      for (const [key, value] of Object.entries(alert.details as Record<string, unknown>)) {
        lines.push(`    ${key}: ${JSON.stringify(value)}`);
      }
    }

    lines.push('  Suggested Actions:');
    for (const action of alert.suggestedActions) {
      lines.push(`    - ${action}`);
    }

    logMethod(lines.join('\n'));
  }
}

/**
 * 创建日志广播器
 */
export function createLogBroadcaster(options?: { format?: LogFormat; includeDetails?: boolean }): LogBroadcaster {
  return new LogBroadcaster(options);
}