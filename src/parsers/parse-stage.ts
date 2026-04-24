import { BasePlugin } from '../core/plugin.js';
import { BaseStage } from '../core/stage.js';
import type { Context, ProcessingState } from '../core/context.js';
import type { ParsedContent, PageContent, TextBlock, TableBlock, ImageBlock, FormulaBlock, ParsedMetadata } from '../core/types.js';
import { PDFTextExtractor, createTextExtractor, type PageTextDiagnostic, type TextExtractionResult, type DiagnosisResult, type PdfMetadataInfo, DEFAULT_EMPTY_PAGE_THRESHOLD } from './text-extractor.js';
import { PDFTableExtractor, createTableExtractor } from './table-extractor.js';
import { PDFImageExtractor, createImageExtractor } from './image-extractor.js';
import { PDFFormulaExtractor, createFormulaExtractor } from './formula-extractor.js';
import { PDFLayoutAnalyzer, createLayoutAnalyzer } from './layout-analyzer.js';
import { PageSegmenter, createPageSegmenter } from './page-segmenter.js';
import { ImagePdfProcessor, createImagePdfProcessor, DEFAULT_IMAGE_PDF_CONFIG } from './image-pdf-processor.js';
import { ProcessingState as State } from '../core/context.js';

/**
 * Medical guideline source patterns for automatic source identification.
 *
 * These patterns enable automatic classification of medical documents based on
 * their title or author metadata, allowing the system to:
 * 1. Apply appropriate authority weight in evidence evaluation
 * 2. Group guidelines by source for analytics
 * 3. Display source information in citation display
 *
 * Authority levels and weights (see evidence-evaluator.ts GUIDELINE_AUTHORITY_MAPPING):
 * - International (weight: 1.0): ADA, KDIGO, ESC, ATA, EASD
 *   These represent global consensus standards with highest evidence authority
 * - National (weight: 0.8): CDS (Chinese Diabetes Society)
 *   These represent regional/national standards with strong but localized authority
 * - Local (weight: 0.6): Regional or institutional guidelines
 *   Not currently pattern-matched, handled as fallback
 *
 * Pattern matching strategy:
 * - Uses case-insensitive regex (flag 'i')
 * - Matches common abbreviations (ADA, KDIGO) and full organization names
 * - Supports bilingual patterns for Chinese sources (CDS)
 *
 * Extensibility:
 * To add a new guideline source, add a new entry following this pattern:
 * ```typescript
 * GUIDELINE_PATTERNS['NEW_SOURCE'] = /NEW_SOURCE|Full Organization Name/i;
 * ```
 *
 * @see src/medical/evidence-evaluator.ts - GUIDELINE_AUTHORITY_MAPPING for weights
 * @see docs/document-metadata.md - Full documentation on guideline identification
 */
const GUIDELINE_PATTERNS: Record<string, RegExp> = {
  // International Guidelines (Authority Level: 1.0)
  'ADA': /ADA|American Diabetes Association|Standards of Care/i,
  'KDIGO': /KDIGO|Kidney Disease: Improving Global Outcomes/i,
  'ESC': /ESC|European Society of Cardiology/i,
  'ATA': /ATA|American Thyroid Association/i,
  'EASD': /EASD|European Association for the Study of Diabetes/i,
  // National Guidelines (Authority Level: 0.8)
  'CDS': /CDS|中国糖尿病学会|中华医学会糖尿病/i,
};

/**
 * Mixed mode processing configuration
 */
export interface MixedModeConfig {
  threshold: number;       // Minimum chars per page to be considered "text page"
  forceOcrAll: boolean;    // Force all pages to go through OCR
  skipEmptyPages: boolean; // Skip completely empty pages
}

/**
 * Default mixed mode configuration
 */
export const DEFAULT_MIXED_MODE_CONFIG: MixedModeConfig = {
  threshold: parseInt(process.env.PDF_MIXED_MODE_THRESHOLD ?? '100', 10),
  forceOcrAll: process.env.PDF_FORCE_OCR_ALL === 'true',
  skipEmptyPages: process.env.PDF_SKIP_EMPTY_PAGES !== 'false', // Default true
};

