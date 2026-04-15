import type { ParsedContent, PageContent, TextBlock, TableBlock, ImageBlock, FormulaBlock } from '../core/types.js';
import type { ContentPosition } from './pdf-parser.js';
import { PdfToImageConverter, createPdfToImageConverter, type PageImage, type PageCoordinateInfo } from './pdf-to-image-converter.js';
import { LayoutOcrService, createLayoutOcrService, type OcrBlock, type OcrPageResult, type TableCell } from './layout-ocr-service.js';

/**
 * 图片PDF处理配置
 */
export interface ImagePdfConfig {
  render: {
    scale: number;
    format: 'png' | 'jpeg';
  };
  ocr: {
    serviceUrl: string;
    timeoutMs: number;
    batchSize: number;
    maxPages?: number;        // 最大处理页数限制
  };
  enableVlm: boolean;        // 是否启用VLM增强（后续集成）
}

export const DEFAULT_IMAGE_PDF_CONFIG: ImagePdfConfig = {
  render: {
    scale: 2,                 // 144dpi
    format: 'png',
  },
  ocr: {
    serviceUrl: process.env.OCR_SERVICE_URL ?? 'http://localhost:8080',
    // 大型文档OCR需要更长时间
    // 1500页文档预估需要5-10分钟
    // 默认10分钟，可通过环境变量调整
    timeoutMs: parseInt(process.env.OCR_TIMEOUT_MS ?? '600000', 10),  // 10分钟
    // 批量处理数量 - 降低以减少OCR服务内存压力
    // 每页图片约5-10MB，并发过多会压垮OCR服务
    // 建议: CPU模式用2-3，GPU模式可用5-10
    batchSize: parseInt(process.env.OCR_BATCH_SIZE ?? '3', 10),
    // 最大页数限制，防止超大文档耗尽资源
    // 默认100页，可通过环境变量调整
    // 对于《黄帝内经》这类超大文档，建议设置50-100
    maxPages: parseInt(process.env.OCR_MAX_PAGES ?? '100', 10),
  },
  enableVlm: false,
};

/**
 * 图片PDF处理器
 * 处理纯图片PDF（无文本层的扫描文档）
 */
export class ImagePdfProcessor {
  private pdfConverter: PdfToImageConverter;
  private ocrService: LayoutOcrService;
  private config: ImagePdfConfig;

  constructor(config: Partial<ImagePdfConfig> = {}) {
    this.config = { ...DEFAULT_IMAGE_PDF_CONFIG, ...config };

    this.pdfConverter = createPdfToImageConverter({
      scale: this.config.render.scale,
      format: this.config.render.format,
    });

    this.ocrService = createLayoutOcrService({
      baseUrl: this.config.ocr.serviceUrl,
      timeoutMs: this.config.ocr.timeoutMs,
    });
  }

  /**
   * 处理纯图片PDF
   * 返回结构化的ParsedContent
   */
  async process(pdfBuffer: Buffer): Promise<ParsedContent> {
    const startTime = Date.now();
    console.log(`[ImagePdfProcessor] Starting image PDF processing, size: ${(pdfBuffer.length / 1024 / 1024).toFixed(2)} MB`);

    // Step 1: PDF → 图片
    console.log('[ImagePdfProcessor] Step 1: Converting PDF to images...');
    const allPageImages = await this.pdfConverter.convert(pdfBuffer);
    console.log(`[ImagePdfProcessor] Converted ${allPageImages.length} pages to images`);

    // 检查并限制页数（防止超大文档耗尽资源）
    const maxPages = this.config.ocr.maxPages ?? 500;
    let pageImages = allPageImages;
    if (allPageImages.length > maxPages) {
      console.warn(`[ImagePdfProcessor] Document has ${allPageImages.length} pages, limiting to ${maxPages} pages per config`);
      pageImages = allPageImages.slice(0, maxPages);
    }

    // 获取坐标信息
    const coordinateInfos = pageImages.map(img => this.pdfConverter.getPageCoordinateInfo(img));

    // Step 2: 检查OCR服务可用性
    console.log('[ImagePdfProcessor] Step 2: Checking OCR service...');
    const ocrHealthy = await this.ocrService.healthCheck();
    if (!ocrHealthy) {
      throw new Error('OCR service is not available. Please start the OCR service first.');
    }
    console.log('[ImagePdfProcessor] OCR service is healthy');

    // Step 3: 图片 → OCR
    console.log('[ImagePdfProcessor] Step 3: Running layout OCR...');
    const ocrResults = await this.ocrService.processBatch(pageImages, coordinateInfos);
    console.log(`[ImagePdfProcessor] OCR complete: ${ocrResults.length} pages processed`);

    // Step 4: OCR结果 → 结构化ParsedContent
    console.log('[ImagePdfProcessor] Step 4: Converting OCR results to ParsedContent...');
    const pages = this.convertToParsedContent(ocrResults, pageImages, coordinateInfos);

    const duration = Date.now() - startTime;
    console.log(`[ImagePdfProcessor] Processing complete: ${pages.length} pages, ${duration}ms`);

    return {
      pages,
      totalPages: pages.length,
      metadata: {
        pageCount: pages.length,
      },
    };
  }

