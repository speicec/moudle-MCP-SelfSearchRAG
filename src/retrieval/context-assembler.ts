import type { SearchResult } from '../core/types.js';
import type { TextChunk } from '../core/context.js';

/**
 * Context assembly options
 */
export interface ContextAssemblyOptions {
  maxLength: number;
  includeMetadata: boolean;
  includeSourceAttribution: boolean;
  separator: string;
}

/**
 * Default context assembly options
 */
export const DEFAULT_ASSEMBLY_OPTIONS: ContextAssemblyOptions = {
  maxLength: 4000,
  includeMetadata: true,
  includeSourceAttribution: true,
  separator: '\n\n---\n\n',
};

/**
 * Assembled context result
 */
export interface AssembledContext {
  text: string;
  sources: ContextSource[];
  totalLength: number;
  truncated: boolean;
}

/**
 * Context source information
 */
export interface ContextSource {
  id: string;
  documentId: string;
  pageNumber?: number | undefined;
  score: number;
  position: number; // Position in assembled context
  length: number;
}

/**
 * Context assembler - builds context from search results
 */
export class ContextAssembler {
  private options: ContextAssemblyOptions;
  private chunkStore: Map<string, TextChunk> = new Map();

  constructor(options: Partial<ContextAssemblyOptions> = {}) {
    this.options = {
      ...DEFAULT_ASSEMBLY_OPTIONS,
      ...options,
    };
  }

  /**
   * Register chunk content for retrieval
   */
  registerChunks(chunks: TextChunk[]): void {
    for (const chunk of chunks) {
      this.chunkStore.set(chunk.id, chunk);
    }
  }

  /**
   * Assemble context from search results
   */
  assemble(results: SearchResult[]): AssembledContext {
    const sources: ContextSource[] = [];
    const parts: string[] = [];
    let totalLength = 0;
    let truncated = false;

    for (const result of results) {
      const chunk = this.chunkStore.get(result.id);
      const content = chunk?.text ?? '';

      if (totalLength + content.length > this.options.maxLength) {
        truncated = true;
        break;
      }

      const part = this.formatPart(result, content);
      parts.push(part);

      const position = totalLength;
      totalLength += part.length + this.options.separator.length;

      sources.push({
        id: result.id,
        documentId: result.sourceDocumentId,
        pageNumber: result.pageNumber,
        score: result.score,
        position,
        length: part.length,
      });
    }

    return {
      text: parts.join(this.options.separator),
      sources,
      totalLength,
      truncated,
    };
  }

  /**
   * Format a single part of the context
   */
  private formatPart(result: SearchResult, content: string): string {
    let part = content;

    if (this.options.includeSourceAttribution) {
      const attribution = this.formatAttribution(result);
      part = `[${attribution}]\n${part}`;
    }

    return part;
  }

  /**
   * Format source attribution
   */
  private formatAttribution(result: SearchResult): string {
    const parts: string[] = [];

    parts.push(`Source: ${result.sourceDocumentId}`);

    if (result.pageNumber) {
      parts.push(`Page ${result.pageNumber}`);
    }

    parts.push(`Score: ${result.score.toFixed(3)}`);

    return parts.join(' | ');
  }

  /**
   * Assemble with content fetching
   */
  async assembleWithContent(
    results: SearchResult[],
    contentFetcher: (id: string) => Promise<string>
  ): Promise<AssembledContext> {
    const sources: ContextSource[] = [];
    const parts: string[] = [];
    let totalLength = 0;
    let truncated = false;

    for (const result of results) {
      const content = await contentFetcher(result.id);

      if (totalLength + content.length > this.options.maxLength) {
        truncated = true;
        break;
      }

      const part = this.formatPart(result, content);
      parts.push(part);

      const position = totalLength;
      totalLength += part.length + this.options.separator.length;

      sources.push({
        id: result.id,
        documentId: result.sourceDocumentId,
        pageNumber: result.pageNumber,
        score: result.score,
        position,
        length: part.length,
      });
    }

    return {
      text: parts.join(this.options.separator),
      sources,
      totalLength,
      truncated,
    };
  }

  /**
   * Clear registered chunks
   */
  clear(): void {
    this.chunkStore.clear();
  }

  /**
   * Update options
   */
  updateOptions(options: Partial<ContextAssemblyOptions>): void {
    this.options = {
      ...this.options,
      ...options,
    };
  }
}

/**
 * Create context assembler
 */
export function createContextAssembler(
  options?: Partial<ContextAssemblyOptions>
): ContextAssembler {
  return new ContextAssembler(options);
}