/**
 * Parse plugin - extracts structured content from documents
 */
export class ParsePlugin extends BasePlugin {
  private textExtractor: PDFTextExtractor;
  private tableExtractor: PDFTableExtractor;
  private imageExtractor: PDFImageExtractor;
  private formulaExtractor: PDFFormulaExtractor;
  private layoutAnalyzer: PDFLayoutAnalyzer;
  private pageSegmenter: PageSegmenter;
  private imagePdfProcessor: ImagePdfProcessor | null = null;
  private mixedModeConfig: MixedModeConfig;

  constructor() {
    super('parse');
    this.textExtractor = createTextExtractor();
    this.tableExtractor = createTableExtractor();
    this.imageExtractor = createImageExtractor();
    this.formulaExtractor = createFormulaExtractor();
    this.layoutAnalyzer = createLayoutAnalyzer();
    this.pageSegmenter = createPageSegmenter();
    this.mixedModeConfig = DEFAULT_MIXED_MODE_CONFIG;

    // 初始化图片PDF处理器（如果OCR服务已配置）
    this.initImagePdfProcessor();
  }

  /**
   * 初始化图片PDF处理器
   */
  private initImagePdfProcessor(): void {
    const ocrServiceUrl = process.env.OCR_SERVICE_URL;

    if (ocrServiceUrl) {
      console.log(`[ParsePlugin] Image PDF processor enabled, OCR service: ${ocrServiceUrl}`);
      // 使用默认配置，仅覆盖OCR服务URL
      this.imagePdfProcessor = createImagePdfProcessor({
        ocr: {
          ...DEFAULT_IMAGE_PDF_CONFIG.ocr,
          serviceUrl: ocrServiceUrl,
        },
      });
    } else {
      console.log('[ParsePlugin] Image PDF processor disabled (OCR_SERVICE_URL not set)');
    }
  }

  /**
   * Process document through parsing
   */
  async process(ctx: Context): Promise<Context> {
    const document = ctx.getDocument();

    if (!document) {
      ctx.addError({
        stage: 'parse',
        plugin: this.name,
        message: 'No document in context',
        recoverable: false,
      });
      return ctx;
    }

    const content = document.content;

    // Handle plain text documents (string or Buffer)
    if (typeof content === 'string') {
      return this.processTextDocument(ctx, content);
    }

    // Handle text format documents (Buffer content with text/plain MIME type)
    if (document.metadata.format === 'text') {
      const textContent = content.toString('utf-8');
      return this.processTextDocument(ctx, textContent);
    }

    // Handle PDF documents
    if (document.metadata.format === 'pdf') {
      return this.processPdfDocument(ctx, content);
    }

    // Handle image documents
    if (document.metadata.format === 'image') {
      return this.processImageDocument(ctx, content);
    }

    ctx.addError({
      stage: 'parse',
      plugin: this.name,
      message: `Unsupported document format: ${document.metadata.format}`,
      recoverable: false,
    });

    return ctx;
  }

  /**
   * Process plain text document
   */
  private async processTextDocument(ctx: Context, content: string): Promise<Context> {
    const pageContent: PageContent = {
      pageNumber: 1,
      textBlocks: [{
        type: 'text',
        content,
        position: { page: 1, x: 0, y: 0, width: 0, height: 0 },
        blockIndex: 0,
        metadata: {},
      }],
      tables: [],
      images: [],
      formulas: [],
    };

    const parsedContent: ParsedContent = {
      pages: [pageContent],
      totalPages: 1,
      metadata: {
        title: undefined,
        author: undefined,
        pageCount: 1,
      },
    };

    ctx.set('parsedContent', parsedContent);
    ctx.setState(State.PARSING);

    return ctx;
  }

