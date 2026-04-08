/**
 * @spec harness.md#约束规则
 * @layer 5
 * @description Harness 层接口定义
 */

// 约束规则接口
export interface ConstraintRule {
  id: string;
  name: string;
  description?: string;
  type: 'block' | 'warn' | 'transform';
  condition: (context: ConstraintContext) => boolean;
  action?: (context: ConstraintContext) => ConstraintContext;
  message?: string;
}

// 约束上下文
export interface ConstraintContext {
  operation: string;
  input: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

// 约束结果
export interface ConstraintResult {
  allowed: boolean;
  rule?: ConstraintRule;
  message?: string;
  transformedContext?: ConstraintContext;
}

// 反馈接口
export interface Feedback {
  executionId: string;
  tool: string;
  success: boolean;
  latencyMs: number;
  error?: string;
  userAction?: 'accept' | 'reject' | 'modify';
  suggestions?: string[];
}

// 观测接口
export interface Trace {
  traceId: string;
  operation: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  metadata?: Record<string, unknown>;
  children?: Trace[];
}

// 工具集管理接口
export interface ToolsetManager {
  registerTool(tool: ToolDefinition): void;
  unregisterTool(name: string): void;
  getTool(name: string): ToolDefinition | null;
  getToolsByGroup(group: string): ToolDefinition[];
  listTools(): ToolDefinition[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  group?: string;
  inputSchema: object;
  outputSchema?: object;
  handler: (input: unknown) => Promise<unknown>;
  dependencies?: string[];
}