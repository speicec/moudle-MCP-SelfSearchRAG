import type { ContentPosition } from './pdf-parser.js';
import type { PageContent, TextBlock, TableBlock, ImageBlock, FormulaBlock, DocumentStructure } from '../core/types.js';

// Re-export DocumentStructure for convenience
export type { DocumentStructure } from '../core/types.js';

/**
 * Block type enumeration
 */
export type BlockType =
  | 'title'
  | 'heading'
  | 'paragraph'
  | 'list'
  | 'table'
  | 'figure'
  | 'caption'
  | 'formula'
  | 'footer'
  | 'sidebar'
  | 'unknown';

/**
 * Segmentation configuration
 */
export interface SegmentationConfig {
  detectTitles: boolean;
  detectHeadings: boolean;
  detectLists: boolean;
  detectCaptions: boolean;
  mergeSmallBlocks: boolean;
  minBlockLength: number;
}

/**
 * Default segmentation configuration
 */
export const DEFAULT_SEGMENTATION_CONFIG: SegmentationConfig = {
  detectTitles: true,
  detectHeadings: true,
  detectLists: true,
  detectCaptions: true,
  mergeSmallBlocks: true,
  minBlockLength: 10,
};

/**
 * Logical block
 */
export interface LogicalBlock {
  id: string;
  type: BlockType;
  content: string;
  position: ContentPosition;
  level?: number; // For headings (1-6)
  listItems?: string[];
  children?: LogicalBlock[];
}

/**
 * Page segmentation result
 */
export interface SegmentationResult {
  pageNumber: number;
  blocks: LogicalBlock[];
  structure: DocumentStructure;
}

/**
 * Page segmenter
 */
export class PageSegmenter {
  private config: SegmentationConfig;

  constructor(config: Partial<SegmentationConfig> = {}) {
    this.config = {
      ...DEFAULT_SEGMENTATION_CONFIG,
      ...config,
    };
  }

  /**
   * Segment a page into logical blocks
   */
  segment(pageContent: PageContent): SegmentationResult {
    const blocks: LogicalBlock[] = [];
    let blockIndex = 0;

    // Process text blocks
    for (const textBlock of pageContent.textBlocks) {
      const logicalBlock = this.classifyTextBlock(textBlock, blockIndex++);
      blocks.push(logicalBlock);
    }

    // Process tables
    for (const tableBlock of pageContent.tables) {
      blocks.push(this.createTableBlock(tableBlock, blockIndex++));
    }

    // Process images
    for (const imageBlock of pageContent.images) {
      blocks.push(this.createImageBlock(imageBlock, blockIndex++));
    }

    // Process formulas
    for (const formulaBlock of pageContent.formulas) {
      blocks.push(this.createFormulaLogicalBlock(formulaBlock, blockIndex++));
    }

    // Sort by position (reading order)
    blocks.sort((a, b) => {
      if (a.position.page !== b.position.page) {
        return a.position.page - b.position.page;
      }
      return a.position.y - b.position.y;
    });

    // Build structure summary
    const structure = this.buildStructure(blocks);

    return {
      pageNumber: pageContent.pageNumber,
      blocks,
      structure,
    };
  }

  /**
   * Classify text block type
   */
  private classifyTextBlock(block: TextBlock, index: number): LogicalBlock {
    const content = block.content;
    const trimmed = content.trim();

    // Title detection (first block, prominent)
    if (this.config.detectTitles && index === 0 && this.isTitle(trimmed)) {
      return {
        id: `block_${index}`,
        type: 'title',
        content: trimmed,
        position: block.position,
      };
    }

    // Heading detection
    if (this.config.detectHeadings && this.isHeading(trimmed)) {
      const level = this.detectHeadingLevel(trimmed);
      return {
        id: `block_${index}`,
        type: 'heading',
        content: trimmed,
        position: block.position,
        level,
      };
    }

    // List detection
    if (this.config.detectLists && this.isList(trimmed)) {
      return {
        id: `block_${index}`,
        type: 'list',
        content: trimmed,
        position: block.position,
        listItems: this.extractListItems(trimmed),
      };
    }

    // Caption detection
    if (this.config.detectCaptions && this.isCaption(trimmed)) {
      return {
        id: `block_${index}`,
        type: 'caption',
        content: trimmed,
        position: block.position,
      };
    }

    // Footer detection
    if (this.isFooter(trimmed)) {
      return {
        id: `block_${index}`,
        type: 'footer',
        content: trimmed,
        position: block.position,
      };
    }

    // Default to paragraph
    return {
      id: `block_${index}`,
      type: 'paragraph',
      content: trimmed,
      position: block.position,
    };
  }

  /**
   * Check if text is a title
   */
  private isTitle(text: string): boolean {
    // Titles are typically short, don't end with period, often uppercase or title case
    return text.length < 100 &&
           !text.endsWith('.') &&
           !text.endsWith(':') &&
           (text === text.toUpperCase() || this.isTitleCase(text));
  }