  /**
   * Process PDF document with smart mixed-mode handling
   */
  private async processPdfDocument(ctx: Context, content: Buffer): Promise<Context> {
    console.log(`[ParsePlugin] Processing PDF document (${(content.length / 1024 / 1024).toFixed(2)} MB)`);
    console.log(`[ParsePlugin] Mixed mode config: threshold=${this.mixedModeConfig.threshold}, forceOcrAll=${this.mixedModeConfig.forceOcrAll}`);

    // Get filename from document metadata for title fallback
    const document = ctx.getDocument();
    const filename = document?.metadata?.filename;

    try {
      // ========================================
      // Step 1: Diagnose each page and extract PDF metadata
      // ========================================
      console.log('[ParsePlugin] Step 1: Diagnosing PDF pages and extracting metadata...');
      const { diagnostics, pdfMetadata } = await this.textExtractor.diagnose(content, this.mixedModeConfig.threshold);
      console.log(`[ParsePlugin] Diagnosed ${diagnostics.length} pages`);

      // Log extracted metadata
      console.log(`[ParsePlugin] PDF metadata: title=${pdfMetadata.title ?? 'N/A'}, author=${pdfMetadata.author ?? 'N/A'}, creationDate=${pdfMetadata.creationDate?.toISOString() ?? 'N/A'}`);

      // Log diagnosis summary
      const textPages = diagnostics.filter(d => !d.isEmpty);
      const imagePages = diagnostics.filter(d => d.isEmpty);
      const totalChars = diagnostics.reduce((sum, d) => sum + d.charCount, 0);
      console.log(`[ParsePlugin] Diagnosis result: ${textPages.length} text pages, ${imagePages.length} image pages, total ${totalChars} characters`);

      // Build enhanced metadata
      const parsedMetadata = buildParsedMetadata(pdfMetadata, diagnostics.length, filename);
      console.log(`[ParsePlugin] Enhanced metadata: title=${parsedMetadata.title ?? 'N/A'}, year=${parsedMetadata.year ?? 'N/A'}, guidelineSource=${parsedMetadata.guidelineSource ?? 'N/A'}`);

      // ========================================
      // Step 2: Determine processing strategy
      // ========================================
      if (this.mixedModeConfig.forceOcrAll && this.imagePdfProcessor) {
        console.log('[ParsePlugin] Force OCR mode: all pages will go through OCR');
        return this.processAllPagesWithOcr(ctx, content, diagnostics, parsedMetadata);
      }

      // All image pages? Use pure OCR flow
      if (textPages.length === 0) {
        console.log('[ParsePlugin] All pages are image-based, using pure OCR flow');
        return this.processAllPagesWithOcr(ctx, content, diagnostics, parsedMetadata);
      }

      // All text pages? Use pure text extraction
      if (imagePages.length === 0) {
        console.log('[ParsePlugin] All pages are text-based, using pure text extraction');
        return this.processAllPagesWithText(ctx, diagnostics, parsedMetadata);
      }

      // Mixed: some text, some image - use hybrid processing
      console.log('[ParsePlugin] Mixed PDF detected, using hybrid processing');
      return this.processMixedPdfDocument(ctx, content, diagnostics, parsedMetadata);

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'PDF parsing failed';
      console.error(`[ParsePlugin] Error during PDF parsing: ${errorMsg}`);
      if (error instanceof Error && error.stack) {
        console.error(`[ParsePlugin] Stack trace: ${error.stack}`);
      }
      ctx.addError({
        stage: 'parse',
        plugin: this.name,
        message: errorMsg,
        recoverable: false,
      });
    }

    return ctx;
  }

