import type { ParsedContent, TextBlock, TableBlock, ImageBlock, FormulaBlock, PageContent } from '../core/types.js';

/**
 * PDF parser configuration
 */
export interface PdfParserConfig {
  extractImages: boolean;
  extractTables: boolean;
  extractFormulas: boolean;
  detectCharts: boolean;
  analyzeLayout: boolean;
  segmentPages: boolean;
  preserveReadingOrder: boolean;
  maxPages: number;
  ocrEnabled: boolean;
}

/**
 * Default PDF parser configuration
 */
export const DEFAULT_PDF_CONFIG: PdfParserConfig = {
  extractImages: true,
  extractTables: true,
  extractFormulas: true,
  detectCharts: true,
  analyzeLayout: true,
  segmentPages: true,
  preserveReadingOrder: true,
  maxPages: 1000,
  ocrEnabled: false,
};

/**
 * PDF parsing result
 */
export interface PdfParsingResult {
  documentId: string;
  totalPages: number;
  pages: PageContent[];
  metadata: PdfMetadata;
  warnings: string[];
}

/**
 * PDF metadata extracted during parsing
 */
export interface PdfMetadata {
  title?: string;
  author?: string;
  subject?: string;
  creator?: string;
  producer?: string;
  creationDate?: Date;
  modificationDate?: Date;
  pageCount: number;
}

/**
 * Abstract PDF parser interface
 */
export interface PdfParser {
  /**
   * Parse PDF content
   */
  parse(content: Buffer, config?: Partial<PdfParserConfig>): Promise<PdfParsingResult>;

  /**
   * Get parser name
   */
  getName(): string;

  /**
   * Check if parser supports specific feature
   */
  supports(feature: PdfParserFeature): boolean;
}

/**
 * PDF parser features
 */
export type PdfParserFeature =
  | 'text-extraction'
  | 'table-extraction'
  | 'image-extraction'
  | 'formula-extraction'
  | 'chart-detection'
  | 'layout-analysis'
  | 'ocr';

/**
 * PDF parsing options for specific operations
 */
export interface PdfExtractionOptions {
  pages?: number[]; // Specific pages to extract
  includeAnnotations?: boolean;
  includeMetadata?: boolean;
  includeBookmarks?: boolean;
}

/**
 * Position information for extracted content
 */
export interface ContentPosition {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Create PDF parser configuration
 */
export function createPdfConfig(config?: Partial<PdfParserConfig>): PdfParserConfig {
  return {
    ...DEFAULT_PDF_CONFIG,
    ...config,
  };
}

/**
 * Check if PDF is encrypted
 */
export function isPdfEncrypted(content: Buffer): boolean {
  // Look for encrypt keyword in PDF header area
  const headerString = content.subarray(0, 1024).toString();
  return headerString.includes('/Encrypt');
}

/**
 * Check if PDF has OCR layer
 */
export function hasOcrLayer(_content: Buffer): boolean {
  // This would require more sophisticated detection
  // For now, return false - actual implementation would check for hidden text layer
  return false;
}

/**
 * Get PDF version
 */
export function getPdfVersion(content: Buffer): string | null {
  const header = content.subarray(0, 8).toString();
  const versionMatch = header.match(/%PDF-(\d\.\d)/);
  return versionMatch?.[1] ?? null;
}