/**
 * @spec chunking-layer.md#分块验证
 * @layer 2
 * @description 分块验证器实现
 */

import type { Chunk } from '../types/index';
import type { ValidationResult, InvalidChunk, InvalidReason } from './interface';

export interface ValidationConfig {
  minChunkSize?: number;
  maxChunkSize?: number;
  minContentRatio?: number; // 有意义内容最小比例
}

export class ChunkValidator {
  private defaultConfig: ValidationConfig = {
    minChunkSize: 50,
    maxChunkSize: 5000,
    minContentRatio: 0.3
  };

  validate(chunks: Chunk[], config?: ValidationConfig): ValidationResult {
    const finalConfig = { ...this.defaultConfig, ...config };
    const validChunks: Chunk[] = [];
    const invalidChunks: InvalidChunk[] = [];

    const seenContent = new Set<string>();

    for (const chunk of chunks) {
      const invalidReason = this.checkInvalid(chunk, finalConfig, seenContent, validChunks);

      if (invalidReason) {
        invalidChunks.push({
          chunk,
          reason: invalidReason,
          suggestion: this.getSuggestion(invalidReason)
        });
      } else {
        validChunks.push(chunk);
        seenContent.add(chunk.content.trim().slice(0, 100)); // 前100字符用于去重
      }
    }

    return {
      validChunks,
      invalidChunks,
      stats: this.calculateStats(validChunks)
    };
  }

  private checkInvalid(
    chunk: Chunk,
    config: ValidationConfig,
    seenContent: Set<string>,
    validChunks: Chunk[]
  ): InvalidReason | null {
    // 1. 太小检查
    if (chunk.content.length < (config.minChunkSize || 50)) {
      return 'too-small';
    }

    // 2. 太大检查
    if (chunk.content.length > (config.maxChunkSize || 5000)) {
      return 'too-large';
    }

    // 3. 代码完整性检查
    if (chunk.metadata?.type === 'code' && this.isCodeIncomplete(chunk.content)) {
      return 'incomplete';
    }

    // 4. 低质量检查
    if (this.isLowQuality(chunk.content, config.minContentRatio || 0.3)) {
      return 'low-quality';
    }

    // 5. 重复检查
    const contentKey = chunk.content.trim().slice(0, 100);
    if (seenContent.has(contentKey)) {
      return 'duplicate';
    }

    return null;
  }

  private isCodeIncomplete(content: string): boolean {
    // 检查括号匹配
    const braces = { open: 0, close: 0 };
    const parens = { open: 0, close: 0 };
    const brackets = { open: 0, close: 0 };

    for (const char of content) {
      if (char === '{') braces.open++;
      if (char === '}') braces.close++;
      if (char === '(') parens.open++;
      if (char === ')') parens.close++;
      if (char === '[') brackets.open++;
      if (char === ']') brackets.close++;
    }

    return braces.open !== braces.close ||
           parens.open !== parens.close ||
           brackets.open !== brackets.close;
  }

  private isLowQuality(content: string, minRatio: number): boolean {
    // 检查有意义内容比例
    const meaningfulChars = content.replace(/[\s\p{P}]/gu, '');
    const ratio = meaningfulChars.length / content.length;

    if (ratio < minRatio) return true;

    // 检查是否太短且无实质内容
    if (content.length < 20 && !this.hasKeywords(content)) return true;

    return false;
  }

  private hasKeywords(content: string): boolean {
    // 简单关键词检测（有至少3个英文单词或中文词）
    const englishWords = content.match(/[a-zA-Z]{3,}/g) || [];
    const chineseChars = content.match(/[\u4e00-\u9fa5]/g) || [];
    return englishWords.length >= 3 || chineseChars.length >= 10;
  }

  private getSuggestion(reason: InvalidReason): string {
    switch (reason) {
      case 'too-small':
        return '合并到相邻分块';
      case 'too-large':
        return '进一步切分';
      case 'incomplete':
        return '调整边界确保代码完整';
      case 'low-quality':
        return '过滤低质量内容';
      case 'duplicate':
        return '去重处理';
      default:
        return '检查分块内容';
    }
  }

  private calculateStats(chunks: Chunk[]): ValidationResult['stats'] {
    if (chunks.length === 0) {
      return {
        total: 0,
        valid: 0,
        invalid: 0,
        avgChunkSize: 0,
        sizeDistribution: { min: 0, max: 0, median: 0 }
      };
    }

    const sizes = chunks.map(c => c.content.length).sort((a, b) => a - b);
    const median = sizes[Math.floor(sizes.length / 2)];

    return {
      total: chunks.length,
      valid: chunks.length,
      invalid: 0,
      avgChunkSize: Math.round(sizes.reduce((a, b) => a + b, 0) / sizes.length),
      sizeDistribution: {
        min: sizes[0],
        max: sizes[sizes.length - 1],
        median
      }
    };
  }
}

export const chunkValidator = new ChunkValidator();