  /**
   * Process all pages using OCR (pure image-based PDF)
   */
  private async processAllPagesWithOcr(
    ctx: Context,
    content: Buffer,
    diagnostics: PageTextDiagnostic[],
    parsedMetadata: ParsedMetadata
  ): Promise<Context> {
    if (!this.imagePdfProcessor) {
      ctx.addError({
        stage: 'parse',
        plugin: this.name,
        message: 'OCR service is not configured. Please set OCR_SERVICE_URL environment variable.',
        recoverable: false,
      });
      return ctx;
    }

    console.log('[ParsePlugin] Processing all pages with OCR...');
    try {
      const ocrParsedContent = await this.imagePdfProcessor.process(content);
      // Merge OCR parsed content with extracted metadata
      const parsedContent: ParsedContent = {
        pages: ocrParsedContent.pages,
        totalPages: ocrParsedContent.totalPages,
        metadata: parsedMetadata,
      };
      ctx.set('parsedContent', parsedContent);
      ctx.setState(State.PARSING);
      console.log(`[ParsePlugin] OCR processing complete: ${parsedContent.pages.length} pages`);
      return ctx;
    } catch (ocrError) {
      const errorMsg = ocrError instanceof Error ? ocrError.message : 'OCR processing failed';
      console.error(`[ParsePlugin] OCR processing failed: ${errorMsg}`);
      ctx.addError({
        stage: 'parse',
        plugin: this.name,
        message: `OCR processing failed: ${errorMsg}`,
        recoverable: false,
      });
      return ctx;
    }
  }

  /**
   * Process all pages using text extraction (pure text-based PDF)
   */
  private async processAllPagesWithText(
    ctx: Context,
    diagnostics: PageTextDiagnostic[],
    parsedMetadata: ParsedMetadata
  ): Promise<Context> {
    console.log('[ParsePlugin] Processing all pages with text extraction...');
    const pages: PageContent[] = [];

    for (const diagnostic of diagnostics) {
      if (this.mixedModeConfig.skipEmptyPages && diagnostic.charCount === 0) {
        console.log(`[ParsePlugin] Skipping empty page ${diagnostic.pageNumber}`);
        continue;
      }

      const pageContent = await this.buildPageContentFromDiagnostic(diagnostic);
      pages.push(pageContent);
    }

    const parsedContent: ParsedContent = {
      pages,
      totalPages: diagnostics.length,
      metadata: parsedMetadata,
    };

    ctx.set('parsedContent', parsedContent);
    ctx.setState(State.PARSING);
    console.log(`[ParsePlugin] Text extraction complete: ${pages.length} pages`);
    return ctx;
  }

  /**
   * Process mixed PDF: text pages + image pages
   */
  private async processMixedPdfDocument(
    ctx: Context,
    content: Buffer,
    diagnostics: PageTextDiagnostic[],
    parsedMetadata: ParsedMetadata
  ): Promise<Context> {
    console.log('[ParsePlugin] Processing mixed PDF document...');

    const textPageDiags = diagnostics.filter(d => !d.isEmpty);
    const imagePageDiags = diagnostics.filter(d => d.isEmpty && d.charCount < this.mixedModeConfig.threshold);

    // Process text pages
    console.log(`[ParsePlugin] Processing ${textPageDiags.length} text pages...`);
    const textPages: PageContent[] = [];
    for (const diag of textPageDiags) {
      const pageContent = await this.buildPageContentFromDiagnostic(diag);
      textPages.push(pageContent);
    }

    // Process image pages with OCR
    let imagePages: PageContent[] = [];
    if (imagePageDiags.length > 0 && this.imagePdfProcessor) {
      console.log(`[ParsePlugin] Processing ${imagePageDiags.length} image pages with OCR...`);
      const imagePageNumbers = imagePageDiags.map(d => d.pageNumber);
      try {
        const ocrResult = await this.imagePdfProcessor.processPages(content, imagePageNumbers);
        imagePages = ocrResult.pages;
      } catch (ocrError) {
        const errorMsg = ocrError instanceof Error ? ocrError.message : 'OCR processing failed';
        console.warn(`[ParsePlugin] OCR processing for image pages failed: ${errorMsg}`);
        // Create empty pages for failed OCR pages
        imagePages = imagePageDiags.map(d => ({
          pageNumber: d.pageNumber,
          textBlocks: [],
          tables: [],
          images: [],
          formulas: [],
        }));
      }
    } else if (imagePageDiags.length > 0 && !this.imagePdfProcessor) {
      console.warn('[ParsePlugin] OCR service not available, image pages will be empty');
      imagePages = imagePageDiags.map(d => ({
        pageNumber: d.pageNumber,
        textBlocks: [],
        tables: [],
        images: [],
        formulas: [],
      }));
    }

    // Merge pages in order
    const mergedPages = this.mergePages(textPages, imagePages);

    const parsedContent: ParsedContent = {
      pages: mergedPages,
      totalPages: diagnostics.length,
      metadata: parsedMetadata,
    };

    ctx.set('parsedContent', parsedContent);
    ctx.setState(State.PARSING);
    console.log(`[ParsePlugin] Mixed processing complete: ${mergedPages.length} pages (${textPages.length} text, ${imagePages.length} OCR)`);
    return ctx;
  }

