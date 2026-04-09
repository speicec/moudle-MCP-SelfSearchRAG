/**
 * MCP tool definitions
 */
export const TOOLS = {
  ingest_document: {
    name: 'ingest_document',
    description: 'Ingest a document into the RAG system for indexing',
    inputSchema: {
      type: 'object' as const,
      properties: {
        document_path: {
          type: 'string',
          description: 'Path to the document file',
        },
        metadata: {
          type: 'object',
          description: 'Optional metadata for the document',
          properties: {
            title: { type: 'string' },
            author: { type: 'string' },
            tags: { type: 'array', items: { type: 'string' } },
          },
        },
      },
      required: ['document_path'],
    },
  },

  query: {
    name: 'query',
    description: 'Query the RAG system for relevant content',
    inputSchema: {
      type: 'object' as const,
      properties: {
        query_text: {
          type: 'string',
          description: 'The search query',
        },
        top_k: {
          type: 'number',
          description: 'Number of results to return (default: 5)',
          default: 5,
        },
        threshold: {
          type: 'number',
          description: 'Minimum similarity threshold (0-1)',
        },
        filters: {
          type: 'object',
          description: 'Optional filters for the query',
          properties: {
            document_ids: {
              type: 'array',
              items: { type: 'string' },
            },
            page_numbers: {
              type: 'array',
              items: { type: 'number' },
            },
            content_types: {
              type: 'array',
              items: { type: 'string' },
            },
          },
        },
        include_images: {
          type: 'boolean',
          description: 'Include image results (default: true)',
          default: true,
        },
      },
      required: ['query_text'],
    },
  },

  get_document: {
    name: 'get_document',
    description: 'Get a specific document by ID',
    inputSchema: {
      type: 'object' as const,
      properties: {
        document_id: {
          type: 'string',
          description: 'The document ID',
        },
      },
      required: ['document_id'],
    },
  },

  list_documents: {
    name: 'list_documents',
    description: 'List all indexed documents',
    inputSchema: {
      type: 'object' as const,
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of documents to return',
          default: 20,
        },
        status_filter: {
          type: 'string',
          description: 'Filter by document status',
          enum: ['pending', 'queued', 'processing', 'indexed', 'failed'],
        },
      },
    },
  },

  delete_document: {
    name: 'delete_document',
    description: 'Delete a document from the index',
    inputSchema: {
      type: 'object' as const,
      properties: {
        document_id: {
          type: 'string',
          description: 'The document ID to delete',
        },
      },
      required: ['document_id'],
    },
  },

  get_stats: {
    name: 'get_stats',
    description: 'Get system statistics',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
};

/**
 * Tool input validator
 */
export class ToolValidator {
  /**
   * Validate ingest_document input
   */
  static validateIngestDocument(input: unknown): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (typeof input !== 'object' || input === null) {
      return { valid: false, errors: ['Input must be an object'] };
    }

    const args = input as Record<string, unknown>;

    if (typeof args.document_path !== 'string' || args.document_path.length === 0) {
      errors.push('document_path is required and must be a non-empty string');
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Validate query input
   */
  static validateQuery(input: unknown): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (typeof input !== 'object' || input === null) {
      return { valid: false, errors: ['Input must be an object'] };
    }

    const args = input as Record<string, unknown>;

    if (typeof args.query_text !== 'string' || args.query_text.length === 0) {
      errors.push('query_text is required and must be a non-empty string');
    }

    if (args.top_k !== undefined && (typeof args.top_k !== 'number' || args.top_k < 1)) {
      errors.push('top_k must be a positive number');
    }

    if (args.threshold !== undefined && (typeof args.threshold !== 'number' || args.threshold < 0 || args.threshold > 1)) {
      errors.push('threshold must be between 0 and 1');
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Validate get_document input
   */
  static validateGetDocument(input: unknown): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (typeof input !== 'object' || input === null) {
      return { valid: false, errors: ['Input must be an object'] };
    }

    const args = input as Record<string, unknown>;

    if (typeof args.document_id !== 'string' || args.document_id.length === 0) {
      errors.push('document_id is required and must be a non-empty string');
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Validate list_documents input
   */
  static validateListDocuments(input: unknown): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (typeof input !== 'object' || input === null) {
      return { valid: false, errors: ['Input must be an object'] };
    }

    const args = input as Record<string, unknown>;

    if (args.limit !== undefined && (typeof args.limit !== 'number' || args.limit < 1)) {
      errors.push('limit must be a positive number');
    }

    if (args.status_filter !== undefined) {
      const validStatuses = ['pending', 'queued', 'processing', 'indexed', 'failed'];
      if (!validStatuses.includes(args.status_filter as string)) {
        errors.push(`status_filter must be one of: ${validStatuses.join(', ')}`);
      }
    }

    return { valid: errors.length === 0, errors };
  }
}

/**
 * Create tool list for MCP
 */
export function getToolList() {
  return Object.values(TOOLS).map(tool => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
  }));
}