/**
 * @spec plugin-system.md#插件加载器
 * @layer 1
 * @description 插件加载器实现
 */

import * as fs from 'fs';
import * as path from 'path';
import type { PluginDefinition } from '../types/index';
import type { PluginLoadResult } from './interface';
import { pluginRegistry } from './registry';

export class PluginLoader {
  private loadedPaths: Set<string> = new Set();

  async loadFromFile(pluginPath: string): Promise<PluginLoadResult> {
    try {
      const absolutePath = path.resolve(pluginPath);

      if (!fs.existsSync(absolutePath)) {
        return { success: false, error: `Plugin file not found: ${absolutePath}` };
      }

      const module = await import(absolutePath);
      const definition: PluginDefinition = module.default || module.plugin;

      if (!definition || !definition.meta) {
        return { success: false, error: 'Invalid plugin module: missing definition' };
      }

      pluginRegistry.register(definition);
      this.loadedPaths.add(absolutePath);

      return { success: true, plugin: pluginRegistry.get(definition.meta.name) || undefined };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async loadFromDirectory(dir: string): Promise<PluginLoadResult[]> {
    const results: PluginLoadResult[] = [];
    const absoluteDir = path.resolve(dir);

    if (!fs.existsSync(absoluteDir)) {
      return [{ success: false, error: `Directory not found: ${absoluteDir}` }];
    }

    const entries = fs.readdirSync(absoluteDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const indexPath = path.join(absoluteDir, entry.name, 'index.js');
        const tsPath = path.join(absoluteDir, entry.name, 'index.ts');

        if (fs.existsSync(indexPath)) {
          results.push(await this.loadFromFile(indexPath));
        } else if (fs.existsSync(tsPath)) {
          results.push(await this.loadFromFile(tsPath));
        }
      } else if (entry.name.endsWith('.plugin.js') || entry.name.endsWith('.plugin.ts')) {
        results.push(await this.loadFromFile(path.join(absoluteDir, entry.name)));
      }
    }

    return results;
  }

  async loadBuiltinPlugins(): Promise<void> {
    // 内置插件通过静态导入注册
  }

  getLoadedPaths(): string[] {
    return Array.from(this.loadedPaths);
  }

  clear(): void {
    this.loadedPaths.clear();
  }
}

export const pluginLoader = new PluginLoader();