  /**
   * Build PageContent from a diagnostic result
   */
  private async buildPageContentFromDiagnostic(diagnostic: PageTextDiagnostic): Promise<PageContent> {
    const pageNumber = diagnostic.pageNumber;
    const pageText = diagnostic.text;

    // Extract text blocks
    const paragraphs = pageText
      .split(/\n\s*\n/)
      .map(p => p.trim())
      .filter(p => p.length >= 3);

    const textBlocks: TextBlock[] = paragraphs.map((p, i) => ({
      type: 'text',
      content: p,
      position: { page: pageNumber, x: 0, y: 0, width: 0, height: 0 },
      blockIndex: i,
      metadata: { isHeader: p.length < 100 && /^[A-Z\s]+$|^\d+\.\s+/.test(p), isFooter: false },
    }));

    // Extract tables
    const tables = await this.tableExtractor.extract(pageText, pageNumber);

    // Extract formulas
    const formulas = await this.formulaExtractor.extract(pageText, pageNumber);

    const pageContent: PageContent = {
      pageNumber,
      textBlocks,
      tables,
      images: [],
      formulas,
    };

    // Segment page into logical blocks
    const segmentationResult = this.pageSegmenter.segment(pageContent);
    pageContent.structure = segmentationResult.structure;

    return pageContent;
  }

  /**
   * Merge text pages and image pages, maintaining page order
   */
  private mergePages(textPages: PageContent[], imagePages: PageContent[]): PageContent[] {
    const allPages = [...textPages, ...imagePages];
    // Sort by page number to maintain original order
    allPages.sort((a, b) => a.pageNumber - b.pageNumber);
    return allPages;
  }

  /**
   * Process image document
   */
  private async processImageDocument(ctx: Context, content: Buffer): Promise<Context> {
    // For image documents, we create a single page with the image as content
    const pageContent: PageContent = {
      pageNumber: 1,
      textBlocks: [],
      tables: [],
      images: [{
        type: 'image',
        content,
        position: { page: 1, x: 0, y: 0, width: 0, height: 0 },
        blockIndex: 0,
        metadata: {
          format: ctx.getMetadata()?.mimeType.split('/')[1] ?? 'unknown',
        },
      }],
      formulas: [],
    };

    const parsedContent: ParsedContent = {
      pages: [pageContent],
      totalPages: 1,
      metadata: {
        title: undefined,
        author: undefined,
        pageCount: 1,
      },
    };

    ctx.set('parsedContent', parsedContent);
    ctx.setState(State.PARSING);

    return ctx;
  }
}

/**
 * Parse stage - orchestrates document parsing
 */
export class ParseStage extends BaseStage {
  constructor() {
    super('parse', [new ParsePlugin()]);
  }
}

/**
 * Create parse plugin
 */
export function createParsePlugin(): ParsePlugin {
  return new ParsePlugin();
}

/**
 * Create parse stage
 */
export function createParseStage(): ParseStage {
  return new ParseStage();
}

