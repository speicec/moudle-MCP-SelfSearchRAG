import type { TextBlock, ParsedContent, PageContent } from '../core/types.js';
import type { TextChunk, ChunkMetadata } from '../core/context.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Chunking configuration
 */
export interface ChunkingConfig {
  chunkSize: number;
  overlap: number;
  respectSentenceBoundaries: boolean;
  respectParagraphBoundaries: boolean;
  minChunkSize: number;
}

/**
 * Default chunking configuration
 */
export const DEFAULT_CHUNKING_CONFIG: ChunkingConfig = {
  chunkSize: 512,
  overlap: 50,
  respectSentenceBoundaries: true,
  respectParagraphBoundaries: true,
  minChunkSize: 100,
};

/**
 * Chunking strategy
 */
export type ChunkingStrategy = 'fixed' | 'semantic' | 'sentence' | 'paragraph';

/**
 * Chunking service
 */
export class ChunkingService {
  private config: ChunkingConfig;

  constructor(config: Partial<ChunkingConfig> = {}) {
    this.config = {
      ...DEFAULT_CHUNKING_CONFIG,
      ...config,
    };
  }

  /**
   * Chunk parsed content into text chunks
   */
  chunkContent(parsedContent: ParsedContent, documentId: string): TextChunk[] {
    const chunks: TextChunk[] = [];
    let globalPosition = 0;

    for (const page of parsedContent.pages) {
      const pageChunks = this.chunkPage(page, documentId, globalPosition);
      chunks.push(...pageChunks);
      globalPosition += pageChunks.length;
    }

    return chunks;
  }

  /**
   * Chunk a single page
   */
  private chunkPage(
    page: PageContent,
    documentId: string,
    startPosition: number
  ): TextChunk[] {
    const chunks: TextChunk[] = [];
    const text = this.extractPageText(page);

    if (text.length === 0) {
      return chunks;
    }

    // Split into chunks
    const rawChunks = this.splitIntoChunks(text);

    for (let i = 0; i < rawChunks.length; i++) {
      const chunkText = rawChunks[i]!;

      if (chunkText.length < this.config.minChunkSize && i < rawChunks.length - 1) {
        // Merge small chunks with next
        continue;
      }

      const chunk: TextChunk = {
        id: uuidv4(),
        text: chunkText,
        sourceDocumentId: documentId,
        pageNumber: page.pageNumber,
        position: startPosition + i,
        metadata: {
          contentType: 'text',
          startOffset: i * (this.config.chunkSize - this.config.overlap),
          endOffset: i * (this.config.chunkSize - this.config.overlap) + chunkText.length,
        },
      };

      chunks.push(chunk);
    }

    return chunks;
  }

  /**
   * Extract text from page
   */
  private extractPageText(page: PageContent): string {
    return page.textBlocks
      .map(block => block.content)
      .join('\n\n');
  }

  /**
   * Split text into chunks
   */
  private splitIntoChunks(text: string): string[] {
    if (this.config.respectParagraphBoundaries) {
      return this.splitByParagraphs(text);
    }

    if (this.config.respectSentenceBoundaries) {
      return this.splitBySentences(text);
    }

    return this.splitFixed(text);
  }

  /**
   * Split by paragraph boundaries
   */
  private splitByParagraphs(text: string): string[] {
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim());
    const chunks: string[] = [];
    let currentChunk = '';

    for (const paragraph of paragraphs) {
      if (currentChunk.length + paragraph.length > this.config.chunkSize) {
        if (currentChunk.length > 0) {
          chunks.push(currentChunk.trim());
          // Add overlap from previous chunk
          currentChunk = this.getOverlapText(currentChunk) + paragraph;
        } else {
          // Single paragraph is too large, split by sentences
          const sentenceChunks = this.splitBySentences(paragraph);
          chunks.push(...sentenceChunks);
          currentChunk = '';
        }
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
      }
    }

    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  /**
   * Split by sentence boundaries
   */
  private splitBySentences(text: string): string[] {
    // Simple sentence splitting - production would use NLP library
    const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [text];
    const chunks: string[] = [];
    let currentChunk = '';

    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > this.config.chunkSize) {
        if (currentChunk.length > 0) {
          chunks.push(currentChunk.trim());
          currentChunk = this.getOverlapText(currentChunk) + sentence;
        } else if (sentence.length > this.config.chunkSize) {
          // Sentence is too long, use fixed split
          const fixedChunks = this.splitFixed(sentence);
          chunks.push(...fixedChunks);
        } else {
          currentChunk = sentence;
        }
      } else {
        currentChunk += sentence;
      }
    }

    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  /**
   * Fixed size splitting
   */
  private splitFixed(text: string): string[] {
    const chunks: string[] = [];

    for (let i = 0; i < text.length; i += this.config.chunkSize - this.config.overlap) {
      const chunk = text.slice(i, i + this.config.chunkSize);
      if (chunk.trim().length >= this.config.minChunkSize) {
        chunks.push(chunk.trim());
      }
    }

    return chunks;
  }

  /**
   * Get overlap text from previous chunk
   */
  private getOverlapText(text: string): string {
    if (this.config.overlap === 0) {
      return '';
    }

    const overlapStart = Math.max(0, text.length - this.config.overlap);
    const overlapText = text.slice(overlapStart);

    // Try to start at a word boundary
    const wordStart = overlapText.indexOf(' ');
    if (wordStart > 0 && wordStart < overlapText.length - 10) {
      return overlapText.slice(wordStart + 1);
    }

    return overlapText;
  }

  /**
   * Chunk text blocks directly
   */
  chunkTextBlocks(blocks: TextBlock[], documentId: string): TextChunk[] {
    const text = blocks.map(b => b.content).join('\n\n');
    const rawChunks = this.splitIntoChunks(text);

    return rawChunks.map((chunkText, index) => ({
      id: uuidv4(),
      text: chunkText,
      sourceDocumentId: documentId,
      pageNumber: blocks[0]?.position.page ?? 1,
      position: index,
      metadata: {
        contentType: 'text',
      } as ChunkMetadata,
    }));
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ChunkingConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }

  /**
   * Get current configuration
   */
  getConfig(): ChunkingConfig {
    return { ...this.config };
  }
}

/**
 * Create chunking service
 */
export function createChunkingService(config?: Partial<ChunkingConfig>): ChunkingService {
  return new ChunkingService(config);
}