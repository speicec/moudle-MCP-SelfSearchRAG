/**
 * @spec chunking-layer.md#重叠计算
 * @layer 2
 * @description 重叠计算器实现
 */

import type { Chunk } from '../types/index';

export interface OverlapResult {
  overlapText: string;
  overlapSize: number;
  type: 'fixed' | 'semantic' | 'adaptive';
  position: {
    prevEnd: number;
    nextStart: number;
  };
}

export class OverlapCalculator {
  // 固定重叠
  calculateFixed(prevChunk: Chunk, overlapSize: number): OverlapResult {
    const overlapText = prevChunk.content.slice(-overlapSize);
    return {
      overlapText,
      overlapSize,
      type: 'fixed',
      position: {
        prevEnd: prevChunk.position.end,
        nextStart: prevChunk.position.end - overlapSize
      }
    };
  }

  // 语义重叠（在完整句子边界处重叠）
  calculateSemantic(prevChunk: Chunk): OverlapResult {
    const lastSentenceEnd = this.findLastSentenceEnd(prevChunk.content);
    const overlapText = prevChunk.content.slice(lastSentenceEnd);
    return {
      overlapText,
      overlapSize: overlapText.length,
      type: 'semantic',
      position: {
        prevEnd: prevChunk.position.end,
        nextStart: prevChunk.position.start + lastSentenceEnd
      }
    };
  }

  // 自适应重叠（根据语义密度）
  calculateAdaptive(prevChunk: Chunk, nextChunk: Chunk): OverlapResult {
    const density = this.calculateDensity(prevChunk.content);
    const overlapRatio = density === 'high' ? 0.2 : density === 'low' ? 0.05 : 0.1;
    const overlapSize = Math.floor(prevChunk.content.length * overlapRatio);

    // 尝试语义重叠
    const semanticOverlap = this.calculateSemantic(prevChunk);
    if (semanticOverlap.overlapSize <= overlapSize * 1.5) {
      return semanticOverlap;
    }

    return this.calculateFixed(prevChunk, overlapSize);
  }

  // 为所有分块计算重叠
  calculateForChunks(chunks: Chunk[]): Chunk[] {
    if (chunks.length === 0) return chunks;

    const result: Chunk[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];

      if (i === 0) {
        result.push(chunk);
        continue;
      }

      const overlap = this.calculateAdaptive(chunk, chunks[i - 1]);
      // 将重叠添加到当前chunk开头
      const enhancedChunk: Chunk = {
        ...chunk,
        content: overlap.overlapText + chunk.content,
        position: {
          ...chunk.position,
          start: overlap.position.nextStart
        }
      };

      result.push(enhancedChunk);
    }

    return result;
  }

  private findLastSentenceEnd(content: string): number {
    // 查找最后一个完整句子边界
    const match = content.match(/[.!?。！？]\s*[^\s]*$/);
    if (match && match.index !== undefined) {
      return match.index + 1;
    }
    // 查找最后一个段落边界
    const lastNewline = content.lastIndexOf('\n\n');
    if (lastNewline > content.length * 0.5) {
      return lastNewline + 2;
    }
    return content.length - Math.min(50, content.length * 0.1);
  }

  private calculateDensity(content: string): 'high' | 'medium' | 'low' {
    const words = content.split(/\s+/).filter(w => w.length > 0);
    const avgWordLength = words.length > 0
      ? words.reduce((sum, w) => sum + w.length, 0) / words.length
      : 0;

    return avgWordLength > 7 ? 'high' : avgWordLength < 4 ? 'low' : 'medium';
  }
}

export const overlapCalculator = new OverlapCalculator();