/**
 * Agent Logger - Agent 执行日志系统
 *
 * 记录每轮 Think/Act/Observe/Decide，用于调试和审计
 */

import type {
  AgentState,
  AgentAction,
  AgentDecision,
  Observation,
  ReasoningStep,
} from './types.js';

/**
 * 日志级别
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * 日志条目
 */
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  agentId: string;
  iteration: number;
  phase: 'think' | 'act' | 'observe' | 'decide' | 'answer' | 'complete';
  message: string;
  data?: Record<string, unknown>;
}

/**
 * Agent 执行日志
 */
export interface AgentExecutionLog {
  agentId: string;
  query: string;
  startTime: string;
  endTime?: string;
  totalDurationMs?: number;
  entries: LogEntry[];
  summary: {
    totalIterations: number;
    totalActions: number;
    retrievalCalls: number;
    llmCalls: number;
    finalStatus: 'completed' | 'failed' | 'max_iterations';
    satisfied: boolean;
  };
}

/**
 * AgentLogger - Agent 日志记录器
 */
export class AgentLogger {
  private agentId: string;
  private query: string = '';
  private startTime: string;
  private entries: LogEntry[] = [];
  private logLevel: LogLevel = 'info';

  constructor(agentId: string = `agent-${Date.now()}`, logLevel: LogLevel = 'info') {
    this.agentId = agentId;
    this.startTime = new Date().toISOString();
    this.logLevel = logLevel;
  }

  /**
   * 设置查询
   */
  setQuery(query: string): void {
    this.query = query;
  }

  /**
   * 记录日志
   */
  log(
    iteration: number,
    phase: LogEntry['phase'],
    message: string,
    data?: Record<string, unknown>,
    level: LogLevel = 'info',
  ): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      agentId: this.agentId,
      iteration,
      phase,
      message,
    };
    if (data !== undefined) {
      entry.data = data;
    }

    this.entries.push(entry);

    // 输出到控制台（根据级别）
    if (this.shouldLog(level)) {
      const prefix = `[${this.agentId}] [${phase}]`;
      console.log(`${prefix} ${message}`, data ?? '');
    }
  }

  /**
   * 记录 Think 阶段
   */
  logThink(state: AgentState, decision: AgentDecision): void {
    this.log(state.iteration, 'think', 'LLM decision received', {
      action: decision.action,
      confidence: decision.confidence,
      reason: decision.reason.slice(0, 100),
    });
  }

  /**
   * 记录 Act 阶段
   */
  logAct(state: AgentState, action: AgentAction): void {
    this.log(state.iteration, 'act', `Executing action: ${action.type}`, {
      actionType: action.type,
      reason: action.reason,
      params: action.params,
    });
  }

  /**
   * 记录 Observe 阶段
   */
  logObserve(state: AgentState, observation: Observation): void {
    this.log(state.iteration, 'observe', 'Observation received', {
      observationType: observation.type,
      success: observation.success,
      message: observation.message,
      dataPreview: observation.data
        ? JSON.stringify(observation.data).slice(0, 200)
        : undefined,
    });
  }

  /**
   * 记录 Decide 阶段
   */
  logDecide(state: AgentState, satisfied: boolean): void {
    this.log(state.iteration, 'decide', `Decision: satisfied=${satisfied}`, {
      satisfied,
      retrievalCount: state.retrievalResults?.length ?? 0,
      entitiesCount: state.entities.diseases.length + state.entities.drugs.length + state.entities.indicators.length,
    });
  }

  /**
   * 记录 Answer 阶段
   */
  logAnswer(state: AgentState): void {
    this.log(state.iteration, 'answer', 'Generating final answer', {
      hasAnswer: state.answer !== undefined,
      answerPreview: state.answer?.conclusion.text.slice(0, 100),
    });
  }

  /**
   * 记录完成
   */
  logComplete(state: AgentState): void {
    this.log(state.iteration, 'complete', 'Agent execution completed', {
      status: state.status,
      satisfied: state.satisfied,
      totalIterations: state.iteration,
      traceLength: state.reasoningTrace.length,
    }, 'info');
  }

  /**
   * 记录错误
   */
  logError(iteration: number, error: Error): void {
    this.log(iteration, 'think', `Error: ${error.message}`, {
      error: error.message,
      stack: error.stack?.slice(0, 500),
    }, 'error');
  }

  /**
   * 获取完整日志
   */
  getExecutionLog(state: AgentState): AgentExecutionLog {
    const endTime = new Date().toISOString();
    const startTimeMs = new Date(this.startTime).getTime();
    const endTimeMs = new Date(endTime).getTime();

    return {
      agentId: this.agentId,
      query: this.query,
      startTime: this.startTime,
      endTime,
      totalDurationMs: endTimeMs - startTimeMs,
      entries: this.entries,
      summary: {
        totalIterations: state.iteration,
        totalActions: state.reasoningTrace.length,
        retrievalCalls: state.reasoningTrace.filter(s => s.action.type === 'retrieve').length,
        llmCalls: state.reasoningTrace.filter(s => s.decision !== undefined).length,
        finalStatus: state.status === 'completed' ? 'completed' :
                     state.status === 'failed' ? 'failed' : 'max_iterations',
        satisfied: state.satisfied,
      },
    };
  }

  /**
   * 导出为 JSON
   */
  toJson(state: AgentState): string {
    return JSON.stringify(this.getExecutionLog(state), null, 2);
  }

  /**
   * 导出为 Markdown 报告
   */
  toMarkdown(state: AgentState): string {
    const log = this.getExecutionLog(state);
    const lines: string[] = [];

    lines.push(`# Agent Execution Report`);
    lines.push('');
    lines.push(`**Agent ID**: ${log.agentId}`);
    lines.push(`**Query**: ${log.query}`);
    lines.push(`**Duration**: ${log.totalDurationMs}ms`);
    lines.push('');

    lines.push(`## Summary`);
    lines.push('');
    lines.push(`| Metric | Value |`);
    lines.push(`|--------|-------|`);
    lines.push(`| Total Iterations | ${log.summary.totalIterations} |`);
    lines.push(`| Total Actions | ${log.summary.totalActions} |`);
    lines.push(`| Retrieval Calls | ${log.summary.retrievalCalls} |`);
    lines.push(`| LLM Calls | ${log.summary.llmCalls} |`);
    lines.push(`| Final Status | ${log.summary.finalStatus} |`);
    lines.push(`| Satisfied | ${log.summary.satisfied} |`);
    lines.push('');

    lines.push(`## Execution Trace`);
    lines.push('');

    for (const entry of log.entries) {
      lines.push(`### Iteration ${entry.iteration} - ${entry.phase}`);
      lines.push('');
      lines.push(`**Time**: ${entry.timestamp}`);
      lines.push(`**Message**: ${entry.message}`);
      if (entry.data) {
        lines.push('');
        lines.push('**Data**:');
        lines.push('```json');
        lines.push(JSON.stringify(entry.data, null, 2));
        lines.push('```');
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * 判断是否应该输出日志
   */
  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['error', 'warn', 'info', 'debug'];
    return levels.indexOf(level) <= levels.indexOf(this.logLevel);
  }
}

/**
 * 创建 AgentLogger
 */
export function createAgentLogger(logLevel: LogLevel = 'info'): AgentLogger {
  return new AgentLogger(undefined, logLevel);
}