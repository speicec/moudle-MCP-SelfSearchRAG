/**
 * @spec tools.md
 * @layer 6
 * @description MCP Tools导出
 */

export * from './interface';
export { ragIndexDefinition, createRagIndexHandler } from './rag-index';
export { ragSearchDefinition, createRagSearchHandler } from './rag-search';
export { ragDeleteDefinition, createRagDeleteHandler } from './rag-delete';
export { ragStatusDefinition, createRagStatusHandler } from './rag-status';
export { ragConfigDefinition, createRagConfigHandler, DEFAULT_CONFIG } from './rag-config';

// 所有Tool定义
import { ragIndexDefinition } from './rag-index';
import { ragSearchDefinition } from './rag-search';
import { ragDeleteDefinition } from './rag-delete';
import { ragStatusDefinition } from './rag-status';
import { ragConfigDefinition } from './rag-config';

export const allToolDefinitions = [
  ragIndexDefinition,
  ragSearchDefinition,
  ragDeleteDefinition,
  ragStatusDefinition,
  ragConfigDefinition
];