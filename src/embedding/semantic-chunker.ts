import type { TextBlock, ParsedContent } from '../core/types.js';
import type { TextChunk } from '../core/context.js';
import { ChunkingService, type ChunkingConfig, DEFAULT_CHUNKING_CONFIG } from './chunking.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Semantic chunking configuration
 */
export interface SemanticChunkingConfig extends ChunkingConfig {
  similarityThreshold: number;
  minSimilarityDrop: number;
  embeddingModel?: string;
}

/**
 * Semantic boundary detector
 */
export interface SemanticBoundary {
  position: number;
  confidence: number;
  reason: string;
}

/**
 * Semantic chunker - chunks based on content semantics
 */
export class SemanticChunker extends ChunkingService {
  private semanticConfig: SemanticChunkingConfig;

  constructor(config: Partial<SemanticChunkingConfig> = {}) {
    super(config);
    this.semanticConfig = {
      ...DEFAULT_CHUNKING_CONFIG,
      similarityThreshold: 0.5,
      minSimilarityDrop: 0.3,
      ...config,
    };
  }

  /**
   * Chunk content using semantic boundaries
   */
  chunkSemantically(
    parsedContent: ParsedContent,
    documentId: string
  ): TextChunk[] {
    const chunks: TextChunk[] = [];
    let globalPosition = 0;

    for (const page of parsedContent.pages) {
      const text = page.textBlocks.map(b => b.content).join('\n\n');

      // Detect semantic boundaries
      const boundaries = this.detectSemanticBoundaries(text);

      // Create chunks based on boundaries
      const pageChunks = this.createChunksFromBoundaries(
        text,
        boundaries,
        documentId,
        page.pageNumber,
        globalPosition
      );

      chunks.push(...pageChunks);
      globalPosition += pageChunks.length;
    }

    return chunks;
  }

  /**
   * Detect semantic boundaries in text
   */
  private detectSemanticBoundaries(text: string): SemanticBoundary[] {
    const boundaries: SemanticBoundary[] = [];

    // 1. Detect section headers
    const headerBoundaries = this.detectHeaders(text);
    boundaries.push(...headerBoundaries);

    // 2. Detect topic shifts (simplified - would use embeddings in production)
    const topicBoundaries = this.detectTopicShifts(text);
    boundaries.push(...topicBoundaries);

    // 3. Detect formatting boundaries
    const formatBoundaries = this.detectFormattingChanges(text);
    boundaries.push(...formatBoundaries);

    // Sort by position and deduplicate
    boundaries.sort((a, b) => a.position - b.position);

    return this.deduplicateBoundaries(boundaries);
  }

  /**
   * Detect header positions
   */
  private detectHeaders(text: string): SemanticBoundary[] {
    const boundaries: SemanticBoundary[] = [];
    const lines = text.split('\n');

    let position = 0;
    for (const line of lines) {
      const trimmed = line.trim();

      // Check for numbered headers (1., 1.1, etc.)
      if (/^\d+(\.\d+)*\.?\s+[A-Z]/.test(trimmed)) {
        boundaries.push({
          position,
          confidence: 0.9,
          reason: 'numbered_header',
        });
      }

      // Check for all-caps headers
      if (trimmed === trimmed.toUpperCase() && trimmed.length > 3 && trimmed.length < 50) {
        boundaries.push({
          position,
          confidence: 0.8,
          reason: 'caps_header',
        });
      }

      position += line.length + 1; // +1 for newline
    }

    return boundaries;
  }

  /**
   * Detect topic shift positions (simplified heuristic)
   */
  private detectTopicShifts(text: string): SemanticBoundary[] {
    const boundaries: SemanticBoundary[] = [];

    // Look for transition phrases
    const transitions = [
      'however,', 'moreover,', 'furthermore,', 'in addition,',
      'on the other hand,', 'in contrast,', 'similarly,',
      'therefore,', 'consequently,', 'as a result,',
      'in conclusion,', 'to summarize,', 'next,', 'finally,',
    ];

    const lowerText = text.toLowerCase();
    for (const transition of transitions) {
      let index = lowerText.indexOf(transition);
      while (index !== -1) {
        boundaries.push({
          position: index,
          confidence: 0.6,
          reason: 'transition_phrase',
        });
        index = lowerText.indexOf(transition, index + 1);
      }
    }

    return boundaries;
  }

  /**
   * Detect formatting changes (paragraph breaks, lists, etc.)
   */
  private detectFormattingChanges(text: string): SemanticBoundary[] {
    const boundaries: SemanticBoundary[] = [];

    // Double newline (paragraph break)
    const paragraphBreak = /\n\s*\n/g;
    let match;
    while ((match = paragraphBreak.exec(text)) !== null) {
      boundaries.push({
        position: match.index,
        confidence: 0.5,
        reason: 'paragraph_break',
      });
    }

    // List starts
    const listStart = /\n[-•*]\s+/g;
    while ((match = listStart.exec(text)) !== null) {
      boundaries.push({
        position: match.index,
        confidence: 0.7,
        reason: 'list_start',
      });
    }

    return boundaries;
  }

  /**
   * Remove duplicate boundaries
   */
  private deduplicateBoundaries(boundaries: SemanticBoundary[]): SemanticBoundary[] {
    const result: SemanticBoundary[] = [];
    const minDistance = 50; // Minimum characters between boundaries

    for (const boundary of boundaries) {
      const lastBoundary = result[result.length - 1];

      if (!lastBoundary || boundary.position - lastBoundary.position >= minDistance) {
        result.push(boundary);
      } else if (boundary.confidence > lastBoundary.confidence) {
        // Replace with higher confidence boundary
        result[result.length - 1] = boundary;
      }
    }

    return result;
  }

  /**
   * Create chunks from detected boundaries
   */
  private createChunksFromBoundaries(
    text: string,
    boundaries: SemanticBoundary[],
    documentId: string,
    pageNumber: number,
    startPosition: number
  ): TextChunk[] {
    const chunks: TextChunk[] = [];

    // Add start boundary if not present
    if (boundaries.length === 0 || boundaries[0]!.position > 0) {
      boundaries.unshift({ position: 0, confidence: 1, reason: 'start' });
    }

    // Add end boundary
    boundaries.push({ position: text.length, confidence: 1, reason: 'end' });

    // Create chunks between boundaries
    for (let i = 0; i < boundaries.length - 1; i++) {
      const start = boundaries[i]!.position;
      const end = boundaries[i + 1]!.position;
      const chunkText = text.slice(start, end).trim();

      if (chunkText.length >= this.semanticConfig.minChunkSize) {
        chunks.push({
          id: uuidv4(),
          text: chunkText,
          sourceDocumentId: documentId,
          pageNumber,
          position: startPosition + i,
          metadata: {
            contentType: 'text',
            section: this.detectSectionType(chunkText),
          },
        });
      }
    }

    return chunks;
  }

  /**
   * Detect section type from content
   */
  private detectSectionType(text: string): string {
    const firstLine = text.split('\n')[0]?.trim() ?? '';

    if (/^\d+\./.test(firstLine)) return 'numbered_section';
    if (firstLine === firstLine.toUpperCase() && firstLine.length < 50) return 'header';
    if (/^[-•*]/.test(text.trim())) return 'list';
    if (/^Figure\s*\d/i.test(firstLine)) return 'figure_caption';
    if (/^Table\s*\d/i.test(firstLine)) return 'table_caption';

    return 'paragraph';
  }
}

/**
 * Create semantic chunker
 */
export function createSemanticChunker(
  config?: Partial<SemanticChunkingConfig>
): SemanticChunker {
  return new SemanticChunker(config);
}