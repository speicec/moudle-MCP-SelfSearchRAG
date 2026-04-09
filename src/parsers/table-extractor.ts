import type { ContentPosition } from './pdf-parser.js';
import type { TableBlock } from '../core/types.js';

/**
 * Table extraction configuration
 */
export interface TableExtractionConfig {
  detectBorderlessTables: boolean;
  mergeMultiPageTables: boolean;
  includeHeaders: boolean;
  minRows: number;
  minColumns: number;
}

/**
 * Default table extraction configuration
 */
export const DEFAULT_TABLE_CONFIG: TableExtractionConfig = {
  detectBorderlessTables: true,
  mergeMultiPageTables: true,
  includeHeaders: true,
  minRows: 2,
  minColumns: 2,
};

/**
 * Table cell
 */
export interface TableCell {
  rowIndex: number;
  colIndex: number;
  content: string;
  merged?: boolean;
  rowSpan?: number;
  colSpan?: number;
}

/**
 * Detected table region
 */
export interface TableRegion {
  pageNumber: number;
  position: ContentPosition;
  confidence: number;
}

/**
 * PDF table extractor
 */
export class PDFTableExtractor {
  private config: TableExtractionConfig;

  constructor(config: Partial<TableExtractionConfig> = {}) {
    this.config = {
      ...DEFAULT_TABLE_CONFIG,
      ...config,
    };
  }

  /**
   * Extract tables from PDF page text
   * Note: This is a simplified implementation that uses text patterns
   * A full implementation would use layout analysis or external libraries
   */
  async extract(pageText: string, pageNumber: number): Promise<TableBlock[]> {
    const tables: TableBlock[] = [];
    const potentialTables = this.detectPotentialTables(pageText);

    for (const potential of potentialTables) {
      const parsedTable = this.parseTableStructure(potential);

      if (parsedTable.rows.length >= this.config.minRows &&
          parsedTable.columns.length >= this.config.minColumns) {
        tables.push({
          type: 'table',
          content: potential,
          position: {
            page: pageNumber,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
          },
          rows: parsedTable.rows,
          columns: parsedTable.columns,
          cells: parsedTable.cells,
          blockIndex: tables.length,
          metadata: {
            hasHeaders: parsedTable.hasHeaders,
            headerRow: parsedTable.headerRow,
          },
        });
      }
    }

    return tables;
  }

  /**
   * Detect potential table regions in text
   */
  private detectPotentialTables(text: string): string[] {
    const tables: string[] = [];
    const lines = text.split('\n');

    let tableStart = -1;
    let consecutiveAlignedLines = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]?.trim();
      if (!line) continue;

      // Check if line has consistent spacing suggesting table structure
      const isAligned = this.hasTableAlignment(line);

