/**
 * @spec evaluation.md#单元测试
 * @description 存储层单元测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryCacheStore } from '../../src/storage/cache/memory';

describe('MemoryCacheStore', () => {
  let cache: MemoryCacheStore;

  beforeEach(() => {
    cache = new MemoryCacheStore(100, 60);
  });

  afterEach(async () => {
    await cache.clear();
  });

  it('should set and get value', async () => {
    await cache.set('key1', 'value1');
    const result = await cache.get<string>('key1');
    expect(result).toBe('value1');
  });

  it('should return null for missing key', async () => {
    const result = await cache.get<string>('missing');
    expect(result).toBeNull();
  });

  it('should delete value', async () => {
    await cache.set('key1', 'value1');
    await cache.delete('key1');
    const result = await cache.get<string>('key1');
    expect(result).toBeNull();
  });

  it('should clear all values', async () => {
    await cache.set('key1', 'value1');
    await cache.set('key2', 'value2');
    await cache.clear();
    expect(await cache.get('key1')).toBeNull();
    expect(await cache.get('key2')).toBeNull();
  });

  it('should track hit rate', async () => {
    await cache.set('key1', 'value1');
    await cache.get('key1'); // hit
    await cache.get('missing'); // miss

    const stats = await cache.getStats();
    expect(stats.hitRate).toBe(0.5);
    expect(stats.missRate).toBe(0.5);
  });
});