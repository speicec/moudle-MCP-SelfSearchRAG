import type { Context, ContextSnapshot } from './context.js';
import type { PipelineResult, PipelineError } from './harness.js';

/**
 * Logging hook - logs execution progress
 */
export function createLoggingHook(logger: (message: string) => void) {
  return {
    preExecution: async (ctx: Context): Promise<Context> => {
      const docId = ctx.getDocumentId();
      logger(`[Pipeline] Starting execution for document: ${docId ?? 'unknown'}`);
      return ctx;
    },

    postExecution: async (result: PipelineResult): Promise<void> => {
      const duration = result.metrics.totalDurationMs;
      const status = result.status;
      logger(`[Pipeline] Execution completed: ${status}, duration: ${duration}ms`);
    },

    onError: async (error: PipelineError, ctx: Context): Promise<void> => {
      logger(`[Pipeline] Error in stage "${error.stage}": ${error.message}`);
      if (error.plugin) {
        logger(`[Pipeline] Error in plugin "${error.plugin}"`);
      }
    },
  };
}

/**
 * Timing hook - records detailed timing information
 */
export function createTimingHook(): {
  preExecution: (ctx: Context) => Promise<Context>;
  postExecution: (result: PipelineResult) => Promise<void>;
  getTimingReport: () => TimingReport;
} {
  const timingData: Map<string, number[]> = new Map();

  return {
    preExecution: async (ctx: Context): Promise<Context> => {
      ctx.set('_timingStart', Date.now());
      return ctx;
    },

    postExecution: async (result: PipelineResult): Promise<void> => {
      const docId = result.documentId;
      const duration = result.metrics.totalDurationMs;

      if (!timingData.has(docId)) {
        timingData.set(docId, []);
      }
      timingData.get(docId)?.push(duration);
    },

    getTimingReport: (): TimingReport => {
      const stageTimings: Map<string, number> = new Map();
      const totalExecutions = timingData.size;

      let totalTime = 0;
      for (const [, durations] of timingData) {
        const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
        totalTime += avg;
      }

      return {
        totalExecutions,
        averageDurationMs: totalTime / totalExecutions,
        stageTimings,
      };
    },
  };
}

/**
 * Snapshot hook - captures context state at each stage
 */
export function createSnapshotHook(): {
  preExecution: (ctx: Context) => Promise<Context>;
  getSnapshots: () => Map<string, ContextSnapshot[]>;
} {
  const snapshots: Map<string, ContextSnapshot[]> = new Map();

  return {
    preExecution: async (ctx: Context): Promise<Context> => {
      const docId = ctx.getDocumentId() ?? 'unknown';
      if (!snapshots.has(docId)) {
        snapshots.set(docId, []);
      }
      snapshots.get(docId)?.push(ctx.snapshot());
      return ctx;
    },

    getSnapshots: (): Map<string, ContextSnapshot[]> => {
      return new Map(snapshots);
    },
  };
}

/**
 * Validation hook - validates context before each stage
 */
export function createValidationHook(
  validators: Map<string, (ctx: Context) => boolean>
): {
  preExecution: (ctx: Context) => Promise<Context>;
  onError: (error: PipelineError, ctx: Context) => Promise<void>;
} {
  return {
    preExecution: async (ctx: Context): Promise<Context> => {
      const state = ctx.getState();
      const validator = validators.get(state);

      if (validator && !validator(ctx)) {
        ctx.addError({
          stage: 'validation',
          message: `Validation failed for state: ${state}`,
          recoverable: false,
        });
      }

      return ctx;
    },

    onError: async (error: PipelineError, ctx: Context): Promise<void> => {
      // Log validation errors specifically
      if (error.stage === 'validation') {
        console.error(`Validation error: ${error.message}`);
      }
    },
  };
}

/**
 * Retry hook - enables retry for recoverable errors
 */
export function createRetryHook(
  maxRetries: number = 3
): {
  onError: (error: PipelineError, ctx: Context) => Promise<void>;
} {
  const retryCounts: Map<string, number> = new Map();

  return {
    onError: async (error: PipelineError, ctx: Context): Promise<void> => {
      if (!error.recoverable) {
        return; // Don't retry non-recoverable errors
      }

      const errorKey = `${error.stage}-${error.plugin ?? 'unknown'}`;
      const currentRetries = retryCounts.get(errorKey) ?? 0;

      if (currentRetries < maxRetries) {
        retryCounts.set(errorKey, currentRetries + 1);
        ctx.set(`_retry_${errorKey}`, currentRetries + 1);
        // Mark for retry in context
        ctx.set('_shouldRetry', true);
      }
    },
  };
}

/**
 * Timing report interface
 */
export interface TimingReport {
  totalExecutions: number;
  averageDurationMs: number;
  stageTimings: Map<string, number>;
}

/**
 * Combined hooks utility
 */
export function combineHooks(
  ...hooks: Partial<{
    preExecution: (ctx: Context) => Promise<Context>;
    postExecution: (result: PipelineResult) => Promise<void>;
    onError: (error: PipelineError, ctx: Context) => Promise<void>;
  }>[]
): {
  preExecution: (ctx: Context) => Promise<Context>;
  postExecution: (result: PipelineResult) => Promise<void>;
  onError: (error: PipelineError, ctx: Context) => Promise<void>;
} {
  return {
    preExecution: async (ctx: Context): Promise<Context> => {
      let result = ctx;
      for (const hook of hooks) {
        if (hook.preExecution) {
          result = await hook.preExecution(result);
        }
      }
      return result;
    },

    postExecution: async (result: PipelineResult): Promise<void> => {
      for (const hook of hooks) {
        if (hook.postExecution) {
          await hook.postExecution(result);
        }
      }
    },

    onError: async (error: PipelineError, ctx: Context): Promise<void> => {
      for (const hook of hooks) {
        if (hook.onError) {
          await hook.onError(error, ctx);
        }
      }
    },
  };
}