/**
 * Infer publication year from multiple sources with priority order:
 *
 * Priority rationale for medical documents:
 * 1. Title (highest) - Medical guidelines typically embed year in title
 *    (e.g., "ADA Standards of Care 2024", "KDIGO 2023 Clinical Practice Guideline")
 *    This is the most reliable indicator of publication year.
 *
 * 2. Filename (medium) - Often follows naming convention with year
 *    (e.g., "ADA_2024.pdf", "guideline_2023_final.pdf")
 *    Useful when PDF metadata is incomplete or title lacks year.
 *
 * 3. CreationDate (fallback) - PDF creation date may reflect publication date
 *    but can be misleading (e.g., digitized older documents)
 *
 * Regex patterns used:
 * - Title: `\b(20\d{2}|19\d{2})\b` - Matches standalone year 1900-2099
 * - Filename: `_(20\d{2}|19\d{2})|(20\d{2}|19\d{2})` - Matches year in filename
 *
 * @param title - Document title from PDF info or inferred
 * @param filename - Original file name (with extension)
 * @param creationDate - PDF creation date from metadata
 * @returns Extracted year or undefined if no source available
 *
 * @example
 * inferYear("Standards of Care 2024", "ADA_2024.pdf", new Date(2024, 0, 1))
 * // Returns: 2024 (from title, highest priority)
 *
 * inferYear("General Guidelines", "KDIGO_2023.pdf", undefined)
 * // Returns: 2023 (from filename, title has no year)
 *
 * inferYear("Medical Document", "doc.pdf", new Date(2022, 5, 15))
 * // Returns: 2022 (from creationDate as fallback)
 */
export function inferYear(
  title?: string,
  filename?: string,
  creationDate?: Date
): number | undefined {
  // Step 1: Extract year from title (most reliable for medical guidelines)
  // Medical guideline titles often contain explicit year references
  if (title) {
    // Match standalone 4-digit year (1900-2099) surrounded by word boundaries
    // This avoids false matches like "12345" or partial numbers
    const titleYearMatch = title.match(/\b(20\d{2}|19\d{2})\b/);
    if (titleYearMatch && titleYearMatch[1]) {
      return parseInt(titleYearMatch[1], 10);
    }
  }

  // Step 2: Extract year from filename (e.g., "ADA_2024.pdf", "guideline_2023_final.pdf")
  // Filenames often follow naming conventions that include publication year
  if (filename) {
    // Remove file extension to avoid matching numbers in ".pdf" or similar
    const nameWithoutExt = filename.replace(/\.[^.]+$/, '');
    // Match year preceded by underscore or standalone in filename
    // Pattern: _YYYY or YYYY at word boundary
    const fileYearMatch = nameWithoutExt.match(/_(20\d{2}|19\d{2})|(20\d{2}|19\d{2})/);
    if (fileYearMatch) {
      const yearStr = fileYearMatch[1] ?? fileYearMatch[2];
      if (yearStr) {
        return parseInt(yearStr, 10);
      }
    }
  }

  // Step 3: Use CreationDate year as last resort
  // Note: This may not reflect actual publication date (e.g., digitized documents)
  if (creationDate) {
    return creationDate.getFullYear();
  }

  // No year source available - return undefined
  // System will handle undefined gracefully in evidence evaluation
  return undefined;
}

/**
 * Identify medical guideline source from document title and author metadata.
 *
 * This function scans the combined title and author text against known guideline
 * patterns to determine the source organization. The identified source is then
 * used in evidence evaluation to apply appropriate authority weight.
 *
 * Matching process:
 * 1. Concatenates title and author (both optional) for comprehensive search
 * 2. Tests against each pattern in GUIDELINE_PATTERNS
 * 3. Returns first matching source (order-dependent, international sources first)
 *
 * Usage in pipeline:
 * - Called in buildParsedMetadata() after PDF metadata extraction
 * - Result stored in ParsedMetadata.guidelineSource
 * - Propagated to ChunkMetadata for retrieval results
 * - Used in evidence evaluation for authority weight calculation
 *
 * @param title - Document title from PDF info (may contain organization name)
 * @param author - Document author from PDF info (may contain organization name)
 * @returns Identified guideline source key (e.g., 'ADA', 'KDIGO') or undefined
 *
 * @example
 * identifyGuidelineSource("ADA Standards of Care 2024", undefined)
 * // Returns: 'ADA'
 *
 * identifyGuidelineSource("Clinical Practice Guideline", "KDIGO Work Group")
 * // Returns: 'KDIGO'
 *
 * identifyGuidelineSource("Local Hospital Protocol", undefined)
 * // Returns: undefined (no known guideline source)
 *
 * @see GUIDELINE_PATTERNS - Pattern definitions for known sources
 * @see docs/document-metadata.md#guideline-source-identification - Full documentation
 */
