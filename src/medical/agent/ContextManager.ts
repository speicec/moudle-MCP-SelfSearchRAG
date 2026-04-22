/**
 * Context Manager - 上下文管理器
 *
 * Token 计数、上下文窗口管理、动态截断
 */

import type {
  ContextEntry,
  ContextManagerConfig,
} from './ExecutionTypes.js';
import { DEFAULT_CONTEXT_CONFIG } from './ExecutionTypes.js';
import type { SourceCitation } from '../types.js';

/**
 * Context Manager 类
 */
export class ContextManager {
  private entries: ContextEntry[] = [];
  private currentTokens: number = 0;
  private config: ContextManagerConfig;
  private entryIdCounter: number = 0;

  constructor(config?: Partial<ContextManagerConfig>) {
    this.config = { ...DEFAULT_CONTEXT_CONFIG, ...config };
  }

  /**
   * 添加条目
   */
  addEntry(
    type: ContextEntry['type'],
    content: string,
    options?: {
      source?: SourceCitation;
      priority?: number;
      confidence?: number;
    }
  ): ContextEntry {
    const tokens = countTokens(content);
    const entry: ContextEntry = {
      id: `ctx_${++this.entryIdCounter}`,
      type,
      content,
      source: options?.source ?? undefined,
      tokens,
      priority: options?.priority ?? 0.5,
      confidence: options?.confidence ?? 1,
    };

    // 检查是否需要压缩或截断
    const effectiveMaxTokens = this.config.maxTokens - this.config.reserveForOutput;

    if (this.currentTokens + tokens > effectiveMaxTokens) {
      // 达到压缩阈值时先压缩
      if (this.currentTokens / effectiveMaxTokens >= this.config.compressionThreshold) {
        this.compressOrTruncate(tokens);
      } else {
        this.truncateToFit(tokens);
      }
    }

    this.entries.push(entry);
    this.currentTokens += tokens;

    return entry;
  }

  /**
   * 移除条目
   */
  removeEntry(id: string): boolean {
    const index = this.entries.findIndex(e => e.id === id);
    if (index === -1) {
      return false;
    }

    const entry = this.entries[index];
    if (entry) {
      this.entries.splice(index, 1);
      this.currentTokens -= entry.tokens;
    }
    return true;
  }

  /**
   * 压缩或截断低优先级条目
   */
  private compressOrTruncate(neededTokens: number): void {
    const effectiveMaxTokens = this.config.maxTokens - this.config.reserveForOutput;

    // 优先压缩低优先级、低置信度条目
    const lowPriorityEntries = this.entries
      .filter(e => e.priority < 0.5 && !e.compressed)
      .sort((a, b) => a.priority - b.priority);

    // 尝试压缩
    for (const entry of lowPriorityEntries) {
      if (this.currentTokens + neededTokens <= effectiveMaxTokens) {
        break;
      }

      // 压缩条目（保留摘要，不超过100 tokens）
      const summary = compressContent(entry.content);
      const newTokens = countTokens(summary);

      entry.content = summary;
      entry.tokens = newTokens;
      entry.compressed = true;
      this.currentTokens = this.entries.reduce((sum, e) => sum + e.tokens, 0);
    }

    // 如果压缩后仍不够，执行截断
    if (this.currentTokens + neededTokens > effectiveMaxTokens) {
      this.truncateToFit(neededTokens);
    }
  }

  /**
   * 截断条目以适应限制
   */
  private truncateToFit(neededTokens: number): void {
    const effectiveMaxTokens = this.config.maxTokens - this.config.reserveForOutput;
    const targetTokens = effectiveMaxTokens - neededTokens;

    // 按优先级排序（低优先级先移除）
    const sortedEntries = [...this.entries]
      .sort((a, b) => a.priority - b.priority);

    // 确保至少保留1个高置信度条目
    const highConfidenceEntries = this.entries.filter(e => e.confidence >= 0.8);
    const mustRetain = highConfidenceEntries.length > 0
      ? highConfidenceEntries.sort((a, b) => b.priority - a.priority)[0]
      : null;

    for (const entry of sortedEntries) {
      if (entry.id === mustRetain?.id) {
        continue; // 保留高置信度条目
      }

      if (this.currentTokens <= targetTokens) {
        break;
      }

      this.removeEntry(entry.id);
    }
  }

