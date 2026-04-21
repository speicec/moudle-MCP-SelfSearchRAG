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
 * Page diagnostic result for mixed-mode processing
 */
export interface PageTextDiagnostic {
  pageNumber: number;
  text: string;
  charCount: number;
  isEmpty: boolean;  // charCount < threshold
}

/**
 * Default threshold for determining if a page is "empty" (image-based)
 * Pages with fewer than this many characters are considered image pages
 */
export const DEFAULT_EMPTY_PAGE_THRESHOLD = 100;

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
   * Fixed: Use custom pagerender to get per-page results, not \f detection
   */
  async extract(content: Buffer): Promise<PageTextResult[]> {
    // Dynamic import to avoid bundling issues
    const pdfParse = await import('pdf-parse');

    // Custom pagerender callback that returns per-page text
    // This fixes the bug where we relied on \f (form feed) character
    const pageResults: { pageNumber: number; text: string }[] = [];
    let currentPageNum = 0;

    const customPagerender = (pageData: any) => {
      currentPageNum++;
      const renderOptions = {
        normalizeWhitespace: false,
        disableCombineTextItems: false,
      };

      return pageData.getTextContent(renderOptions).then((textContent: any) => {
        let lastY: number | null = null;
        let text = '';

        for (const item of textContent.items) {
          if (lastY === item.transform[5] || lastY === null) {
            text += item.str;
          } else {
            text += '\n' + item.str;
          }
          lastY = item.transform[5];
        }

        pageResults.push({
          pageNumber: currentPageNum,
          text,
        });

        return text;
      });
    };

    // Call pdf-parse with custom pagerender
    const data = await pdfParse.default(content, {
      pagerender: customPagerender,
    });

    // Now pageResults contains properly indexed pages
    const results: PageTextResult[] = [];

    for (const pageResult of pageResults) {
      const pageText = pageResult.text.trim();
      if (pageText.length > 0) {
        const blocks = this.extractTextBlocks(pageText, pageResult.pageNumber, 0);
        results.push({
          pageNumber: pageResult.pageNumber,
          blocks,
          totalCharacters: pageText.length,
          readingOrder: blocks.map((_, idx) => idx),
        });
      } else {
        // Empty page - still include it for proper page counting
        results.push({
          pageNumber: pageResult.pageNumber,
          blocks: [],
          totalCharacters: 0,
          readingOrder: [],
        });
      }
    }

    return results;
  }

  /**
   * Diagnose each page to determine if it's text-based or image-based
   * Used for mixed-mode processing where some pages need OCR
   *
   * @param content PDF buffer
   * @param threshold Minimum characters per page to be considered "text page"
   * @returns Array of page diagnostics
   */
  async diagnose(
    content: Buffer,
    threshold: number = DEFAULT_EMPTY_PAGE_THRESHOLD
  ): Promise<PageTextDiagnostic[]> {
    // Dynamic import to avoid bundling issues
    const pdfParse = await import('pdf-parse');

    // Custom pagerender callback for diagnosis
    const pageResults: { pageNumber: number; text: string }[] = [];
    let currentPageNum = 0;

    const customPagerender = (pageData: any) => {
      currentPageNum++;
      const renderOptions = {
        normalizeWhitespace: false,
        disableCombineTextItems: false,
      };

      return pageData.getTextContent(renderOptions).then((textContent: any) => {
        let lastY: number | null = null;
        let text = '';

        for (const item of textContent.items) {
          if (lastY === item.transform[5] || lastY === null) {
            text += item.str;
          } else {
            text += '\n' + item.str;
          }
          lastY = item.transform[5];
        }

        pageResults.push({
          pageNumber: currentPageNum,
          text,
        });

        return text;
      });
    };

    // Call pdf-parse with custom pagerender
    await pdfParse.default(content, {
      pagerender: customPagerender,
    });

    // Convert to diagnostic results
    const diagnostics: PageTextDiagnostic[] = pageResults.map((pageResult) => {
      const trimmedText = pageResult.text.trim();
      const charCount = trimmedText.length;
      const isEmpty = charCount < threshold;

      return {
        pageNumber: pageResult.pageNumber,
        text: trimmedText,
        charCount,
        isEmpty,
      };
    });

    return diagnostics;
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