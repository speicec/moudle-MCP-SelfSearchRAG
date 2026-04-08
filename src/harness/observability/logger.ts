/**
 * @spec harness.md#观测审计
 * @layer 5
 * @description 日志系统实现
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  traceId?: string;
}

export interface ILogger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>, error?: Error): void;
  setTraceId(traceId: string): void;
  getLogs(): LogEntry[];
}

export class Logger implements ILogger {
  private logs: LogEntry[] = [];
  private currentTraceId?: string;
  private maxLogs: number = 1000;

  debug(message: string, context?: Record<string, unknown>): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log('warn', message, context);
  }

  error(message: string, context?: Record<string, unknown>, error?: Error): void {
    this.log('error', message, {
      ...context,
      error: error?.message,
      stack: error?.stack
    });
  }

  setTraceId(traceId: string): void {
    this.currentTraceId = traceId;
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  private log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      context,
      traceId: this.currentTraceId
    };

    this.logs.push(entry);

    // Keep only last maxLogs entries
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Console output
    const prefix = `[${entry.timestamp.toISOString()}] [${level.toUpperCase()}]`;
    const tracePrefix = this.currentTraceId ? `[${this.currentTraceId}]` : '';
    const contextStr = context ? ` ${JSON.stringify(context)}` : '';

    switch (level) {
      case 'error':
        console.error(`${prefix}${tracePrefix} ${message}${contextStr}`);
        break;
      case 'warn':
        console.warn(`${prefix}${tracePrefix} ${message}${contextStr}`);
        break;
      case 'debug':
        // Only log debug in development
        if (process.env.NODE_ENV === 'development') {
          console.log(`${prefix}${tracePrefix} ${message}${contextStr}`);
        }
        break;
      default:
        console.log(`${prefix}${tracePrefix} ${message}${contextStr}`);
    }
  }
}

export const logger = new Logger();