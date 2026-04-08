/**
 * @spec tools.md
 * @layer 6
 * @description MCP Tools接口定义
 */

// Tool输入类型
export interface RagIndexInput {
  path: string;
  recursive?: boolean;
  filters?: string[];
}

export interface RagSearchInput {
  query: string;
  top_k?: number;
  mode?: 'vector' | 'fulltext' | 'hybrid' | 'code';
  filters?: Record<string, unknown>;
}

export interface RagDeleteInput {
  doc_id?: string;
  path?: string;
}

export interface RagStatusInput {}

export interface RagConfigInput {
  action: 'get' | 'set' | 'reset';
  key?: string;
  value?: unknown;
}

// Tool输出类型
export interface RagIndexOutput {
  indexed: number;
  skipped: number;
  errors: string[];
  duration_ms: number;
}

export interface RagSearchOutput {
  results: Array<{
    chunk_id: string;
    doc_id: string;
    content: string;
    score: number;
    source: string;
    metadata: Record<string, unknown>;
  }>;
  mode: string;
  duration_ms: number;
}

export interface RagDeleteOutput {
  deleted: boolean;
  chunks_removed: number;
}

export interface RagStatusOutput {
  indexed_docs: number;
  indexed_chunks: number;
  storage_health: {
    milvus: 'healthy' | 'unhealthy';
    sqlite: 'healthy' | 'unhealthy';
  };
  embedding_service: {
    status: string;
    model: string;
  };
  config: Record<string, unknown>;
}

export interface RagConfigOutput {
  config: Record<string, unknown>;
  updated: boolean;
}

// Tool定义接口
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

// Tool处理器接口
export interface ToolHandler<Input, Output> {
  (input: Input): Promise<Output>;
}