import { BasePlugin } from '../core/plugin.js';
import { BaseStage } from '../core/stage.js';
import type { Context, ProcessingState } from '../core/context.js';
import type { ParsedContent, PageContent, TextBlock, TableBlock, ImageBlock, FormulaBlock } from '../core/types.js';
import { PDFTextExtractor, createTextExtractor, type PageTextDiagnostic, DEFAULT_EMPTY_PAGE_THRESHOLD } from './text-extractor.js';
import { PDFTableExtractor, createTableExtractor } from './table-extractor.js';
import { PDFImageExtractor, createImageExtractor } from './image-extractor.js';
import { PDFFormulaExtractor, createFormulaExtractor } from './formula-extractor.js';
import { PDFLayoutAnalyzer, createLayoutAnalyzer } from './layout-analyzer.js';
import { PageSegmenter, createPageSegmenter } from './page-segmenter.js';
import { ImagePdfProcessor, createImagePdfProcessor, DEFAULT_IMAGE_PDF_CONFIG } from './image-pdf-processor.js';
import { ProcessingState as State } from '../core/context.js';

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

    try {
      // ========================================
      // Step 1: Diagnose each page
      // ========================================
      console.log('[ParsePlugin] Step 1: Diagnosing PDF pages...');
      const diagnostics = await this.textExtractor.diagnose(content, this.mixedModeConfig.threshold);
      console.log(`[ParsePlugin] Diagnosed ${diagnostics.length} pages`);

      // Log diagnosis summary
      const textPages = diagnostics.filter(d => !d.isEmpty);
      const imagePages = diagnostics.filter(d => d.isEmpty);
      const totalChars = diagnostics.reduce((sum, d) => sum + d.charCount, 0);
      console.log(`[ParsePlugin] Diagnosis result: ${textPages.length} text pages, ${imagePages.length} image pages, total ${totalChars} characters`);

      // ========================================
      // Step 2: Determine processing strategy
      // ========================================
      if (this.mixedModeConfig.forceOcrAll && this.imagePdfProcessor) {
        console.log('[ParsePlugin] Force OCR mode: all pages will go through OCR');
        return this.processAllPagesWithOcr(ctx, content, diagnostics);
      }

      // All image pages? Use pure OCR flow
      if (textPages.length === 0) {
        console.log('[ParsePlugin] All pages are image-based, using pure OCR flow');
        return this.processAllPagesWithOcr(ctx, content, diagnostics);
      }

      // All text pages? Use pure text extraction
      if (imagePages.length === 0) {
        console.log('[ParsePlugin] All pages are text-based, using pure text extraction');
        return this.processAllPagesWithText(ctx, diagnostics);
      }

      // Mixed: some text, some image - use hybrid processing
      console.log('[ParsePlugin] Mixed PDF detected, using hybrid processing');
      return this.processMixedPdfDocument(ctx, content, diagnostics);

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
    diagnostics: PageTextDiagnostic[]
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
      const parsedContent = await this.imagePdfProcessor.process(content);
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
    diagnostics: PageTextDiagnostic[]
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
      metadata: {
        title: undefined,
        author: undefined,
        pageCount: diagnostics.length,
      },
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
    diagnostics: PageTextDiagnostic[]
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
      metadata: {
        title: undefined,
        author: undefined,
        pageCount: diagnostics.length,
      },
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