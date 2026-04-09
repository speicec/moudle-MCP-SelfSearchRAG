import type { Context } from './context.js';
import type { Document } from './document.js';

/**
 * Processing result from pipeline execution
 */
export interface PipelineResult {
  documentId: string;
  status: 'success' | 'failed' | 'partial';
  context: Context;
  metrics: ExecutionMetrics;
  errors: PipelineError[];
}

/**
 * Execution timing metrics
 */
export interface ExecutionMetrics {
  totalDurationMs: number;
  stageMetrics: Map<string, StageMetrics>;
}

/**
 * Stage-level timing metrics
 */
export interface StageMetrics {
  durationMs: number;
  inputSize: number;
  outputSize: number;
}

/**
 * Pipeline error information
 */
export interface PipelineError {
  stage: string;
  plugin?: string;
  message: string;
  recoverable: boolean;
  stack?: string;
}

/**
 * Lifecycle hook function types
 */
export type PreExecutionHook = (ctx: Context) => Promise<Context> | Context;
export type PostExecutionHook = (result: PipelineResult) => Promise<void> | void;
export type ErrorHook = (error: PipelineError, ctx: Context) => Promise<void> | void;

/**
 * Harness configuration
 */
export interface HarnessConfig {
  stages: StageConfig[];
  hooks?: {
    preExecution?: PreExecutionHook[];
    postExecution?: PostExecutionHook[];
    onError?: ErrorHook[];
  };
}

/**
 * Stage configuration
 */
export interface StageConfig {
  name: string;
  plugins: PluginConfig[];
  parallel?: boolean;
  failFast?: boolean;
}

/**
 * Plugin configuration
 */
export interface PluginConfig {
  name: string;
  options?: Record<string, unknown>;
}

/**
 * Plugin interface - the fundamental unit of processing
 */
export interface Plugin {
  name: string;
  process(ctx: Context): Promise<Context>;
  validate?(ctx: Context): boolean;
}

/**
 * Stage interface - a grouping of plugins
 */
export interface Stage {
  name: string;
  plugins: Plugin[];
  execute(ctx: Context): Promise<Context>;
  addPlugin(plugin: Plugin): void;
}

/**
 * Harness - the main orchestrator for document processing
 */
export interface Harness {
  readonly stages: Stage[];
  readonly config: HarnessConfig;

  /**
   * Execute the full pipeline on a document
   */
  run(input: Document): Promise<PipelineResult>;

  /**
   * Register a stage
   */
  addStage(stage: Stage): void;

  /**
   * Register lifecycle hooks
   */
  registerHooks(hooks: {
    preExecution?: PreExecutionHook[];
    postExecution?: PostExecutionHook[];
    onError?: ErrorHook[];
  }): void;

  /**
   * Validate pipeline configuration
   */
  validate(): boolean;
}