export function identifyGuidelineSource(title?: string, author?: string): string | undefined {
  // Combine title and author for comprehensive pattern matching
  // Some documents have organization in author field rather than title
  const textToCheck = `${title ?? ''} ${author ?? ''}`;

  // Test each pattern in order (international sources listed first in GUIDELINE_PATTERNS)
  for (const [source, pattern] of Object.entries(GUIDELINE_PATTERNS)) {
    if (pattern.test(textToCheck)) {
      return source;
    }
  }

  // No known guideline source identified
  // Document will be classified as 'unknown' in evidence evaluation
  return undefined;
}

/**
 * Build enhanced ParsedMetadata from PDF info and document context.
 *
 * This function aggregates all metadata extraction and inference logic into
 * a single ParsedMetadata object that flows through the document processing pipeline:
 *
 * Processing flow:
 * 1. Title resolution: PDF info → filename fallback (without extension)
 * 2. Year inference: title → filename → creationDate (see inferYear())
 * 3. Guideline identification: title + author pattern matching (see identifyGuidelineSource())
 * 4. Direct PDF metadata: author, subject, creator, producer, dates, pageCount
 *
 * The resulting metadata is:
 * - Stored in ParsedContent.metadata during parse stage
 * - Propagated to ChunkMetadata during chunking
 * - Available in retrieval results for citation display
 * - Used in evidence evaluation for quality scoring
 *
 * Fallback strategies:
 * - Title: PDF info.title → filename (without extension) → undefined
 * - Year: Multi-source inference (see inferYear() for priority)
 * - Guideline: Pattern matching → undefined (unknown source)
 *
 * @param pdfMetadata - Raw metadata extracted from pdf-parse's data.info
 * @param pageCount - Total number of pages in document
 * @param filename - Original filename for title fallback and year inference
 * @returns Complete ParsedMetadata ready for pipeline propagation
 *
 * @see extractPdfMetadata - PDF info extraction in text-extractor.ts
 * @see inferYear - Year inference logic
 * @see identifyGuidelineSource - Guideline source identification
 * @see docs/document-metadata.md - Full API documentation
 */
export function buildParsedMetadata(
  pdfMetadata: import('./text-extractor.js').PdfMetadataInfo,
  pageCount: number,
  filename?: string
): ParsedMetadata {
  // Title resolution: prefer PDF info, fallback to filename (without extension)
  // This ensures human-readable titles in citation display
  const title = pdfMetadata.title ?? (filename ? filename.replace(/\.[^.]+$/, '') : undefined);

  // Year inference: multi-source extraction with priority order
  // Title year is most reliable for medical guidelines
  const year = inferYear(title, filename, pdfMetadata.creationDate);

  // Guideline source identification: pattern matching on title and author
  // Used for authority weight calculation in evidence evaluation
  const guidelineSource = identifyGuidelineSource(title, pdfMetadata.author);

  return {
    title,
    author: pdfMetadata.author,
    subject: pdfMetadata.subject,
    creator: pdfMetadata.creator,
    producer: pdfMetadata.producer,
    creationDate: pdfMetadata.creationDate,
    modificationDate: pdfMetadata.modificationDate,
    pageCount,
    year,
    guidelineSource,
  };
}