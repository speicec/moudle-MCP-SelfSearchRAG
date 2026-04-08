/**
 * @spec plugin-system.md#内置插件
 * @layer 1
 * @description 内置插件导出
 */

// Embedders
export * from './embedders/index';

// Chunkers
export * from './chunkers/index';

// Rerankers
export * from './rerankers/index';

// 注册所有内置插件
import { pluginRegistry } from '../registry';
import { mockEmbedderDefinition, apiEmbedderDefinition } from './embedders/index';
import { recursiveChunkerDefinition, fixedSizeChunkerDefinition, markdownChunkerDefinition } from './chunkers/index';
import { ruleBasedRerankerDefinition } from './rerankers/index';

export function registerBuiltinPlugins(): void {
  // Embedders
  pluginRegistry.register(mockEmbedderDefinition);
  pluginRegistry.register(apiEmbedderDefinition);

  // Chunkers
  pluginRegistry.register(recursiveChunkerDefinition);
  pluginRegistry.register(fixedSizeChunkerDefinition);
  pluginRegistry.register(markdownChunkerDefinition);

  // Rerankers
  pluginRegistry.register(ruleBasedRerankerDefinition);
}