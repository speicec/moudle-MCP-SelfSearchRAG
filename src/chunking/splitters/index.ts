/**
 * @spec chunking-layer.md#切分执行
 * @layer 2
 * @description 切分器实现
 */

import type { Document, Chunk } from '../../types/index';
import type { IChunker, ChunkingConfig, ChunkStrategy } from '../interface';

// 基础切分器
export abstract class BaseChunker implements IChunker {
  abstract chunk(document: Document, config?: ChunkingConfig): Promise<Chunk[]>;

  protected createChunk(
    content: string,
    docId: string,
    start: number,
    metadata?: Partial<Chunk['metadata']>
  ): Chunk {
    return {
      id: `${docId}-${start}`,
      docId,
      content,
      position: { start, end: start + content.length },
      metadata: {
        type: 'text',
        ...metadata
      }
    };
  }

  protected generateId(docId: string, index: number): string {
    return `${docId}-chunk-${index}`;
  }
}

// 固定大小切分器
export class FixedSizeChunker extends BaseChunker {
  async chunk(document: Document, config?: ChunkingConfig): Promise<Chunk[]> {
    const chunkSize = config?.chunkSize || 500;
    const overlap = config?.overlap || 50;
    const content = document.content;

    const chunks: Chunk[] = [];
    let start = 0;
    let index = 0;

    while (start < content.length) {
      const end = Math.min(start + chunkSize, content.length);
      const chunkContent = content.slice(start, end);

      chunks.push(this.createChunk(chunkContent, document.id, start));
      index++;

      // 下一个chunk开始位置（考虑overlap）
      start = end - overlap;
      if (start + overlap >= content.length) break;
    }

    return chunks;
  }
}

// 递归切分器
export class RecursiveChunker extends BaseChunker {
  async chunk(document: Document, config?: ChunkingConfig): Promise<Chunk[]> {
    const chunkSize = config?.chunkSize || 500;
    const overlap = config?.overlap || 50;
    const separators = config?.separators || ['\n\n', '\n', '. ', ' ', ''];

    return this.recursiveSplit(
      document.content,
      separators,
      chunkSize,
      overlap,
      document.id,
      0
    );
  }

  private recursiveSplit(
    content: string,
    separators: string[],
    chunkSize: number,
    overlap: number,
    docId: string,
    level: number,
    baseIndex: number = 0
  ): Chunk[] {
    if (content.length <= chunkSize) {
      return [this.createChunk(content, docId, baseIndex)];
    }

    const separator = separators[level];
    if (!separator) {
      // 最后层级，强制按字符切分
      return this.splitByChars(content, chunkSize, overlap, docId, baseIndex);
    }

    const segments = content.split(separator);
    const chunks: Chunk[] = [];
    let currentChunk = '';
    let currentStart = baseIndex;
    let index = 0;

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const segmentWithSep = i > 0 ? separator + segment : segment;

      if (currentChunk.length + segmentWithSep.length > chunkSize) {
        if (currentChunk.length > 0) {
          chunks.push(this.createChunk(currentChunk, docId, currentStart));
          index++;
        }

        if (segment.length > chunkSize) {
          // 单个segment超限，递归下一级
          const subChunks = this.recursiveSplit(
            segment,
            separators,
            chunkSize,
            overlap,
            docId,
            level + 1,
            currentStart + currentChunk.length
          );
          chunks.push(...subChunks);
          currentChunk = '';
          currentStart = subChunks[subChunks.length - 1]?.position.end || currentStart;
        } else {
          currentChunk = segment;
          currentStart = currentStart + currentChunk.length;
        }
      } else {
        currentChunk += segmentWithSep;
      }
    }

    if (currentChunk.length > 0) {
      chunks.push(this.createChunk(currentChunk, docId, currentStart));
    }

    return chunks;
  }

  private splitByChars(
    content: string,
    chunkSize: number,
    overlap: number,
    docId: string,
    baseIndex: number
  ): Chunk[] {
    const chunks: Chunk[] = [];
    let start = 0;

    while (start < content.length) {
      const end = Math.min(start + chunkSize, content.length);
      chunks.push(this.createChunk(content.slice(start, end), docId, start + baseIndex));
      start = end - overlap;
      if (start >= content.length - overlap) break;
    }

    return chunks;
  }
}

// Markdown章节切分器
export class MarkdownSectionChunker extends BaseChunker {
  async chunk(document: Document, config?: ChunkingConfig): Promise<Chunk[]> {
    const content = document.content;
    const maxSize = config?.maxChunkSize || 2000;

    // 按标题分割
    const headingPattern = /^#{1,6}\s+.+$/gm;
    const matches = [...content.matchAll(headingPattern)];

    const chunks: Chunk[] = [];
    let prevEnd = 0;

    for (let i = 0; i <= matches.length; i++) {
      const start = i === 0 ? 0 : matches[i - 1].index!;
      const end = i === matches.length ? content.length : matches[i].index!;
      const sectionContent = content.slice(start, end);

      if (sectionContent.trim().length === 0) continue;

      // 如果section太大，需要进一步切分
      if (sectionContent.length > maxSize) {
        const subChunker = new RecursiveChunker();
        const subChunks = await subChunker.chunk(
          { ...document, content: sectionContent },
          { chunkSize: maxSize / 2 }
        );
        // 调整位置
        subChunks.forEach(c => {
          c.position.start += start;
          c.position.end += start;
          c.id = `${document.id}-section-${start}-${c.position.start}`;
        });
        chunks.push(...subChunks);
      } else {
        chunks.push(this.createChunk(sectionContent, document.id, start, { section: this.extractTitle(sectionContent) }));
      }
    }

    return chunks;
  }

  private extractTitle(section: string): string {
    const match = section.match(/^#{1,6}\s+(.+)$/m);
    return match ? match[1].trim() : '';
  }
}

// 滑动窗口切分器
export class SlidingWindowChunker extends BaseChunker {
  async chunk(document: Document, config?: ChunkingConfig): Promise<Chunk[]> {
    const windowSize = config?.chunkSize || 500;
    const stepSize = windowSize - (config?.overlap || 100);
    const content = document.content;

    const chunks: Chunk[] = [];
    let start = 0;
    let index = 0;

    while (start < content.length) {
      const end = Math.min(start + windowSize, content.length);
      const chunkContent = content.slice(start, end);

      chunks.push(this.createChunk(
        chunkContent,
        document.id,
        start,
        { section: `window-${index}` }
      ));

      index++;
      start += stepSize;
    }

    return chunks;
  }
}

// 切分器工厂
export function createChunker(strategy: ChunkStrategy): IChunker {
  switch (strategy) {
    case 'fixed-size':
      return new FixedSizeChunker();
    case 'recursive':
      return new RecursiveChunker();
    case 'markdown-section':
      return new MarkdownSectionChunker();
    case 'sliding-window':
      return new SlidingWindowChunker();
    default:
      return new RecursiveChunker();
  }
}