import type { TextBlock } from '../core/types.js';

/**
 * Layout type enumeration
 */
export type LayoutType =
  | 'single-column'
  | 'two-column'
  | 'three-column'
  | 'multi-column'
  | 'mixed';

/**
 * Layout region
 */
export interface LayoutRegion {
  type: 'text' | 'header' | 'footer' | 'sidebar' | 'figure' | 'table';
  columnIndex: number;
  startLine: number;
  endLine: number;
  content: string;
}

/**
 * Layout analysis configuration
 */
export interface LayoutAnalysisConfig {
  detectColumns: boolean;
  detectHeaders: boolean;
  detectFooters: boolean;
  detectSidebars: boolean;
  preserveReadingOrder: boolean;
  minColumnWidth: number;
}

/**
 * Default layout analysis configuration
 */
export const DEFAULT_LAYOUT_CONFIG: LayoutAnalysisConfig = {
  detectColumns: true,
  detectHeaders: true,
  detectFooters: true,
  detectSidebars: true,
  preserveReadingOrder: true,
  minColumnWidth: 50,
};

/**
 * Page layout analysis result
 */
export interface PageLayoutResult {
  pageNumber: number;
  layoutType: LayoutType;
  columnCount: number;
  regions: LayoutRegion[];
  readingOrder: number[];
  hasHeaders: boolean;
  hasFooters: boolean;
}

/**
 * PDF layout analyzer
 */
export class PDFLayoutAnalyzer {
  private config: LayoutAnalysisConfig;

  constructor(config: Partial<LayoutAnalysisConfig> = {}) {
    this.config = {
      ...DEFAULT_LAYOUT_CONFIG,
      ...config,
    };
  }

  /**
   * Analyze page layout
   */
  async analyzePage(
    pageText: string,
    pageNumber: number
  ): Promise<PageLayoutResult> {
    const lines = pageText.split('\n');

    // Detect column layout
    const layoutType = this.detectLayoutType(lines);
    const columnCount = this.getColumnCount(layoutType);

    // Detect regions
    const regions = this.detectRegions(lines, columnCount);

    // Determine reading order
    const readingOrder = this.config.preserveReadingOrder
      ? this.determineReadingOrder(regions, layoutType)
      : regions.map((_, idx) => idx);

    // Check for headers and footers
    const hasHeaders = regions.some(r => r.type === 'header');
    const hasFooters = regions.some(r => r.type === 'footer');

    return {
      pageNumber,
      layoutType,
      columnCount,
      regions,
      readingOrder,
      hasHeaders,
      hasFooters,
    };
  }

  /**
   * Detect layout type from line patterns
   */
  private detectLayoutType(lines: string[]): LayoutType {
    // Heuristic: multi-column layouts often have shorter lines
    // and specific indentation patterns

    const avgLineLength = this.calculateAverageLineLength(lines);
    const lineLengthVariance = this.calculateLineLengthVariance(lines);

    // Single column documents typically have longer lines (fill the page width)
    // Two-column have shorter lines (~half width)

    // Check for column indicators
    const columnIndicators = this.detectColumnIndicators(lines);

    if (columnIndicators.threeColumn) {
      return 'three-column';
    }

    if (columnIndicators.twoColumn) {
      return 'two-column';
    }

    if (columnIndicators.multiColumn) {
      return 'multi-column';
    }

    // Fallback based on line length analysis
    if (avgLineLength < 40 && lineLengthVariance < 100) {
      return 'two-column';
    }

    if (avgLineLength < 30) {
      return 'three-column';
    }

    // Check for mixed layout
    if (lineLengthVariance > 200) {
      return 'mixed';
    }

    return 'single-column';
  }

  /**
   * Calculate average line length
   */
  private calculateAverageLineLength(lines: string[]): number {
    const lengths = lines.map(l => l.trim().length);
    return lengths.reduce((sum, len) => sum + len, 0) / lengths.length;
  }

  /**
   * Calculate line length variance
   */
  private calculateLineLengthVariance(lines: string[]): number {
    const lengths = lines.map(l => l.trim().length);
    const avg = this.calculateAverageLineLength(lines);
    const squaredDiffs = lengths.map(len => Math.pow(len - avg, 2));
    return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / lengths.length;
  }

  /**
   * Detect column indicators from indentation patterns
   */
  private detectColumnIndicators(lines: string[]): ColumnIndicators {
    let leftIndented = 0;
    let rightIndented = 0;
    let alternatingIndent = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      const leadingSpaces = line.length - line.trimStart().length;

      // Left column starts at position 0
      if (leadingSpaces === 0) {
        leftIndented++;
      }

      // Right column often has significant indentation
      if (leadingSpaces > 30) {
        rightIndented++;
      }

      // Alternating pattern suggests columns
      if (i > 0) {
        const prevLine = lines[i - 1];
        if (!prevLine) continue;
        const prevSpaces = prevLine.length - prevLine.trimStart().length;
        if (Math.abs(leadingSpaces - prevSpaces) > 20) {
          alternatingIndent++;
        }
      }
    }

    const totalLines = lines.length;
    const leftRatio = leftIndented / totalLines;
    const rightRatio = rightIndented / totalLines;
    const alternatingRatio = alternatingIndent / totalLines;

