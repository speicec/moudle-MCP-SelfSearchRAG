/**
 * @spec evaluation.md#单元测试
 * @description 插件系统单元测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PluginRegistry } from '../../src/plugins/registry';
import { BasePlugin } from '../../src/plugins/interface';
import { PluginType } from '../../src/types';

// 测试插件
class TestPlugin extends BasePlugin {
  meta = {
    name: 'test-plugin',
    version: '1.0.0',
    type: 'embedder' as PluginType,
    compatibleVersions: ['1.x']
  };
}

describe('PluginRegistry', () => {
  let registry: PluginRegistry;

  beforeEach(() => {
    registry = new PluginRegistry();
  });

  it('should register plugin definition', () => {
    registry.register({
      meta: {
        name: 'test-plugin',
        version: '1.0.0',
        type: 'embedder',
        compatibleVersions: ['1.x']
      },
      factory: () => new TestPlugin()
    });

    const def = registry.getDefinition('test-plugin');
    expect(def).toBeDefined();
    expect(def?.meta.name).toBe('test-plugin');
  });

  it('should throw error for duplicate registration', () => {
    registry.register({
      meta: { name: 'test', version: '1.0.0', type: 'embedder', compatibleVersions: ['1.x'] },
      factory: () => new TestPlugin()
    });

    expect(() => {
      registry.register({
        meta: { name: 'test', version: '1.0.0', type: 'embedder', compatibleVersions: ['1.x'] },
        factory: () => new TestPlugin()
      });
    }).toThrow('already registered');
  });

  it('should initialize plugin', async () => {
    registry.register({
      meta: { name: 'test', version: '1.0.0', type: 'embedder', compatibleVersions: ['1.x'] },
      factory: () => new TestPlugin()
    });

    const plugin = await registry.init('test');
    expect(plugin.status).toBe('initialized');
  });

  it('should start plugin', async () => {
    registry.register({
      meta: { name: 'test', version: '1.0.0', type: 'embedder', compatibleVersions: ['1.x'] },
      factory: () => new TestPlugin()
    });

    await registry.init('test');
    await registry.start('test');

    const plugin = registry.get('test');
    expect(plugin?.status).toBe('running');
  });

  it('should unregister plugin', async () => {
    registry.register({
      meta: { name: 'test', version: '1.0.0', type: 'embedder', compatibleVersions: ['1.x'] },
      factory: () => new TestPlugin()
    });

    await registry.init('test');
    await registry.unregister('test');

    expect(registry.get('test')).toBeNull();
    expect(registry.getDefinition('test')).toBeNull();
  });
});