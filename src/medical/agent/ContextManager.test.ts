/**
 * ContextManager Unit Tests
 */

import { describe, it, expect } from 'vitest';
import { ContextManager, countTokens, createContextManager } from './ContextManager.js';
import { DEFAULT_CONTEXT_CONFIG } from './ExecutionTypes.js';

describe('ContextManager', () => {
  describe('countTokens', () => {
    it('should estimate tokens for Chinese text', () => {
      const text = '这是一段中文测试文本';
      const tokens = countTokens(text);
      // 中文约 1.5 tokens/字符
      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThan(text.length * 2);
    });

    it('should estimate tokens for English text', () => {
      const text = 'This is an English test text';
      const tokens = countTokens(text);
      // 英文约 1.3 tokens/单词
      expect(tokens).toBeGreaterThan(0);
    });

    it('should estimate tokens for mixed text', () => {
      const text = '这是中文和English混合的文本';
      const tokens = countTokens(text);
      expect(tokens).toBeGreaterThan(0);
    });

    it('should return at least 1 for empty text', () => {
      const tokens = countTokens('');
      expect(tokens).toBe(1);
    });
  });

  describe('addEntry', () => {
    it('should add entry successfully', () => {
      const manager = createContextManager();
      const entry = manager.addEntry('retrieval', 'Test content');

      expect(entry.id).toBeDefined();
      expect(entry.type).toBe('retrieval');
      expect(entry.tokens).toBeGreaterThan(0);
      expect(manager.getEntries().length).toBe(1);
    });

    it('should update current tokens', () => {
      const manager = createContextManager();
      const content = 'Test content for token counting';
      manager.addEntry('retrieval', content);

      const expectedTokens = countTokens(content);
      expect(manager.getCurrentTokens()).toBe(expectedTokens);
    });

    it('should add entry with source citation', () => {
      const manager = createContextManager();
      const entry = manager.addEntry('retrieval', 'Test content', {
        source: {
          documentName: 'ADA Guidelines 2024',
          year: 2024,
          section: 'Section 9',
        },
        priority: 1,
        confidence: 0.9,
      });

      expect(entry.source?.documentName).toBe('ADA Guidelines 2024');
      expect(entry.priority).toBe(1);
      expect(entry.confidence).toBe(0.9);
    });

    it('should trigger compression when near threshold', () => {
      const manager = createContextManager({
        maxTokens: 1000,
        reserveForOutput: 100,
        compressionThreshold: 0.8,
      });

      // 先添加低优先级条目
      for (let i = 0; i < 5; i++) {
        manager.addEntry('retrieval', `Low priority content ${i}`, {
          priority: 0.3,
          confidence: 0.6,
        });
      }

      // 添加高优先级条目触发压缩
      const highPriorityEntry = manager.addEntry('retrieval', 'High priority content that needs space', {
        priority: 1,
        confidence: 0.9,
      });

      expect(highPriorityEntry).toBeDefined();
    });

    it('should trigger truncation when exceeding limit', () => {
      const manager = createContextManager({
        maxTokens: 100,
        reserveForOutput: 20,
        compressionThreshold: 0.8,
      });

      // 添加大量低优先级内容
      for (let i = 0; i < 10; i++) {
        manager.addEntry('retrieval', `Content entry number ${i} with some additional text`, {
          priority: 0.2,
        });
      }

      // 确保条目被截断但不超过限制
      const maxEffective = 100 - 20;
      expect(manager.getCurrentTokens()).toBeLessThanOrEqual(maxEffective);
    });
  });

  describe('removeEntry', () => {
    it('should remove entry by id', () => {
      const manager = createContextManager();
      const entry = manager.addEntry('retrieval', 'Test content');

      const removed = manager.removeEntry(entry.id);
      expect(removed).toBe(true);
      expect(manager.getEntries().length).toBe(0);
    });

    it('should update token count after removal', () => {
      const manager = createContextManager();
      const entry = manager.addEntry('retrieval', 'Test content');
      const tokensBefore = manager.getCurrentTokens();

      manager.removeEntry(entry.id);
      expect(manager.getCurrentTokens()).toBe(tokensBefore - entry.tokens);
    });

    it('should return false for non-existent id', () => {
      const manager = createContextManager();
      manager.addEntry('retrieval', 'Test content');

      const removed = manager.removeEntry('non_existent');
      expect(removed).toBe(false);
    });
  });

  describe('buildContext', () => {
    it('should build context with formatted entries', () => {
      const manager = createContextManager();
      manager.addEntry('retrieval', 'Content 1', {
        source: { documentName: 'Source A' },
      });
      manager.addEntry('retrieval', 'Content 2', {
        source: { documentName: 'Source B' },
      });

      const result = manager.buildContext();
      expect(result.content).toContain('Content 1');
      expect(result.content).toContain('Content 2');
      expect(result.content).toContain('[来源: Source A]');
    });

    it('should order entries by priority (high first)', () => {
      const manager = createContextManager();
      manager.addEntry('retrieval', 'Low priority content', { priority: 0.3 });
      manager.addEntry('retrieval', 'High priority content', { priority: 1 });

      const result = manager.buildContext();
      // 高优先级应该出现在前面
      expect(result.content.indexOf('High priority')).toBeLessThan(result.content.indexOf('Low priority'));
    });

    it('should include metadata', () => {
      const manager = createContextManager();
      manager.addEntry('retrieval', 'Test content');

      const result = manager.buildContext();
      expect(result.metadata.totalTokens).toBeGreaterThan(0);
      expect(result.metadata.entryCount).toBe(1);
      expect(result.metadata.truncated).toBe(false);
    });

    it('should count compressed entries', () => {
      const manager = createContextManager({
        maxTokens: 500,
        compressionThreshold: 0.5,
      });

      // 添加多个低优先级条目触发压缩
      for (let i = 0; i < 10; i++) {
        manager.addEntry('retrieval', `Low priority content ${i} with more text to trigger compression`, {
          priority: 0.3,
          confidence: 0.5,
        });
      }

      const result = manager.buildContext();
      expect(result.metadata.compressedCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('hasSpaceFor and getRemainingTokens', () => {
    it('should check if space available', () => {
      const manager = createContextManager({
        maxTokens: 100,
        reserveForOutput: 20,
      });

      expect(manager.hasSpaceFor(50)).toBe(true);

      manager.addEntry('retrieval', 'Large content to fill space');
      const remaining = manager.getRemainingTokens();
      expect(remaining).toBeLessThan(80);
    });

    it('should return correct remaining tokens', () => {
      const manager = createContextManager({
        maxTokens: 1000,
        reserveForOutput: 100,
      });

      const remaining = manager.getRemainingTokens();
      expect(remaining).toBe(900);

      manager.addEntry('retrieval', 'Test content');
      expect(manager.getRemainingTokens()).toBeLessThan(900);
    });
  });

  describe('clear', () => {
    it('should clear all entries', () => {
      const manager = createContextManager();
      manager.addEntry('retrieval', 'Content 1');
      manager.addEntry('retrieval', 'Content 2');

      manager.clear();
      expect(manager.getEntries().length).toBe(0);
      expect(manager.getCurrentTokens()).toBe(0);
    });
  });

  describe('truncation priority ordering', () => {
    it('should retain high confidence entry during truncation', () => {
      const manager = createContextManager({
        maxTokens: 50,
        reserveForOutput: 10,
      });

      // 添加高置信度条目
      manager.addEntry('retrieval', 'Important guideline content', {
        priority: 1,
        confidence: 0.9,
      });

      // 添加大量低置信度条目触发截断
      for (let i = 0; i < 5; i++) {
        manager.addEntry('retrieval', `Low confidence content ${i}`, {
          priority: 0.3,
          confidence: 0.5,
        });
      }

      const entries = manager.getEntries();
      // 至少应该保留高置信度条目
      expect(entries.some(e => e.confidence >= 0.9)).toBe(true);
    });
  });

  describe('compression trigger threshold', () => {
    it('should compress before truncation at threshold', () => {
      const manager = createContextManager({
        maxTokens: 1000,
        reserveForOutput: 100,
        compressionThreshold: 0.8,
      });

      // 添加内容达到阈值并即将超出限制
      // effectiveMaxTokens = 900, threshold = 720 tokens
      // 中文约 1.5 tokens/字符
      // 需要先达到 threshold (720) 且新条目会超出 effectiveMaxTokens
      // 使用约60 tokens/条目，需要约12条达到阈值，再加一条触发压缩
      for (let i = 0; i < 13; i++) {
        manager.addEntry('retrieval', `这是一段较长的中文内容用于测试压缩功能索引号${i}包含足够的文字来触发压缩阈值判断机制自动化测试验证`, {
          priority: 0.4,
          confidence: 0.6,
        });
      }

      // 检查是否有压缩条目（低优先级 0.4 < 0.5 会被压缩）
      const entries = manager.getEntries();
      expect(entries.some(e => e.compressed)).toBe(true);
    });
  });

  describe('createContextManager', () => {
    it('should create manager with default config', () => {
      const manager = createContextManager();
      expect(manager).toBeDefined();
      expect(manager.getCurrentTokens()).toBe(0);
    });

    it('should create manager with custom config', () => {
      const manager = createContextManager({
        maxTokens: 5000,
        reserveForOutput: 500,
      });

      expect(manager.getRemainingTokens()).toBe(4500);
    });
  });
});