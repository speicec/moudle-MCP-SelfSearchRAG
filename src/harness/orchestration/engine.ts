/**
 * @spec harness.md#流程编排
 * @layer 5
 * @description 流程编排引擎实现
 */

export interface FlowStep {
  name: string;
  action: (context: FlowContext) => Promise<FlowContext>;
  retryCount?: number;
  timeout?: number;
}

export interface FlowContext {
  data: Record<string, unknown>;
  errors: Array<{ step: string; error: Error }>;
  traces: Array<{ step: string; duration: number; timestamp: Date }>;
}

export interface FlowDefinition {
  name: string;
  steps: FlowStep[];
  parallel?: boolean;
}

export interface IFlowOrchestrator {
  execute(flow: FlowDefinition, initialContext?: FlowContext): Promise<FlowContext>;
  registerFlow(flow: FlowDefinition): void;
  getFlow(name: string): FlowDefinition | undefined;
}

export class FlowOrchestrator implements IFlowOrchestrator {
  private flows: Map<string, FlowDefinition> = new Map();

  registerFlow(flow: FlowDefinition): void {
    this.flows.set(flow.name, flow);
  }

  getFlow(name: string): FlowDefinition | undefined {
    return this.flows.get(name);
  }

  async execute(flow: FlowDefinition, initialContext?: FlowContext): Promise<FlowContext> {
    const context: FlowContext = initialContext || {
      data: {},
      errors: [],
      traces: []
    };

    if (flow.parallel) {
      // Execute all steps in parallel
      await Promise.all(flow.steps.map(step => this.executeStep(step, context)));
    } else {
      // Execute steps sequentially
      for (const step of flow.steps) {
        await this.executeStep(step, context);
      }
    }

    return context;
  }

  private async executeStep(step: FlowStep, context: FlowContext): Promise<void> {
    const startTime = Date.now();
    const retryCount = step.retryCount || 0;

    for (let attempt = 0; attempt <= retryCount; attempt++) {
      try {
        await step.action(context);

        context.traces.push({
          step: step.name,
          duration: Date.now() - startTime,
          timestamp: new Date()
        });

        return;
      } catch (error) {
        if (attempt === retryCount) {
          context.errors.push({
            step: step.name,
            error: error instanceof Error ? error : new Error(String(error))
          });

          context.traces.push({
            step: step.name,
            duration: Date.now() - startTime,
            timestamp: new Date()
          });
        }
      }
    }
  }
}

export const flowOrchestrator = new FlowOrchestrator();

// 预定义流程
export const smartIndexFlow: FlowDefinition = {
  name: 'smart-index',
  steps: [
    {
      name: 'analyze-document',
      action: async (ctx) => {
        // Document analysis logic
        ctx.data.analyzed = true;
        return ctx;
      }
    },
    {
      name: 'chunk-document',
      action: async (ctx) => {
        // Chunking logic
        ctx.data.chunked = true;
        return ctx;
      }
    },
    {
      name: 'embed-chunks',
      action: async (ctx) => {
        // Embedding logic
        ctx.data.embedded = true;
        return ctx;
      }
    },
    {
      name: 'store-vectors',
      action: async (ctx) => {
        // Storage logic
        ctx.data.stored = true;
        return ctx;
      }
    }
  ]
};

export const batchSearchFlow: FlowDefinition = {
  name: 'batch-search',
  parallel: true,
  steps: []
};