  /**
   * Check if text is a heading
   */
  private isHeading(text: string): boolean {
    // Headings often:
    // - Start with numbers (1., 1.1, etc.)
    // - Are relatively short
    // - Don't end with periods
    // - May be in title case

    const numberedHeading = /^\d+(\.\d+)*\.?\s+[A-Z]/.test(text);
    const shortAndPunchy = text.length < 80 && !text.endsWith('.');
    const titleCaseOrCaps = this.isTitleCase(text) || text === text.toUpperCase();

    return numberedHeading || (shortAndPunchy && titleCaseOrCaps);
  }

  /**
   * Detect heading level
   */
  private detectHeadingLevel(text: string): number {
    // Check for numbered headings
    const numberedMatch = text.match(/^(\d+)(\.(\d+))*/);
    if (numberedMatch) {
      const dots = (text.match(/\./g) ?? []).length;
      return dots + 1;
    }

    // Infer from characteristics
    if (text === text.toUpperCase() && text.length < 30) {
      return 1;
    }
    if (this.isTitleCase(text) && text.length < 50) {
      return 2;
    }

    return 3;
  }

  /**
   * Check if text is a list
   */
  private isList(text: string): boolean {
    const lines = text.split('\n');
    if (lines.length < 2) return false;

    // Check for bullet or numbered list patterns
    const bulletPattern = /^[-•*]\s+/;
    const numberedPattern = /^\d+[.)]\s+/;

    const listLines = lines.filter(line =>
      bulletPattern.test(line.trim()) ||
      numberedPattern.test(line.trim())
    );

    return listLines.length / lines.length > 0.6;
  }

  /**
   * Extract list items
   */
  private extractListItems(text: string): string[] {
    const lines = text.split('\n');
    const bulletPattern = /^[-•*]\s+/;
    const numberedPattern = /^\d+[.)]\s+/;

    return lines
      .map(line => line.trim())
      .filter(line => bulletPattern.test(line) || numberedPattern.test(line))
      .map(line => line.replace(bulletPattern, '').replace(numberedPattern, '').trim());
  }

  /**
   * Check if text is a caption
   */
  private isCaption(text: string): boolean {
    const captionPatterns = [
      /^Figure\s*\d+/i,
      /^Fig\.\s*\d+/i,
      /^Table\s*\d+/i,
      /^Tab\.\s*\d+/i,
      /^Equation\s*\d+/i,
      /^Eq\.\s*\d+/i,
      /^Chart\s*\d+/i,
      /^Diagram\s*\d+/i,
    ];

    return captionPatterns.some(pattern => pattern.test(text));
  }

  /**
   * Check if text is a footer
   */
  private isFooter(text: string): boolean {
    // Footers often contain page numbers or repeated elements
    return /^Page\s*\d+/i.test(text) ||
           /^—\s*\d+\s*—$/.test(text) ||
           /^\d+\s*$/.test(text);
  }

  /**
   * Check if text is in title case
   */
  private isTitleCase(text: string): boolean {
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const titleCaseWords = words.filter(w => {
      const firstChar = w[0];
      if (!firstChar) return false;
      return firstChar === firstChar.toUpperCase() && w.slice(1).toLowerCase() === w.slice(1);
    });
    return titleCaseWords.length / words.length > 0.7;
  }

  /**
   * Create table block
   */
  private createTableBlock(table: TableBlock, index: number): LogicalBlock {
    return {
      id: `block_${index}`,
      type: 'table',
      content: table.content,
      position: table.position,
      children: table.rows.map((row, rowIndex) => ({
        id: `block_${index}_row_${rowIndex}`,
        type: 'paragraph' as BlockType,
        content: row,
        position: table.position,
      })),
    };
  }

  /**
   * Create image block
   */
  private createImageBlock(image: ImageBlock, index: number): LogicalBlock {
    return {
      id: `block_${index}`,
      type: 'figure',
      content: image.metadata.format ?? '',
      position: image.position,
    };
  }

  /**
   * Create formula block
   */
  private createFormulaLogicalBlock(formula: FormulaBlock, index: number): LogicalBlock {
    return {
      id: `block_${index}`,
      type: 'formula',
      content: formula.latex ?? formula.content,
      position: formula.position,
    };
  }

  /**
   * Build document structure summary
   */
  private buildStructure(blocks: LogicalBlock[]): DocumentStructure {
    return {
      hasTitle: blocks.some(b => b.type === 'title'),
      headingCount: blocks.filter(b => b.type === 'heading').length,
      paragraphCount: blocks.filter(b => b.type === 'paragraph').length,
      tableCount: blocks.filter(b => b.type === 'table').length,
      figureCount: blocks.filter(b => b.type === 'figure').length,
      formulaCount: blocks.filter(b => b.type === 'formula').length,
      listCount: blocks.filter(b => b.type === 'list').length,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<SegmentationConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }
}

/**
 * Create page segmenter
 */
export function createPageSegmenter(
  config?: Partial<SegmentationConfig>
): PageSegmenter {
  return new PageSegmenter(config);
}