  /**
   * 构建最终上下文
   */
  buildContext(): {
    content: string;
    metadata: {
      totalTokens: number;
      entryCount: number;
      truncated: boolean;
      compressedCount: number;
    };
  } {
    // 按优先级排序（高优先级在前）
    const sortedEntries = [...this.entries]
      .sort((a, b) => b.priority - a.priority);

    // 格式化条目
    const formattedEntries = sortedEntries.map(entry => {
      const sourceStr = entry.source
        ? `[来源: ${entry.source.documentName}${entry.source.year ? ` (${entry.source.year})` : ''}]`
        : '';

      return `${sourceStr}\n${entry.content}`;
    });

    const content = formattedEntries.join('\n\n---\n\n');
    const compressedCount = this.entries.filter(e => e.compressed).length;

    return {
      content,
      metadata: {
        totalTokens: this.currentTokens,
        entryCount: this.entries.length,
        truncated: false,
        compressedCount,
      },
    };
  }

  /**
   * 获取当前 Token 数量
   */
  getCurrentTokens(): number {
    return this.currentTokens;
  }

  /**
   * 获取所有条目
   */
  getEntries(): ContextEntry[] {
    return [...this.entries];
  }

  /**
   * 清空上下文
   */
  clear(): void {
    this.entries = [];
    this.currentTokens = 0;
    this.entryIdCounter = 0;
  }

  /**
   * 检查是否有空间添加条目
   */
  hasSpaceFor(tokens: number): boolean {
    const effectiveMaxTokens = this.config.maxTokens - this.config.reserveForOutput;
    return this.currentTokens + tokens <= effectiveMaxTokens;
  }

  /**
   * 获取剩余可用 Token 数
   */
  getRemainingTokens(): number {
    const effectiveMaxTokens = this.config.maxTokens - this.config.reserveForOutput;
    return effectiveMaxTokens - this.currentTokens;
  }
}

// ==================== Token Counting Utilities ====================

/**
 * Token 计数函数
 *
 * 使用估算方法：中文约1.5 tokens/字符，英文约0.25 tokens/word
 */
export function countTokens(text: string): number {
  // 分离中文和英文部分
  const chineseChars = (text.match(/[一-鿿]/g) || []).length;
  const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
  const otherChars = text.length - chineseChars - (text.match(/[a-zA-Z]+/g) || []).join('').length;

  // 估算：
  // - 中文：约 1.5 tokens/字符
  // - 英文：约 0.25 tokens/单词（更精确）
  // - 其他（数字、符号）：约 0.5 tokens/字符
  const estimatedTokens =
    Math.ceil(chineseChars * 1.5) +
    Math.ceil(englishWords * 1.3) +
    Math.ceil(otherChars * 0.5);

  return Math.max(1, estimatedTokens);
}

/**
 * 压缩内容为摘要（不超过100 tokens）
 */
function compressContent(content: string): string {
  // 简化压缩策略：截断到关键信息
  const maxChars = 200; // 约100 tokens

  if (content.length <= maxChars) {
    return content;
  }

  // 尝试提取关键句子
  const sentences = content.split(/[。！？.!?]/);
  if (sentences.length > 1) {
    // 取前两个关键句子
    const keySentences = sentences.slice(0, 2).filter(s => s.trim().length > 0);
    return keySentences.join('。') + '。';
  }

  // 截断并添加省略标记
  return content.slice(0, maxChars) + '...';
}

/**
 * 创建 Context Manager
 */
export function createContextManager(config?: Partial<ContextManagerConfig>): ContextManager {
  return new ContextManager(config);
}