import { BasePlugin } from '../core/plugin.js';
import { BaseStage } from '../core/stage.js';
import type { Context, ProcessingState } from '../core/context.js';
import type { ParsedContent, PageContent, TextBlock, TableBlock, ImageBlock, FormulaBlock } from '../core/types.js';
import { PDFTextExtractor, createTextExtractor } from './text-extractor.js';
import { PDFTableExtractor, createTableExtractor } from './table-extractor.js';
import { PDFImageExtractor, createImageExtractor } from './image-extractor.js';
import { PDFFormulaExtractor, createFormulaExtractor } from './formula-extractor.js';
import { PDFLayoutAnalyzer, createLayoutAnalyzer } from './layout-analyzer.js';
import { PageSegmenter, createPageSegmenter } from './page-segmenter.js';
import { ProcessingState as State } from '../core/context.js';

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

  constructor() {
    super('parse');
    this.textExtractor = createTextExtractor();
    this.tableExtractor = createTableExtractor();
    this.imageExtractor = createImageExtractor();
    this.formulaExtractor = createFormulaExtractor();
    this.layoutAnalyzer = createLayoutAnalyzer();
    this.pageSegmenter = createPageSegmenter();
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
    if (typeof content === 'string') {
      // Handle plain text documents
      return this.processTextDocument(ctx, content);
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
   * Process PDF document
   */
  private async processPdfDocument(ctx: Context, content: Buffer): Promise<Context> {
    try {
      // Extract text
      const textResults = await this.textExtractor.extract(content);

      // Build page contents
      const pages: PageContent[] = [];

      for (const textResult of textResults) {
        const pageNumber = textResult.pageNumber;

        // Extract tables for this page
        const pageText = textResult.blocks.map(b => b.content).join('\n');
        const tables = await this.tableExtractor.extract(pageText, pageNumber);

        // Extract formulas
        const formulas = await this.formulaExtractor.extract(pageText, pageNumber);

        // Layout analysis
        const layoutResult = await this.layoutAnalyzer.analyzePage(pageText, pageNumber);

        // Create page content
        const pageContent: PageContent = {
          pageNumber,
          textBlocks: textResult.blocks,
          tables,
          images: [], // Will be populated by image extractor if needed
          formulas,
        };

        // Segment page into logical blocks
        const segmentationResult = this.pageSegmenter.segment(pageContent);
        pageContent.structure = segmentationResult.structure;

        pages.push(pageContent);
      }

      // Extract images (placeholder - full implementation would parse PDF structure)
      const images = await this.imageExtractor.extract(content);
      // Distribute images to pages based on position

      const parsedContent: ParsedContent = {
        pages,
        totalPages: pages.length,
        metadata: {
          title: undefined,
          author: undefined,
          pageCount: pages.length,
        },
      };

      ctx.set('parsedContent', parsedContent);
      ctx.setState(State.PARSING);

    } catch (error) {
      ctx.addError({
        stage: 'parse',
        plugin: this.name,
        message: error instanceof Error ? error.message : 'PDF parsing failed',
        recoverable: false,
      });
    }

    return ctx;
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