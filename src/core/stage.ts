import type { Plugin, StageMetrics, PipelineError } from './harness.js';
import type { Context } from './context.js';

/**
 * Base Stage implementation
 */
export abstract class BaseStage implements Stage {
  readonly name: string;
  readonly plugins: Plugin[];
  readonly failFast: boolean;

  constructor(name: string, plugins: Plugin[] = [], failFast = true) {
    this.name = name;
    this.plugins = plugins;
    this.failFast = failFast;
  }

  addPlugin(plugin: Plugin): void {
    this.plugins.push(plugin);
  }

  /**
   * Execute all plugins in sequence
   */
  async execute(ctx: Context): Promise<Context> {
    let currentContext = ctx;
    const startTime = Date.now();

    ctx.setStageMetrics(this.name, {
      startTime,
      status: 'running',
    });

    for (const plugin of this.plugins) {
      const pluginStartTime = Date.now();

      try {
        // Optional validation before processing
        if (plugin.validate && !plugin.validate(currentContext)) {
          ctx.addError({
            stage: this.name,
            plugin: plugin.name,
            message: 'Plugin validation failed',
            recoverable: !this.failFast,
          });

          if (this.failFast) {
            ctx.setStageMetrics(this.name, {
              startTime,
              endTime: Date.now(),
              status: 'failed',
            });
            return currentContext;
          }
          continue;
        }

        currentContext = await plugin.process(currentContext);

        ctx.setPluginMetrics(this.name, plugin.name, {
          durationMs: Date.now() - pluginStartTime,
          status: 'success',
        });

      } catch (error) {
        const pipelineError: PipelineError = {
          stage: this.name,
          plugin: plugin.name,
          message: error instanceof Error ? error.message : 'Unknown error',
          recoverable: !this.failFast,
        };

        ctx.addError(pipelineError);

        if (this.failFast) {
          ctx.setStageMetrics(this.name, {
            startTime,
            endTime: Date.now(),
            status: 'failed',
          });
          return currentContext;
        }
      }
    }

    ctx.setStageMetrics(this.name, {
      startTime,
      endTime: Date.now(),
      status: 'completed',
    });

    return currentContext;
  }

  /**
   * Create a metrics summary for this stage
   */
  getMetrics(ctx: Context): StageMetrics | undefined {
    return ctx.getStageMetrics(this.name);
  }
}

/**
 * Stage interface needs to be imported from harness
 */
import type { Stage } from './harness.js';