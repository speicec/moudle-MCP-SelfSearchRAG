/**
 * @spec plugin-system.md#插件接口
 * @layer 1
 * @description 插件系统接口定义
 */

import type {
  Plugin,
  PluginMeta,
  PluginConfig,
  PluginDefinition,
  PluginFactory,
  PluginType,
  PluginStatus,
  PluginError
} from '../types/index';

// 重新导出类型
export type {
  Plugin,
  PluginMeta,
  PluginConfig,
  PluginDefinition,
  PluginFactory,
  PluginType,
  PluginStatus,
  PluginError
};

// 插件基础抽象类
export abstract class BasePlugin implements Plugin {
  abstract meta: PluginMeta;
  status: PluginStatus = 'uninitialized';
  protected config: PluginConfig = {};

  async init(config: PluginConfig): Promise<void> {
    this.config = config;
    this.status = 'initialized';
  }

  async start(): Promise<void> {
    if (this.status !== 'initialized') {
      throw new Error(`Plugin ${this.meta.name} must be initialized before starting`);
    }
    this.status = 'running';
  }

  async stop(): Promise<void> {
    if (this.status === 'running') {
      this.status = 'stopped';
    }
  }

  async destroy(): Promise<void> {
    await this.stop();
    this.config = {};
    this.status = 'uninitialized';
  }
}

// 插件验证结果
export interface PluginValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// 插件加载结果
export interface PluginLoadResult {
  success: boolean;
  plugin?: Plugin;
  error?: string;
}