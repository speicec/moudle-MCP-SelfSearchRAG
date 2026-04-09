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
import type { RetrievalService } from '../retrieval/index-stage.js';

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
  private retrieval: RetrievalService;
  private config: McpServerConfig;

  constructor(
    pipeline: Harness,
    storage: DocumentStorage,
    retrieval: RetrievalService,
    config?: Partial<McpServerConfig>
  ) {
    this.config = {
      ...DEFAULT_MCP_CONFIG,
      ...config,
    };
    this.pipeline = pipeline;
    this.storage = storage;
    this.retrieval = retrieval;

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
            description: 'Query the RAG system for relevant content',
            inputSchema: {
              type: 'object',
              properties: {
                query_text: {
                  type: 'string',
                  description: 'The search query',
                },
                top_k: {
                  type: 'number',
                  description: 'Number of results to return (default: 5)',
                },
                filters: {
                  type: 'object',
                  description: 'Optional filters for the query',
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
      const results = await this.retrieval.query(args.query_text, {
        topK: args.top_k ?? 5,
      });

      const responseText = JSON.stringify(results, null, 2);

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
  filters?: Record<string, unknown>;
}

interface GetDocumentArgs {
  document_id: string;
}

interface ListDocumentsArgs {
  limit?: number;
  status_filter?: string;
}

/**
 * Create MCP server
 */
export function createMcpServer(
  pipeline: Harness,
  storage: DocumentStorage,
  retrieval: RetrievalService,
  config?: Partial<McpServerConfig>
): McpServer {
  return new McpServer(pipeline, storage, retrieval, config);
}