    return {
      twoColumn: alternatingRatio > 0.3 || (leftRatio > 0.4 && rightRatio > 0.4),
      threeColumn: alternatingRatio > 0.4 && this.avgIndentGroups(lines, 3),
      multiColumn: alternatingRatio > 0.5,
    };
  }

  /**
   * Check if indent patterns suggest N columns
   */
  private avgIndentGroups(lines: string[], expectedGroups: number): boolean {
    const indents = lines.map(l => l.length - l.trimStart().length);
    const uniqueIndents = new Set(indents).size;
    return uniqueIndents >= expectedGroups;
  }

  /**
   * Get column count from layout type
   */
  private getColumnCount(layoutType: LayoutType): number {
    switch (layoutType) {
      case 'single-column': return 1;
      case 'two-column': return 2;
      case 'three-column': return 3;
      case 'multi-column': return 4;
      case 'mixed': return 2; // Default for mixed
      default: return 1;
    }
  }

  /**
   * Detect layout regions
   */
  private detectRegions(lines: string[], columnCount: number): LayoutRegion[] {
    const regions: LayoutRegion[] = [];

    // Detect headers (first few lines, often different formatting)
    if (this.config.detectHeaders && lines.length > 0) {
      const headerRegion = this.detectHeader(lines);
      if (headerRegion) {
        regions.push(headerRegion);
      }
    }

    // Detect footers (last few lines)
    if (this.config.detectFooters && lines.length > 0) {
      const footerRegion = this.detectFooter(lines);
      if (footerRegion) {
        regions.push(footerRegion);
      }
    }

    // Detect main text regions per column
    const textRegions = this.detectTextRegions(lines, columnCount);
    regions.push(...textRegions);

    return regions;
  }

  /**
   * Detect header region
   */
  private detectHeader(lines: string[]): LayoutRegion | null {
    // Headers are typically first 1-3 lines with different characteristics
    const headerCandidate = lines.slice(0, 3);

    // Check if first line looks like a header
    const firstLine = headerCandidate[0]?.trim() ?? '';
    if (firstLine.length < 100 && !firstLine.endsWith('.')) {
      return {
        type: 'header',
        columnIndex: 0,
        startLine: 0,
        endLine: Math.min(2, lines.length - 1),
        content: headerCandidate.join('\n'),
      };
    }

    return null;
  }

  /**
   * Detect footer region
   */
  private detectFooter(lines: string[]): LayoutRegion | null {
    // Footers are typically last 1-2 lines, often with page numbers
    const footerCandidate = lines.slice(-2);

    const lastLine = footerCandidate[footerCandidate.length - 1]?.trim() ?? '';
    // Check for page number pattern
    if (/Page\s*\d+|—\s*\d+\s*—|\d+/.test(lastLine)) {
      return {
        type: 'footer',
        columnIndex: 0,
        startLine: lines.length - 2,
        endLine: lines.length - 1,
        content: footerCandidate.join('\n'),
      };
    }

    return null;
  }

  /**
   * Detect text regions
   */
  private detectTextRegions(lines: string[], columnCount: number): LayoutRegion[] {
    const regions: LayoutRegion[] = [];

    // Simple splitting - full implementation would use position data
    const startLine = 3; // Skip potential header
    const endLine = lines.length - 2; // Skip potential footer

    for (let col = 0; col < columnCount; col++) {
      const regionLines = lines.slice(startLine, endLine);
      regions.push({
        type: 'text',
        columnIndex: col,
        startLine,
        endLine,
        content: regionLines.join('\n'),
      });
    }

    return regions;
  }

  /**
   * Determine reading order for regions
   */
  private determineReadingOrder(
    regions: LayoutRegion[],
    layoutType: LayoutType
  ): number[] {
    // For single column: natural order
    if (layoutType === 'single-column') {
      return regions.map((_, idx) => idx);
    }

    // For multi-column: column by column, left to right
    // This requires proper column position data - simplified here
    const textRegions = regions.filter(r => r.type === 'text');
    const otherRegions = regions.filter(r => r.type !== 'text');

    // Headers first, then text by column, then footers
    const order: number[] = [];

    // Headers
    for (const region of otherRegions.filter(r => r.type === 'header')) {
      order.push(regions.indexOf(region));
    }

    // Text columns (left to right based on columnIndex)
    textRegions.sort((a, b) => a.columnIndex - b.columnIndex);
    for (const region of textRegions) {
      order.push(regions.indexOf(region));
    }

    // Footers last
    for (const region of otherRegions.filter(r => r.type === 'footer')) {
      order.push(regions.indexOf(region));
    }

    return order;
  }

  /**
   * Reconstruct text in reading order
   */
  reconstructInReadingOrder(
    blocks: TextBlock[],
    layoutResult: PageLayoutResult
  ): TextBlock[] {
    const orderedBlocks: TextBlock[] = [];

    for (const regionIndex of layoutResult.readingOrder) {
      const region = layoutResult.regions[regionIndex];
      if (region) {
        // Find blocks in this region
        const regionBlocks = blocks.filter(
          b => b.position.page === layoutResult.pageNumber
        );
        orderedBlocks.push(...regionBlocks);
      }
    }

    return orderedBlocks;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<LayoutAnalysisConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }
}

/**
 * Column detection indicators
 */
interface ColumnIndicators {
  twoColumn: boolean;
  threeColumn: boolean;
  multiColumn: boolean;
}

/**
 * Create layout analyzer
 */
export function createLayoutAnalyzer(
  config?: Partial<LayoutAnalysisConfig>
): PDFLayoutAnalyzer {
  return new PDFLayoutAnalyzer(config);
}