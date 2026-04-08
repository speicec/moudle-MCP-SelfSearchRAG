/**
 * @spec plugin-system.md#插件注册表
 * @layer 1
 * @description 插件注册表实现
 */

import type {
  Plugin,
  PluginDefinition,
  PluginType,
  PluginError
} from '../types/index';
import type { PluginValidationResult, PluginLoadResult } from './interface';

export class PluginRegistry {
  private definitions: Map<string, PluginDefinition> = new Map();
  private instances: Map<string, Plugin> = new Map();
  private errors: PluginError[] = [];

  register(definition: PluginDefinition): void {
    if (this.definitions.has(definition.meta.name)) {
      throw new Error(`Plugin ${definition.meta.name} is already registered`);
    }

    const validation = this.validateDefinition(definition);
    if (!validation.valid) {
      throw new Error(`Invalid plugin definition: ${validation.errors.join(', ')}`);
    }

    this.definitions.set(definition.meta.name, definition);
  }

  async unregister(name: string): Promise<void> {
    const instance = this.instances.get(name);
    if (instance) {
      await instance.destroy();
      this.instances.delete(name);
    }

    this.definitions.delete(name);
  }

  get(name: string): Plugin | null {
    return this.instances.get(name) || null;
  }

  getDefinition(name: string): PluginDefinition | null {
    return this.definitions.get(name) || null;
  }

  getByType(type: PluginType): Plugin[] {
    const plugins: Plugin[] = [];

    for (const [name, definition] of this.definitions) {
      if (definition.meta.type === type) {
        const instance = this.instances.get(name);
        if (instance) {
          plugins.push(instance);
        }
      }
    }

    return plugins;
  }

  list(): PluginDefinition[] {
    return Array.from(this.definitions.values());
  }

  listByType(type: PluginType): PluginDefinition[] {
    return Array.from(this.definitions.values())
      .filter(def => def.meta.type === type);
  }

  async init(name: string, config?: Record<string, unknown>): Promise<Plugin> {
    const definition = this.definitions.get(name);
    if (!definition) {
      throw new Error(`Plugin ${name} not found`);
    }

    const plugin = definition.factory(config || definition.defaultConfig || {});
    await plugin.init(config || definition.defaultConfig || {});
    this.instances.set(name, plugin);

    return plugin;
  }

  async start(name: string): Promise<void> {
    const plugin = this.instances.get(name);
    if (!plugin) {
      throw new Error(`Plugin ${name} not initialized`);
    }

    await plugin.start();
  }

  async stop(name: string): Promise<void> {
    const plugin = this.instances.get(name);
    if (!plugin) {
      return;
    }

    await plugin.stop();
  }

  getStatus(): {
    registered: number;
    initialized: number;
    active: number;
    errors: PluginError[];
  } {
    let active = 0;
    let initialized = 0;

    for (const plugin of this.instances.values()) {
      if (plugin.status === 'running') active++;
      if (plugin.status !== 'uninitialized') initialized++;
    }

    return {
      registered: this.definitions.size,
      initialized,
      active,
      errors: this.errors
    };
  }

  recordError(pluginName: string, code: string, message: string, stack?: string): void {
    this.errors.push({
      pluginName,
      code,
      message,
      timestamp: new Date(),
      stack
    });
  }

  clearErrors(): void {
    this.errors = [];
  }

  private validateDefinition(definition: PluginDefinition): PluginValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!definition.meta.name) {
      errors.push('Plugin name is required');
    }

    if (!definition.meta.version) {
      errors.push('Plugin version is required');
    }

    if (!definition.meta.type) {
      errors.push('Plugin type is required');
    }

    if (!definition.factory) {
      errors.push('Plugin factory is required');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
}

export const pluginRegistry = new PluginRegistry();