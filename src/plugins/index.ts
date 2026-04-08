/**
 * @spec plugin-system.md#内置插件
 * @layer 1
 * @description 插件系统导出
 */

export * from './interface';
export { PluginRegistry, pluginRegistry } from './registry';
export { PluginLoader, pluginLoader } from './loader';

// 内置插件
export * from './builtin/index';

// 注册默认插件
import { pluginRegistry } from './registry';
import { BasePlugin } from './interface';
import type { PluginType } from '../types/index';
import { registerBuiltinPlugins } from './builtin/index';

// 简单的默认 Embedder 插件
class DefaultEmbedderPlugin extends BasePlugin {
  meta = {
    name: 'embedder:default',
    version: '1.0.0',
    type: 'embedder' as PluginType,
    compatibleVersions: ['1.x']
  };
}

// 简单的默认 Chunker 插件
class DefaultChunkerPlugin extends BasePlugin {
  meta = {
    name: 'chunker:default',
    version: '1.0.0',
    type: 'chunker' as PluginType,
    compatibleVersions: ['1.x']
  };
}

// 注册默认插件
pluginRegistry.register({
  meta: {
    name: 'embedder:default',
    version: '1.0.0',
    type: 'embedder',
    compatibleVersions: ['1.x']
  },
  factory: () => new DefaultEmbedderPlugin()
});

pluginRegistry.register({
  meta: {
    name: 'chunker:default',
    version: '1.0.0',
    type: 'chunker',
    compatibleVersions: ['1.x']
  },
  factory: () => new DefaultChunkerPlugin()
});

// 注册内置插件
registerBuiltinPlugins();