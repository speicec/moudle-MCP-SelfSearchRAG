import type {
  Harness,
  HarnessConfig,
  Stage,
  PipelineResult,
  ExecutionMetrics,
  PipelineError,
  PreExecutionHook,
  PostExecutionHook,
  ErrorHook,
  StageStartHook,
  StageCompleteHook,
} from './harness.js';
import type { ProcessingState } from './context.js';
import type { Document } from './document.js';
import { Context } from './context.js';
import { BaseStage } from './stage.js';
import { PluginRegistry } from './plugin.js';

/**
 * Concrete stage implementation for pipeline
 */
class ConcreteStage extends BaseStage {
  constructor(name: string, plugins: import('./harness.js').Plugin[], failFast?: boolean) {
    super(name, plugins, failFast);
  }
}

/**
 * Pipeline orchestrator - main Harness implementation
 */
export class Pipeline implements Harness {
  readonly stages: Stage[] = [];
  readonly config: HarnessConfig;

  private preExecutionHooks: PreExecutionHook[] = [];
  private postExecutionHooks: PostExecutionHook[] = [];
  private errorHooks: ErrorHook[] = [];
  private stageStartHooks: StageStartHook[] = [];
  private stageCompleteHooks: StageCompleteHook[] = [];

  constructor(config: HarnessConfig, registry?: PluginRegistry) {
    this.config = config;
    this.buildStages(config, registry ?? new PluginRegistry());
  }

  /**
   * Build stages from configuration
   */
  private buildStages(config: HarnessConfig, registry: PluginRegistry): void {
    for (const stageConfig of config.stages) {
      const plugins = stageConfig.plugins.map(p => registry.resolve(p));
      const stage = new ConcreteStage(
        stageConfig.name,
        plugins,
        stageConfig.failFast ?? true
      );
      this.stages.push(stage);
    }

    // Register hooks from config
    if (config.hooks) {
      this.preExecutionHooks = config.hooks.preExecution ?? [];
      this.postExecutionHooks = config.hooks.postExecution ?? [];
      this.errorHooks = config.hooks.onError ?? [];
      this.stageStartHooks = config.hooks.onStageStart ?? [];
      this.stageCompleteHooks = config.hooks.onStageComplete ?? [];
    }
  }

  /**
   * Execute the full pipeline
   */
  async run(input: Document): Promise<PipelineResult> {
    const startTime = Date.now();
    let context = new Context(input);
    const errors: PipelineError[] = [];

    try {
      // Execute pre-execution hooks
      for (const hook of this.preExecutionHooks) {
        context = await hook(context);
      }

      // Execute stages sequentially
      for (const stage of this.stages) {
        context.setState(getStageState(stage.name) as ProcessingState);

        // Call stage start hooks
        for (const hook of this.stageStartHooks) {
          await hook(stage.name, context);
        }

        try {
          context = await stage.execute(context);

          // Call stage complete hooks
          for (const hook of this.stageCompleteHooks) {
            await hook(stage.name, context);
          }

          // Check for stage errors
          const stageErrors = context.getErrors();
          for (const err of stageErrors) {
            if (err.stage === stage.name && !errors.includes(err)) {
              errors.push(err);
              await this.triggerErrorHooks(err, context);
            }
          }

        } catch (error) {
          const pipelineError: PipelineError = {
            stage: stage.name,
            message: error instanceof Error ? error.message : 'Unknown stage error',
            recoverable: false,
          };
          errors.push(pipelineError);
          context.addError(pipelineError);
          await this.triggerErrorHooks(pipelineError, context);

          // Stop pipeline on unrecoverable error
          break;
        }
      }

      // Calculate metrics
      const endTime = Date.now();
      const metrics: ExecutionMetrics = {
        totalDurationMs: endTime - startTime,
        stageMetrics: context.getAllStageMetrics(),
      };

      // Determine result status
      const status = errors.length > 0
        ? (errors.some(e => !e.recoverable) ? 'failed' : 'partial')
        : 'success';

      const result: PipelineResult = {
        documentId: input.id,
        status,
        context,
        metrics,
        errors,
      };

      // Execute post-execution hooks
      for (const hook of this.postExecutionHooks) {
        await hook(result);
      }

      return result;

    } catch (error) {
      const pipelineError: PipelineError = {
        stage: 'pipeline',
        message: error instanceof Error ? error.message : 'Pipeline execution failed',
        recoverable: false,
      };
      errors.push(pipelineError);

      return {
        documentId: input.id,
        status: 'failed',
        context,
        metrics: {
          totalDurationMs: Date.now() - startTime,
          stageMetrics: context.getAllStageMetrics(),
        },
        errors,
      };
    }
  }

  /**
   * Add a stage to the pipeline
   */
  addStage(stage: Stage): void {
    this.stages.push(stage);
  }

  /**
   * Register lifecycle hooks
   */
  registerHooks(hooks: {
    preExecution?: PreExecutionHook[];
    postExecution?: PostExecutionHook[];
    onError?: ErrorHook[];
  }): void {
    if (hooks.preExecution) {
      this.preExecutionHooks.push(...hooks.preExecution);
    }
    if (hooks.postExecution) {
      this.postExecutionHooks.push(...hooks.postExecution);
    }
    if (hooks.onError) {
      this.errorHooks.push(...hooks.onError);
    }
  }

  /**
   * Validate pipeline configuration
   */
  validate(): boolean {
    // Check stage order is logical
    const validOrder = ['ingest', 'parse', 'chunk', 'embed', 'index'];
    let lastValidIndex = -1;

    for (const stage of this.stages) {
      const stageIndex = validOrder.indexOf(stage.name.toLowerCase());
      if (stageIndex !== -1 && stageIndex < lastValidIndex) {
        return false; // Invalid order
      }
      if (stageIndex !== -1) {
        lastValidIndex = stageIndex;
      }
    }

    // Check all stages have at least one plugin
    for (const stage of this.stages) {
      if (stage.plugins.length === 0) {
        return false;
      }
    }

    return true;
  }

  /**
   * Trigger error hooks
   */
  private async triggerErrorHooks(error: PipelineError, context: Context): Promise<void> {
    for (const hook of this.errorHooks) {
      await hook(error, context);
    }
  }
}

/**
 * Map stage name to processing state
 */
function getStageState(stageName: string): string {
  const stateMap: Record<string, string> = {
    ingest: 'INGESTING',
    parse: 'PARSING',
    chunk: 'CHUNKING',
    embed: 'EMBEDDING',
    index: 'INDEXING',
  };
  return stateMap[stageName.toLowerCase()] ?? 'PENDING';
}

/**
 * Create a pipeline from configuration
 */
export function createPipeline(config: HarnessConfig, registry?: PluginRegistry): Harness {
  return new Pipeline(config, registry);
}