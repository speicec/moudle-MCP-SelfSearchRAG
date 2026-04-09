import type { ContentPosition } from '../parsers/pdf-parser.js';

/**
 * Text block
 */
export interface TextBlock {
  type: 'text';
  content: string;
  position: ContentPosition;
  blockIndex: number;
  metadata: TextBlockMetadata;
}

/**
 * Text block metadata
 */
export interface TextBlockMetadata {
  isHeader?: boolean | undefined;
  isFooter?: boolean | undefined;
  fontSize?: number | undefined;
  fontName?: string | undefined;
}

/**
 * Table block
 */
export interface TableBlock {
  type: 'table';
  content: string;
  position: ContentPosition;
  rows: string[];
  columns: string[];
  cells: TableCellValue[];
  blockIndex: number;
  metadata: TableBlockMetadata;
}

/**
 * Table cell value
 */
export interface TableCellValue {
  rowIndex: number;
  colIndex: number;
  content: string;
}

/**
 * Table block metadata
 */
export interface TableBlockMetadata {
  hasHeaders: boolean;
  headerRow?: number | undefined;
}

/**
 * Image block
 */
export interface ImageBlock {
  type: 'image';
  content: Buffer | string;
  position: ContentPosition;
  blockIndex: number;
  metadata: ImageBlockMetadata;
}

/**
 * Image block metadata
 */
export interface ImageBlockMetadata {
  format?: string | undefined;
  width?: number | undefined;
  height?: number | undefined;
  colorSpace?: string | undefined;
  dataSize?: number | undefined;
}

/**
 * Formula block
 */
export interface FormulaBlock {
  type: 'formula';
  content: string;
  position: ContentPosition;
  latex?: string | undefined;
  blockIndex: number;
  metadata: FormulaBlockMetadata;
}

/**
 * Formula block metadata
 */
export interface FormulaBlockMetadata {
  positionType: 'inline' | 'block' | 'equation_number';
  equationNumber?: string | undefined;
  confidence?: number | undefined;
}

/**
 * Page content
 */
export interface PageContent {
  pageNumber: number;
  textBlocks: TextBlock[];
  tables: TableBlock[];
  images: ImageBlock[];
  formulas: FormulaBlock[];
  structure?: DocumentStructure | undefined;
}

/**
 * Document structure
 */
export interface DocumentStructure {
  hasTitle: boolean;
  headingCount: number;
  paragraphCount: number;
  tableCount: number;
  figureCount: number;
  formulaCount: number;
  listCount: number;
}

/**
 * Parsed content from a document
 */
export interface ParsedContent {
  pages: PageContent[];
  totalPages: number;
  metadata: ParsedMetadata;
}

/**
 * Parsed document metadata
 */
export interface ParsedMetadata {
  title?: string | undefined;
  author?: string | undefined;
  subject?: string | undefined;
  creator?: string | undefined;
  producer?: string | undefined;
  creationDate?: Date | undefined;
  modificationDate?: Date | undefined;
  pageCount: number;
}

/**
 * Content block union type
 */
export type ContentBlock = TextBlock | TableBlock | ImageBlock | FormulaBlock;

/**
 * Embedding vector
 */
export interface EmbeddingVector {
  id: string;
  vector: number[];
  dimension: number;
  modality: 'text' | 'image';
  createdAt: Date;
}

/**
 * Search result
 */
export interface SearchResult {
  id: string;
  score: number;
  content: string;
  sourceDocumentId: string;
  pageNumber?: number | undefined;
  modality: 'text' | 'image';
  metadata: SearchResultMetadata;
}

/**
 * Search result metadata
 */
export interface SearchResultMetadata {
  chunkIndex?: number | undefined;
  contentType?: string | undefined;
  confidence?: number | undefined;
}

/**
 * Query options
 */
export interface QueryOptions {
  topK?: number | undefined;
  threshold?: number | undefined;
  filters?: QueryFilters | undefined;
  includeImages?: boolean | undefined;
}

/**
 * Query filters
 */
export interface QueryFilters {
  documentIds?: string[] | undefined;
  pageNumbers?: number[] | undefined;
  contentTypes?: string[] | undefined;
  dateRange?: {
    start?: Date | undefined;
    end?: Date | undefined;
  } | undefined;
}