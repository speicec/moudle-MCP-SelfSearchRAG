/**
 * @spec chunking-layer.md#文本增强
 * @layer 2
 * @description 文本增强器实现
 */

import type { Chunk } from '../types/index';
import type {
  ITextEnhancer,
  EnhancedChunk,
  EnhancementContext,
  EnhancementType
} from './interface';

export class TextEnhancer implements ITextEnhancer {
  async enhance(chunk: Chunk, context: EnhancementContext): Promise<EnhancedChunk> {
    let enhancedContent = chunk.content;
    const enhancementTypes: EnhancementType[] = [];
    const enhancement: EnhancedChunk['enhancement'] = {};

    // 1. 标题增强
    if (context.document.title) {
      enhancedContent = `【${context.document.title}】\n${enhancedContent}`;
      enhancementTypes.push('title-prefix');
      enhancement.addedTitle = context.document.title;
    }

    // 2. 上下文窗口增强
    if (context.prevChunk || context.nextChunk) {
      const windowSize = 100;
      const prevContext = context.prevChunk
        ? `...${context.prevChunk.content.slice(-windowSize)}`
        : '';
      const nextContext = context.nextChunk
        ? `${context.nextChunk.content.slice(0, windowSize)}...`
        : '';

      if (prevContext || nextContext) {
        const contextParts = [
          prevContext && `[前文] ${prevContext}`,
          enhancedContent,
          nextContext && `[后文] ${nextContext}`
        ].filter(Boolean);

        enhancedContent = contextParts.join('\n');
        enhancementTypes.push('context-window');
        enhancement.addedContext = `${prevContext}\n${nextContext}`;
      }
    }

    // 3. 关键词增强
    if (context.document.keywords && context.document.keywords.length > 0) {
      const keywordStr = context.document.keywords.slice(0, 5).join(', ');
      enhancedContent = `[关键词: ${keywordStr}]\n${enhancedContent}`;
      enhancementTypes.push('keyword-injection');
      enhancement.addedKeywords = context.document.keywords.slice(0, 5);
    }

    return {
      ...chunk,
      originalContent: chunk.content,
      enhancedContent,
      enhancementTypes,
      enhancement
    };
  }

  // 批量增强
  async enhanceBatch(
    chunks: Chunk[],
    context: EnhancementContext
  ): Promise<EnhancedChunk[]> {
    return Promise.all(chunks.map((chunk, i) =>
      this.enhance(chunk, {
        ...context,
        prevChunk: chunks[i - 1],
        nextChunk: chunks[i + 1]
      })
    ));
  }
}

export const textEnhancer = new TextEnhancer();