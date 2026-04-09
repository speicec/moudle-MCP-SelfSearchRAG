import type { ContentPosition } from './pdf-parser.js';
import type { TextBlock } from '../core/types.js';

/**
 * Text extraction configuration
 */
export interface TextExtractionConfig {
  preserveWhitespace: boolean;
  includeAnnotations: boolean;
  includeHiddenText: boolean;
  mergeFragments: boolean;
  minFragmentLength: number;
}

/**
 * Default text extraction configuration
 */
export const DEFAULT_TEXT_CONFIG: TextExtractionConfig = {
  preserveWhitespace: true,
  includeAnnotations: false,
  includeHiddenText: false,
  mergeFragments: true,
  minFragmentLength: 3,
};

/**
 * Text extraction result for a page
 */
export interface PageTextResult {
  pageNumber: number;
  blocks: TextBlock[];
  totalCharacters: number;
  readingOrder: number[];
}

/**
 * PDF text extractor
 */
export class PDFTextExtractor {
  private config: TextExtractionConfig;

  constructor(config: Partial<TextExtractionConfig> = {}) {
    this.config = {
      ...DEFAULT_TEXT_CONFIG,
      ...config,
    };
  }

  /**
   * Extract text from PDF buffer
   */
  async extract(content: Buffer): Promise<PageTextResult[]> {
    // Dynamic import to avoid bundling issues
    const pdfParse = await import('pdf-parse');

    const data = await pdfParse.default(content);

    const results: PageTextResult[] = [];
    let currentPageNumber = 1;
    let currentText = '';
    let startPosition = 0;

    // Process text per page
    for (let i = 0; i < data.text.length; i++) {
      // Simple page boundary detection based on form feed
      if (data.text[i] === '\f' || i === data.text.length - 1) {
        const pageText = currentText.trim();
        if (pageText.length > 0) {
          const blocks = this.extractTextBlocks(pageText, currentPageNumber, startPosition);
          results.push({
            pageNumber: currentPageNumber,
            blocks,
            totalCharacters: pageText.length,
            readingOrder: blocks.map((_, idx) => idx),
          });
        }

        currentPageNumber++;
        currentText = '';
        startPosition = i + 1;
      } else {
        currentText += data.text[i];
      }
    }

    return results;
  }

  /**
   * Extract text blocks from page text
   */
  private extractTextBlocks(
    text: string,
    pageNumber: number,
    _startPosition: number
  ): TextBlock[] {
    const blocks: TextBlock[] = [];

    // Split text into paragraphs/lines
    const paragraphs = this.splitParagraphs(text);

    for (let i = 0; i < paragraphs.length; i++) {
      const paragraph = paragraphs[i];
      if (!paragraph) continue;

      if (paragraph.length < this.config.minFragmentLength) {
        continue;
      }

      blocks.push({
        type: 'text',
        content: paragraph,
        position: {
          page: pageNumber,
          x: 0,
          y: 0,
          width: 0,
          height: 0,
        },
        blockIndex: i,
        metadata: {
          isHeader: this.isHeader(paragraph),
          isFooter: false,
          fontSize: undefined,
          fontName: undefined,
        },
      });
    }

    return blocks;
  }

  /**
   * Split text into paragraphs
   */
  private splitParagraphs(text: string): string[] {
    // Split by double newline or significant whitespace
    if (this.config.mergeFragments) {
      return text
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter((p) => p.length > 0);
    }

    return text
      .split(/\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
  }

  /**
   * Check if text appears to be a header
   */
  private isHeader(text: string): boolean {
    // Headers are typically short and may have specific patterns
    if (text.length > 100) return false;

    // Check for common header patterns
    const headerPatterns = [
      /^[A-Z\s]+$/, // All caps
      /^\d+\.\s+/, // Numbered section
      /^Chapter\s+/i,
      /^Section\s+/i,
      /^Part\s+/i,
    ];

    return headerPatterns.some((pattern) => pattern.test(text));
  }

  /**
   * Get total text length across all pages
   */
  getTotalTextLength(results: PageTextResult[]): number {
    return results.reduce((sum, page) => sum + page.totalCharacters, 0);
  }

  /**
   * Merge all text into single string
   */
  mergeText(results: PageTextResult[]): string {
    return results
      .map((page) => page.blocks.map((b) => b.content).join('\n'))
      .join('\n\n--- Page Break ---\n\n');
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<TextExtractionConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }
}

/**
 * Create text extractor
 */
export function createTextExtractor(
  config?: Partial<TextExtractionConfig>
): PDFTextExtractor {
  return new PDFTextExtractor(config);
}