import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  type CallToolResult,
} from '@modelcontextprotocol/sdk/types.js';
import type { Harness } from '../core/harness.js';
import type { DocumentStorage } from '../core/storage.js';
import type { McpRetrievalService } from './mcp-retrieval-service.js';
import { getTypeFixToolList } from './type-fix-tools.js';
import { TypeFixHandlers, createTypeFixHandlers } from './type-fix-handlers.js';
import {
  MEDICAL_QUERY_TOOL,
  handleMedicalQuery,
} from '../medical/mcp-tool.js';
import {
  MEDICAL_AGENT_TOOL,
  validateMedicalAgentInput,
  formatAgentResultAsMarkdown,
} from '../medical/agent-mcp-tool.js';
import {
  createMedicalAgent,
} from '../medical/agent/index.js';
import {
  createLLMCaller,
  type LLMCaller,
} from '../config/llm-config.js';

/**
 * MCP server configuration
 */
export interface McpServerConfig {
  name: string;
  version: string;
}

/**
 * Default MCP server configuration
 */
export const DEFAULT_MCP_CONFIG: McpServerConfig = {
  name: 'enhanced-rag-mcp-server',
  version: '0.1.0',
};

/**
 * MCP Server implementation
 */
export class McpServer {
  private server: Server;
  private pipeline: Harness;
  private storage: DocumentStorage;
  private retrieval: McpRetrievalService;
  private config: McpServerConfig;
  private typeFixHandlers: TypeFixHandlers;
  private llmCaller?: LLMCaller;

  constructor(
    pipeline: Harness,
    storage: DocumentStorage,
    retrieval: McpRetrievalService,
    config?: Partial<McpServerConfig>,
    llmCaller?: LLMCaller,
  ) {
    this.config = {
      ...DEFAULT_MCP_CONFIG,
      ...config,
    };
    this.pipeline = pipeline;
    this.storage = storage;
    this.retrieval = retrieval;
    this.typeFixHandlers = createTypeFixHandlers();
    this.llmCaller = llmCaller ?? createLLMCaller();

    this.server = new Server(
      { name: this.config.name, version: this.config.version },
      { capabilities: { tools: {}, resources: {} } }
    );

    this.setupHandlers();
  }

