/**
 * EnhancedLLMGenerationService Unit Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EnhancedLLMGenerationService, createEnhancedLLMGenerationService } from './enhanced-llm-generation-service.js';
import type { ContextWithConfidence } from '../../retrieval/types.js';

describe('EnhancedLLMGenerationService', () => {
  let service: EnhancedLLMGenerationService;

  const mockContext: ContextWithConfidence[] = [
    { content: '高性能优化方案文档内容', confidence: 0.85, confidenceLevel: 'high', source: 'doc-1', page: 5 },
    { content: '系统架构设计相关文档', confidence: 0.55, confidenceLevel: 'medium', source: 'doc-2', page: 12 },
    { content: '低相关性参考资料', confidence: 0.25, confidenceLevel: 'low', source: 'doc-3' },
  ];

  beforeEach(() => {
    service = createEnhancedLLMGenerationService();
  });

  describe('constructPromptWithConfidence', () => {
    it('should construct prompt with query', () => {
      const prompt = service.constructPromptWithConfidence('什么是性能优化？', mockContext);

      expect(prompt).toContain('用户问题: 什么是性能优化？');
    });

    it('should include confidence labels', () => {
      const prompt = service.constructPromptWithConfidence('测试', mockContext);

      expect(prompt).toContain('高置信度');
      expect(prompt).toContain('中置信度');
      expect(prompt).toContain('低置信度');
    });

    it('should include source metadata', () => {
      const prompt = service.constructPromptWithConfidence('测试', mockContext);

      expect(prompt).toContain('doc-1');
      expect(prompt).toContain('第5页');
      expect(prompt).toContain('doc-2');
    });

    it('should include answer guidelines', () => {
      const prompt = service.constructPromptWithConfidence('测试', mockContext);

      expect(prompt).toContain('回答指南');
      expect(prompt).toContain('可直接引用');
      expect(prompt).toContain('谨慎总结');
      expect(prompt).toContain('不要编造');
    });

    it('should handle empty context', () => {
      const prompt = service.constructPromptWithConfidence('测试', []);

      expect(prompt).toContain('无相关参考资料');
    });
  });

  describe('buildSimplePrompt', () => {
    it('should build simple prompt without confidence', () => {
      const prompt = service.buildSimplePrompt('测试问题', '简单上下文');

      expect(prompt).toContain('用户问题: 测试问题');
      expect(prompt).toContain('参考资料');
      expect(prompt).toContain('简单上下文');
    });
  });

  describe('getPromptStats', () => {
    it('should return prompt statistics', () => {
      const prompt = service.constructPromptWithConfidence('测试', mockContext);
      const stats = service.getPromptStats(prompt);

      expect(stats.length).toBeGreaterThan(0);
      expect(stats.estimatedTokens).toBeGreaterThan(0);
      expect(stats.queryLength).toBe(2); // "测试"
    });
  });

  describe('createSourceSummary', () => {
    it('should create source summary', () => {
      const summary = service.createSourceSummary(mockContext);

      expect(summary).toContain('doc-1');
      expect(summary).toContain('高置信度');
      expect(summary).toContain('第5页');
    });
  });

  describe('validatePrompt', () => {
    it('should validate correct prompt', () => {
      const prompt = service.constructPromptWithConfidence('测试', mockContext);
      const validation = service.validatePrompt(prompt);

      expect(validation.valid).toBe(true);
      expect(validation.errors.length).toBe(0);
    });

    it('should detect missing question', () => {
      const validation = service.validatePrompt('参考资料: test');

      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('question'))).toBe(true);
    });

    it('should detect missing references', () => {
      const validation = service.validatePrompt('用户问题: test');

      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('reference'))).toBe(true);
    });
  });

  describe('createNoMatchPrompt', () => {
    it('should create no-match prompt', () => {
      const prompt = service.createNoMatchPrompt('测试问题', '未找到相关信息');

      expect(prompt).toContain('用户问题: 测试问题');
      expect(prompt).toContain('未找到相关信息');
      expect(prompt).toContain('无法回答');
    });
  });

  describe('edge cases', () => {
    it('should handle context without page', () => {
      const context: ContextWithConfidence[] = [
        { content: '内容', confidence: 0.8, confidenceLevel: 'high', source: 'doc-1' },
      ];

      const prompt = service.constructPromptWithConfidence('测试', context);

      expect(prompt).toContain('doc-1');
      expect(prompt).not.toContain('第null页');
    });

    it('should handle very long content', () => {
      const longContext: ContextWithConfidence[] = [
        { content: '长内容'.repeat(1000), confidence: 0.8, confidenceLevel: 'high', source: 'doc-1' },
      ];

      const prompt = service.constructPromptWithConfidence('测试', longContext);

      expect(prompt.length).toBeGreaterThan(1000);
    });

    it('should handle multiple high confidence chunks', () => {
      const highContext: ContextWithConfidence[] = [
        { content: '内容一', confidence: 0.9, confidenceLevel: 'high', source: 'doc-1' },
        { content: '内容二', confidence: 0.85, confidenceLevel: 'high', source: 'doc-2' },
        { content: '内容三', confidence: 0.8, confidenceLevel: 'high', source: 'doc-3' },
      ];

      const prompt = service.constructPromptWithConfidence('测试', highContext);

      const highCount = (prompt.match(/高置信度/g) || []).length;
      expect(highCount).toBe(3);
    });
  });
});