  /**
   * 将OCR结果转换为ParsedContent格式
   */
  private convertToParsedContent(
    ocrResults: OcrPageResult[],
    pageImages: PageImage[],
    coordinateInfos: PageCoordinateInfo[]
  ): PageContent[] {
    return ocrResults.map((ocrResult, index) => {
      const pageImage = pageImages[index];
      const coordInfo = coordinateInfos[index];

      if (!pageImage || !coordInfo) {
        console.warn(`[ImagePdfProcessor] Missing data for page ${ocrResult.pageNumber}, skipping`);
        return {
          pageNumber: ocrResult.pageNumber,
          textBlocks: [],
          tables: [],
          images: [],
          formulas: [],
        };
      }

      const textBlocks: TextBlock[] = [];
      const tables: TableBlock[] = [];
      const images: ImageBlock[] = [];
      const formulas: FormulaBlock[] = [];

      let blockIndex = 0;

      for (const block of ocrResult.blocks) {
        const position = this.ocrService.createContentPosition(block, coordInfo);

        switch (block.type) {
          case 'title':
          case 'text':
          case 'header':
          case 'footer':
            // 文本块
            textBlocks.push({
              type: 'text',
              content: block.text,
              position,
              blockIndex: blockIndex++,
              metadata: {
                isHeader: block.type === 'header' || block.type === 'title',
                isFooter: block.type === 'footer',
              },
            });
            break;

          case 'table':
            // 表格块
            if (block.cells && block.cells.length > 0) {
              const rows = this.extractTableRows(block.cells);
              const columns = this.extractTableColumns(block.cells);

              tables.push({
                type: 'table',
                content: block.text,
                position,
                rows,
                columns,
                cells: block.cells.map(cell => ({
                  rowIndex: cell.row,
                  colIndex: cell.col,
                  content: cell.text,
                })),
                blockIndex: blockIndex++,
                metadata: {
                  hasHeaders: true,
                  headerRow: 0,
                },
              });
            } else {
              // 表格识别失败，作为文本块处理
              textBlocks.push({
                type: 'text',
                content: block.text,
                position,
                blockIndex: blockIndex++,
                metadata: {},
              });
            }
            break;

          case 'figure':
            // 图片块 - 保存图片区域的引用
            images.push({
              type: 'image',
              content: this.extractImageRegion(pageImage!, block),
              position,
              blockIndex: blockIndex++,
              metadata: {
                format: 'png',
                width: block.bbox[2] - block.bbox[0],
                height: block.bbox[3] - block.bbox[1],
              },
            });
            break;

          case 'formula':
            // 公式块
            formulas.push({
              type: 'formula',
              content: block.text,
              position,
              latex: block.text,  // OCR可能直接输出LaTeX
              blockIndex: blockIndex++,
              metadata: {
                positionType: 'block',
                confidence: block.confidence,
              },
            });
            break;
        }
      }

      return {
        pageNumber: ocrResult.pageNumber,
        textBlocks,
        tables,
        images,
        formulas,
      };
    });
  }

  /**
   * 提取表格行
   */
  private extractTableRows(cells: TableCell[]): string[] {
    const maxRow = Math.max(...cells.map(c => c.row));
    const rows: string[] = [];

    for (let r = 0; r <= maxRow; r++) {
      const rowCells = cells.filter(c => c.row === r).sort((a, b) => a.col - b.col);
      rows.push(rowCells.map(c => c.text).join('\t'));
    }

    return rows;
  }

  /**
   * 提取表格列
   */
  private extractTableColumns(cells: TableCell[]): string[] {
    const maxCol = Math.max(...cells.map(c => c.col));
    const columns: string[] = [];

    for (let c = 0; c <= maxCol; c++) {
      const colCells = cells.filter(cell => cell.col === c);
      columns.push(colCells[0]?.text ?? '');
    }

    return columns;
  }

  /**
   * 提取图片区域（从页面图片中裁剪）
   * 注意：这是一个简化实现，返回整个页面图片
   * 后续可使用sharp实现精确裁剪
   */
  private extractImageRegion(pageImage: PageImage, block: OcrBlock): Buffer {
    // TODO: 使用sharp裁剪精确区域
    // const [x1, y1, x2, y2] = block.bbox;
    // return sharp(pageImage.imageBuffer)
    //   .extract({ left: x1, top: y1, width: x2 - x1, height: y2 - y1 })
    //   .toBuffer();

    // 简化实现：返回整个页面图片
    return pageImage.imageBuffer;
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<ImagePdfConfig>): void {
    this.config = { ...this.config, ...config };

    // 更新子组件配置
    this.pdfConverter.updateConfig({
      scale: this.config.render.scale,
      format: this.config.render.format,
    });

    this.ocrService.updateConfig({
      baseUrl: this.config.ocr.serviceUrl,
      timeoutMs: this.config.ocr.timeoutMs,
    });
  }

  /**
   * 获取OCR服务
   */
  getOcrService(): LayoutOcrService {
    return this.ocrService;
  }

  /**
   * 获取PDF转换器
   */
  getPdfConverter(): PdfToImageConverter {
    return this.pdfConverter;
  }
}

/**
 * 创建图片PDF处理器
 */
export function createImagePdfProcessor(
  config?: Partial<ImagePdfConfig>
): ImagePdfProcessor {
  return new ImagePdfProcessor(config);
}