  /**
   * Setup MCP request handlers
   */
  private setupHandlers(): void {
    // List tools handler
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'ingest_document',
            description: 'Ingest a document into the RAG system for indexing',
            inputSchema: {
              type: 'object',
              properties: {
                document_path: {
                  type: 'string',
                  description: 'Path to the document file',
                },
                metadata: {
                  type: 'object',
                  description: 'Optional metadata for the document',
                },
              },
              required: ['document_path'],
            },
          },
          {
            name: 'query',
            description: 'Query the RAG system for relevant content using Small-to-Big retrieval. Returns results with parentChunkContent (full context), contextWindow (extracted window around match), and similarityScore (0.0-1.0). Each result includes the matched small chunk and its expanded parent for richer context.',
            inputSchema: {
              type: 'object',
              properties: {
                query_text: {
                  type: 'string',
                  description: 'The search query (supports Chinese and English)',
                },
                top_k: {
                  type: 'number',
                  description: 'Number of results to return (default: 5)',
                },
                threshold: {
                  type: 'number',
                  description: 'Minimum similarity score threshold (0.0-1.0, default: 0.0)',
                },
              },
              required: ['query_text'],
            },
          },
          {
            name: 'get_document',
            description: 'Get a specific document by ID',
            inputSchema: {
              type: 'object',
              properties: {
                document_id: {
                  type: 'string',
                  description: 'The document ID',
                },
              },
              required: ['document_id'],
            },
          },
          {
            name: 'list_documents',
            description: 'List all indexed documents',
            inputSchema: {
              type: 'object',
              properties: {
                limit: {
                  type: 'number',
                  description: 'Maximum number of documents to return',
                },
                status_filter: {
                  type: 'string',
                  description: 'Filter by document status',
                },
              },
            },
          },
          // Type fix tools (self-evolving type safety)
          ...getTypeFixToolList(),
          // Medical query tool (endocrinology domain)
          MEDICAL_QUERY_TOOL,
          // Medical agent tool (full ReAct loop)
          MEDICAL_AGENT_TOOL,
        ],
      };
    });

    // Call tool handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case 'ingest_document':
          return this.handleIngestDocument(args as unknown as IngestDocumentArgs);
        case 'query':
          return this.handleQuery(args as unknown as QueryArgs);
        case 'get_document':
          return this.handleGetDocument(args as unknown as GetDocumentArgs);
        case 'list_documents':
          return this.handleListDocuments(args as unknown as ListDocumentsArgs);
        // Type fix tools
        case 'type_fix':
          return this.handleTypeFix(args as unknown as TypeFixArgs);
        case 'record_fix':
          return this.handleRecordFix(args as unknown as RecordFixArgs);
        case 'type_fix_list':
          return this.handleTypeFixList();
        // Medical query tool
        case 'medical_query':
          return this.handleMedicalQuery(args as unknown as MedicalQueryArgs);
        case 'medical_agent':
          return this.handleMedicalAgent(args as unknown as MedicalAgentArgs);
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });

    // List resources handler
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return { resources: [] };
    });

    // Read resource handler
    this.server.setRequestHandler(ReadResourceRequestSchema, async () => {
      return { contents: [] };
    });
  }

  /**
   * Handle ingest_document tool
   */
  private async handleIngestDocument(args: IngestDocumentArgs): Promise<CallToolResult> {
    try {
      // Implementation would read file and process through pipeline
      return {
        content: [
          {
            type: 'text',
            text: `Document ingestion initiated for: ${args.document_path}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }

  /**
   * Handle query tool
   */
  private async handleQuery(args: QueryArgs): Promise<CallToolResult> {
    try {
      // Check if store has data
      const stats = this.retrieval.getStats();
      if (stats.smallChunks === 0) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                query: args.query_text,
                results: [],
                message: 'No documents have been indexed. Upload documents first.',
              }, null, 2),
            },
          ],
        };
      }

      const results = await this.retrieval.query(args.query_text, {
        topK: args.top_k ?? 5,
        threshold: args.threshold ?? 0.0,
      });

      const responseText = JSON.stringify({
        query: args.query_text,
        results,
        totalResults: results.length,
      }, null, 2);

      return {
        content: [
          {
            type: 'text',
            text: responseText,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }

  /**
   * Handle get_document tool
   */
  private async handleGetDocument(args: GetDocumentArgs): Promise<CallToolResult> {
    try {
      const document = await this.storage.get(args.document_id);

      if (!document) {
        return {
          content: [
            {
              type: 'text',
              text: `Document not found: ${args.document_id}`,
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(document, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }

  /**
   * Handle list_documents tool
   */
  private async handleListDocuments(args: ListDocumentsArgs): Promise<CallToolResult> {
    try {
      const documents = await this.storage.list({
        limit: args.limit,
        status: args.status_filter as any,
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(documents, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }

  /**
   * Handle type_fix tool
   */
  private async handleTypeFix(args: TypeFixArgs): Promise<CallToolResult> {
    try {
      const result = await this.typeFixHandlers.typeFix(args.error_code, args.error_message);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
        isError: !result.success,
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }

  /**
   * Handle record_fix tool
   */
  private async handleRecordFix(args: RecordFixArgs): Promise<CallToolResult> {
    try {
      const result = await this.typeFixHandlers.recordFix({
        rule_id: args.rule_id,
        fix_type: args.fix_type,
        success: args.success,
        file: args.file,
        line: args.line,
      });
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
        isError: !result.success,
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }

  /**
   * Handle type_fix_list tool
   */
  private async handleTypeFixList(): Promise<CallToolResult> {
    try {
      const result = await this.typeFixHandlers.typeFixList();
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
        isError: !result.success,
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }

  /**
   * Handle medical_query tool
   */
  private async handleMedicalQuery(args: MedicalQueryArgs): Promise<CallToolResult> {
    try {
      // Create retrieval wrapper function
      const retrievalFn = async (queryText: string, options?: { topK?: number; threshold?: number }) => {
        const results = await this.retrieval.query(queryText, {
          topK: options?.topK ?? 10,
          threshold: options?.threshold ?? 0.3,
        });

        // Map McpRetrievalResult to RetrievalFunction format
        return results.map(r => ({
          content: r.parentChunkContent,
          source: {
            documentName: r.sourceDocumentId,
          },
        }));
      };

      const result = await handleMedicalQuery(args, retrievalFn);

      if (!result.success) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${result.error}`,
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: result.markdown ?? JSON.stringify(result.data, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }

  /**
   * Handle medical_agent tool
   */
  private async handleMedicalAgent(args: MedicalAgentArgs): Promise<CallToolResult> {
    try {
      const validation = validateMedicalAgentInput(args);

      if (!validation.valid) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${validation.errors.join('; ')}`,
            },
          ],
          isError: true,
        };
      }

      // Create retrieval wrapper function
      const retrievalFn = async (queryText: string, options?: { topK?: number; threshold?: number }) => {
        const results = await this.retrieval.query(queryText, {
          topK: options?.topK ?? 10,
          threshold: options?.threshold ?? 0.3,
        });

        return results.map(r => ({
          content: r.parentChunkContent,
          source: {
            documentName: r.sourceDocumentId,
          },
        }));
      };

      // Create and run MedicalAgent
      const agent = createMedicalAgent(
        this.llmCaller!,
        retrievalFn,
        {
          maxIterations: args.max_iterations ?? 5,
          confidenceThreshold: args.confidence_threshold ?? 0.8,
        },
      );

      const result = await agent.run({
        query: validation.data!.query,
        domain: validation.data!.domain,
      });

      return {
        content: [
          {
            type: 'text',
            text: formatAgentResultAsMarkdown(result),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }

  /**
   * Start the MCP server
   */
  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }

  /**
   * Get the underlying Server instance
   */
  getServer(): Server {
    return this.server;
  }
}

/**
 * Tool argument types
 */
interface IngestDocumentArgs {
  document_path: string;
  metadata?: Record<string, unknown>;
}

interface QueryArgs {
  query_text: string;
  top_k?: number;
  threshold?: number;
}

interface GetDocumentArgs {
  document_id: string;
}

interface ListDocumentsArgs {
  limit?: number;
  status_filter?: string;
}

interface TypeFixArgs {
  error_code: number;
  error_message?: string;
}

interface RecordFixArgs {
  rule_id: string;
  fix_type: string;
  success: boolean;
  file?: string | undefined;
  line?: number | undefined;
}

interface MedicalQueryArgs {
  query: string;
  domain?: 'diabetes' | 'hypertension' | 'thyroid' | 'all';
  include_guidelines?: boolean;
  year_range?: [number, number];
}

interface MedicalAgentArgs {
  query: string;
  domain?: 'diabetes' | 'hypertension' | 'thyroid' | 'all';
  max_iterations?: number;
  confidence_threshold?: number;
}

/**
 * Create MCP server
 */
export function createMcpServer(
  pipeline: Harness,
  storage: DocumentStorage,
  retrieval: McpRetrievalService,
  config?: Partial<McpServerConfig>,
  llmCaller?: LLMCaller,
): McpServer {
  return new McpServer(pipeline, storage, retrieval, config, llmCaller);
}