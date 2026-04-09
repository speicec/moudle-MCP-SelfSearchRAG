import type { Plugin, PluginConfig } from './harness.js';
import type { Context } from './context.js';

/**
 * Plugin registry for managing available plugins
 */
export class PluginRegistry {
  private plugins: Map<string, Plugin> = new Map();
  private factories: Map<string, PluginFactory> = new Map();

  /**
   * Register a plugin instance
   */
  register(plugin: Plugin): void {
    if (this.plugins.has(plugin.name)) {
      throw new Error(`Plugin "${plugin.name}" is already registered`);
    }
    this.plugins.set(plugin.name, plugin);
  }

  /**
   * Register a plugin factory for lazy instantiation
   */
  registerFactory(name: string, factory: PluginFactory): void {
    if (this.factories.has(name)) {
      throw new Error(`Plugin factory "${name}" is already registered`);
    }
    this.factories.set(name, factory);
  }

  /**
   * Get a plugin by name
   */
  get(name: string): Plugin | undefined {
    return this.plugins.get(name);
  }

  /**
   * Get or create a plugin from factory
   */
  resolve(config: PluginConfig): Plugin {
    // Check for existing instance
    const existing = this.plugins.get(config.name);
    if (existing) {
      return existing;
    }

    // Try factory
    const factory = this.factories.get(config.name);
    if (factory) {
      const plugin = factory(config.options ?? {});
      this.plugins.set(config.name, plugin);
      return plugin;
    }

    throw new Error(`Plugin "${config.name}" not found in registry`);
  }

  /**
   * Check if plugin is registered
   */
  has(name: string): boolean {
    return this.plugins.has(name) || this.factories.has(name);
  }

  /**
   * List all registered plugin names
   */
  list(): string[] {
    const names = new Set<string>();
    for (const name of this.plugins.keys()) {
      names.add(name);
    }
    for (const name of this.factories.keys()) {
      names.add(name);
    }
    return Array.from(names);
  }

  /**
   * Clear all registered plugins
   */
  clear(): void {
    this.plugins.clear();
    this.factories.clear();
  }
}

/**
 * Factory function for creating plugins with options
 */
export type PluginFactory = (options: Record<string, unknown>) => Plugin;

/**
 * Base plugin class for simple implementations
 */
export abstract class BasePlugin implements Plugin {
  readonly name: string;

  constructor(name: string) {
    this.name = name;
  }

  abstract process(ctx: Context): Promise<Context>;

  /**
   * Optional validation - default returns true
   */
  validate(_ctx: Context): boolean {
    return true;
  }
}

/**
 * Global plugin registry instance
 */
export const globalPluginRegistry = new PluginRegistry();

/**
 * Register a plugin globally
 */
export function registerPlugin(plugin: Plugin): void {
  globalPluginRegistry.register(plugin);
}

/**
 * Register a plugin factory globally
 */
export function registerPluginFactory(name: string, factory: PluginFactory): void {
  globalPluginRegistry.registerFactory(name, factory);
}