      if (isAligned) {
        if (tableStart === -1) {
          tableStart = i;
        }
        consecutiveAlignedLines++;
      } else {
        // End of potential table
        if (consecutiveAlignedLines >= this.config.minRows && tableStart !== -1) {
          const tableLines = lines.slice(tableStart, i);
          tables.push(tableLines.join('\n'));
        }
        tableStart = -1;
        consecutiveAlignedLines = 0;
      }
    }

    // Check for table at end of text
    if (consecutiveAlignedLines >= this.config.minRows && tableStart !== -1) {
      const tableLines = lines.slice(tableStart);
      tables.push(tableLines.join('\n'));
    }

    return tables;
  }

  /**
   * Check if line has table-like alignment (multiple columns with separators)
   */
  private hasTableAlignment(line: string): boolean {
    // Check for tab separators
    if (line.includes('\t')) {
      const parts = line.split('\t');
      return parts.length >= this.config.minColumns;
    }

    // Check for pipe separators (markdown-style tables)
    if (line.includes('|')) {
      const parts = line.split('|').filter(p => p.trim());
      return parts.length >= this.config.minColumns;
    }

    // Check for consistent whitespace gaps suggesting column boundaries
    const gapPattern = /\s{2,}/g;
    const gaps = line.match(gapPattern);
    if (gaps && gaps.length >= this.config.minColumns - 1) {
      return true;
    }

    return false;
  }

  /**
   * Parse table structure from text
   */
  private parseTableStructure(tableText: string): ParsedTableStructure {
    const lines = tableText.split('\n').filter(l => l.trim());
    const cells: TableCell[] = [];
    const rows: string[] = [];
    const columns: string[] = [];

    // Detect separator type
    const separator = this.detectSeparator(lines[0] ?? '');

    for (let rowIndex = 0; rowIndex < lines.length; rowIndex++) {
      const line = lines[rowIndex];
      if (!line) continue;
      const parts = this.splitBySeparator(line, separator);

      rows.push(line);

      for (let colIndex = 0; colIndex < parts.length; colIndex++) {
        cells.push({
          rowIndex,
          colIndex,
          content: parts[colIndex]?.trim() ?? '',
        });

        // First row determines column structure
        if (rowIndex === 0) {
          columns.push(parts[colIndex]?.trim() ?? '');
        }
      }
    }

    // Determine if first row is header
    const hasHeaders = this.config.includeHeaders &&
      this.looksLikeHeader(lines[0] ?? '', lines[1]);

    return {
      rows,
      columns,
      cells,
      hasHeaders,
      headerRow: hasHeaders ? 0 : undefined,
    };
  }

  /**
   * Detect separator type from line
   */
  private detectSeparator(line: string): string {
    if (line.includes('\t')) return '\t';
    if (line.includes('|')) return '|';
    return '  '; // Two spaces for whitespace-based tables
  }

  /**
   * Split line by detected separator
   */
  private splitBySeparator(line: string, separator: string): string[] {
    if (separator === '  ') {
      // For whitespace-based tables, split by 2+ spaces
      return line.split(/\s{2,}/).filter(p => p.trim());
    }
    return line.split(separator).filter(p => p.trim());
  }

  /**
   * Check if row looks like header
   */
  private looksLikeHeader(headerLine: string, nextLine?: string): boolean {
    // Headers often have different formatting
    const headerWords = headerLine.split(/\s+/);

    // Check if header words are shorter (typical for headers)
    const avgHeaderLength = headerWords.reduce((sum, w) => sum + w.length, 0) / headerWords.length;

    if (nextLine) {
      const dataWords = nextLine.split(/\s+/);
      const avgDataLength = dataWords.reduce((sum, w) => sum + w.length, 0) / dataWords.length;

      // Headers are typically shorter words
      if (avgHeaderLength < avgDataLength * 0.7) {
        return true;
      }
    }

    // Check for common header patterns (all caps, title case)
    const isAllCaps = headerWords.every(w => w.toUpperCase() === w);
    const isTitleCase = headerWords.every(w =>
      w.charAt(0).toUpperCase() === w.charAt(0) &&
      w.slice(1).toLowerCase() === w.slice(1)
    );

    return isAllCaps || isTitleCase;
  }

  /**
   * Convert table to markdown format
   */
  toMarkdown(table: TableBlock): string {
    const lines: string[] = [];

    // Header row
    if (table.metadata.hasHeaders && table.metadata.headerRow !== undefined) {
      const headerCells = table.cells.filter(c => c.rowIndex === table.metadata.headerRow);
      lines.push('| ' + headerCells.map(c => c.content).join(' | ') + ' |');
      lines.push('| ' + headerCells.map(() => '---').join(' | ') + ' |');
    }

    // Data rows
    const dataRows = table.rows.filter((_, idx) =>
      idx !== table.metadata.headerRow
    );

    for (const row of dataRows) {
      const rowCells = table.cells.filter(c =>
        c.content === row || table.rows.includes(c.content)
      );
      // Simplified - full implementation would properly align cells
      lines.push('| ' + row + ' |');
    }

    return lines.join('\n');
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<TableExtractionConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }
}

/**
 * Parsed table structure
 */
interface ParsedTableStructure {
  rows: string[];
  columns: string[];
  cells: TableCell[];
  hasHeaders: boolean;
  headerRow?: number | undefined;
}

/**
 * Create table extractor
 */
export function createTableExtractor(
  config?: Partial<TableExtractionConfig>
): PDFTableExtractor {
  return new PDFTableExtractor(config);
}