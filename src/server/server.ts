/**
 * @spec architecture.md#MCP Server
 * @layer 6
 * @description MCP Server 主入口
 */

import type { IVectorStore, IMetadataStore, IFullTextStore } from '../storage/interface';
import type { IEmbedder } from '../embedding/interface';
import {
  allToolDefinitions,
  createRagIndexHandler,
  createRagSearchHandler,
  createRagDeleteHandler,
  createRagStatusHandler,
  createRagConfigHandler,
  DEFAULT_CONFIG
} from './tools/index';
import {
  DocsResource,
  HistoryResource,
  ConfigResource,
  MetricsResource,
  resourceDefinitions
} from './resources/index';
import {
  allPromptDefinitions,
  createSearchOptimizePrompt,
  createResultSummaryPrompt
} from './prompts/index';
import { Logger, logger } from '../harness/observability/logger';
import { Tracer, tracer } from '../harness/observability/tracer';
import { HealthChecker } from '../harness/observability/health';

export interface MCPServerConfig {
  name: string;
  version: string;
}

export interface MCPServerContext {
  vectorStore: IVectorStore;
  metadataStore: IMetadataStore;
  fulltextStore: IFullTextStore;
  embedder: IEmbedder;
  config: Record<string, unknown>;
}

export class MCPServer {
  private config: MCPServerConfig;
  private context: MCPServerContext;
  private logger: Logger;
  private tracer: Tracer;
  private healthChecker: HealthChecker;
  private historyResource: HistoryResource;
  private configResource: ConfigResource;
  private metricsResource: MetricsResource;

  constructor(context: MCPServerContext, config?: Partial<MCPServerConfig>) {
    this.config = {
      name: config?.name || 'rag-mcp-server',
      version: config?.version || '1.0.0'
    };
    this.context = context;

    this.logger = logger;
    this.tracer = tracer;

    this.healthChecker = new HealthChecker(
      context.vectorStore,
      context.metadataStore,
      context.embedder
    );

    this.historyResource = new HistoryResource();
    this.configResource = new ConfigResource(context.config);
    this.metricsResource = new MetricsResource();
  }

  // Tool handlers
  getToolDefinitions() {
    return allToolDefinitions;
  }

  async executeTool(name: string, input: Record<string, unknown>) {
    const traceId = this.tracer.getCurrentTraceId();
    const spanId = this.tracer.startSpan(`tool:${name}`);
    const startTime = Date.now();

    this.logger.info(`Executing tool: ${name}`, { input, traceId });

    try {
      let result;

      switch (name) {
        case 'rag_index': {
          const handler = createRagIndexHandler(
            this.context.vectorStore,
            this.context.metadataStore,
            this.context.embedder
          );
          result = await handler(input as unknown as Parameters<typeof handler>[0]);
          this.metricsResource.recordIndex(Date.now() - startTime);
          break;
        }

        case 'rag_search': {
          const handler = createRagSearchHandler(
            this.context.vectorStore,
            this.context.fulltextStore,
            this.context.embedder
          );
          result = await handler(input as unknown as Parameters<typeof handler>[0]);
          this.metricsResource.recordSearch(Date.now() - startTime);
          this.historyResource.addQuery({
            id: spanId,
            query: (input as { query: string }).query,
            mode: (input as { mode?: string }).mode || 'hybrid',
            results_count: (result as { results: unknown[] }).results?.length || 0,
            duration_ms: Date.now() - startTime
          });
          break;
        }

        case 'rag_delete': {
          const handler = createRagDeleteHandler(
            this.context.vectorStore,
            this.context.metadataStore
          );
          result = await handler(input as Parameters<typeof handler>[0]);
          break;
        }

        case 'rag_status': {
          const handler = createRagStatusHandler(
            this.context.vectorStore,
            this.context.metadataStore,
            this.context.embedder,
            this.context.config
          );
          result = await handler({});
          break;
        }

        case 'rag_config': {
          const handler = createRagConfigHandler(this.context.config);
          result = await handler(input as unknown as Parameters<typeof handler>[0]);
          break;
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }

      this.tracer.endSpan(spanId, 'completed');
      this.logger.info(`Tool completed: ${name}`, { duration: Date.now() - startTime });

      return result;
    } catch (error) {
      this.tracer.endSpan(spanId, 'error');
      this.metricsResource.recordError(error instanceof Error ? error.message : 'Unknown error');
      this.logger.error(`Tool failed: ${name}`, { error });
      throw error;
    }
  }

  // Resource handlers
  getResourceDefinitions() {
    return resourceDefinitions;
  }

  async readResource(uri: string) {
    if (uri === 'rag://docs') {
      return new DocsResource(this.context.metadataStore).read();
    }
    if (uri === 'rag://history') {
      return this.historyResource.read();
    }
    if (uri === 'rag://config') {
      return this.configResource.read();
    }
    if (uri === 'rag://metrics') {
      return this.metricsResource.read();
    }

    throw new Error(`Unknown resource: ${uri}`);
  }

  // Prompt handlers
  getPromptDefinitions() {
    return allPromptDefinitions;
  }

  async getPrompt(name: string, args: Record<string, string>) {
    switch (name) {
      case 'search-optimize':
        return createSearchOptimizePrompt(args);
      case 'result-summary':
        return createResultSummaryPrompt(args);
      default:
        throw new Error(`Unknown prompt: ${name}`);
    }
  }

  // Health check
  async healthCheck() {
    return this.healthChecker.check();
  }

  // Server info
  getServerInfo() {
    return {
      name: this.config.name,
      version: this.config.version,
      capabilities: {
        tools: true,
        resources: true,
        prompts: true
      }
    };
  }
}