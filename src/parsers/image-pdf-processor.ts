import type { ParsedContent, PageContent, TextBlock, TableBlock, ImageBlock, FormulaBlock } from '../core/types.js';
import type { ContentPosition } from './pdf-parser.js';
import { PdfToImageConverter, createPdfToImageConverter, type PageImage, type PageCoordinateInfo } from './pdf-to-image-converter.js';
import { LayoutOcrService, createLayoutOcrService, type OcrBlock, type OcrPageResult, type TableCell } from './layout-ocr-service.js';
import { createCanvas, Image } from '@napi-rs/canvas';
import { vlmEnhancementService, type VlmEnhanceRequest } from '../server/services/VlmEnhancementService.js';

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
  enableVlm: true,  // 默认启用VLM增强（需配置DASHSCOPE_API_KEY）
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
    let ocrResults = await this.ocrService.processBatch(pageImages, coordinateInfos);
    console.log(`[ImagePdfProcessor] OCR complete: ${ocrResults.length} pages processed`);

    // Step 3.5: VLM增强处理（如果启用）
    if (this.config.enableVlm && vlmEnhancementService.isEnabled()) {
      console.log('[ImagePdfProcessor] Step 3.5: Enhancing with VLM...');
      try {
        ocrResults = await this.enhanceWithVlm(ocrResults, pageImages);
        console.log('[ImagePdfProcessor] VLM enhancement complete');
      } catch (vlmError) {
        const errorMsg = vlmError instanceof Error ? vlmError.message : 'Unknown VLM error';
        console.warn(`[ImagePdfProcessor] VLM enhancement failed: ${errorMsg}, continuing with OCR results`);
      }
    } else if (this.config.enableVlm && !vlmEnhancementService.isEnabled()) {
      console.warn('[ImagePdfProcessor] VLM enabled but service not configured (DASHSCOPE_API_KEY missing)');
    }

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
   * VLM增强处理
   * 对table/figure/formula类型调用VLM获取深度理解结果
   */
  private async enhanceWithVlm(
    ocrResults: OcrPageResult[],
    pageImages: PageImage[]
  ): Promise<OcrPageResult[]> {
    const enhancedResults: OcrPageResult[] = []
    const vlmTypes = ['table', 'figure', 'formula']

    for (const ocrResult of ocrResults) {
      const pageImage = pageImages[ocrResult.pageNumber - 1]
      if (!pageImage) {
        enhancedResults.push(ocrResult)
        continue
      }

      const enhancedBlocks: OcrBlock[] = []
      let vlmCallCount = 0

      for (const block of ocrResult.blocks) {
        const needsVlm = vlmTypes.includes(block.type)

        if (needsVlm) {
          try {
            // 裁剪图片区域
            const croppedBuffer = this.extractImageRegion(pageImage, block)

            // 转为base64
            const imageBase64 = croppedBuffer.toString('base64')

            // 获取上下文文本
            const contextText = this.getContextText(ocrResult, block)

            // 调用VLM
            const vlmRequest: VlmEnhanceRequest = {
              imageBase64,
              blockType: block.type as 'table' | 'figure' | 'formula' | 'mixed',
              contextText,
            }

            console.log(`[ImagePdfProcessor] Calling VLM for ${block.type} block at page ${ocrResult.pageNumber}`)
            const vlmResult = await vlmEnhancementService.enhance(vlmRequest)
            vlmCallCount++

            // 更新block内容
            enhancedBlocks.push({
              ...block,
              text: vlmResult.answer || block.text,  // VLM理解结果，fallback到原OCR
              confidence: Math.max(block.confidence, 0.9),  // VLM处理后置信度提高
              // 保留扩展信息（将在convertToParsedContent中使用）
              // 注：OcrBlock没有metadata字段，我们需要通过其他方式传递
            })

            console.log(`[ImagePdfProcessor] VLM result: ${vlmResult.answer.slice(0, 100)}... (${vlmResult.duration}ms)`)

          } catch (cropError) {
            const errorMsg = cropError instanceof Error ? cropError.message : 'Unknown error'
            console.warn(`[ImagePdfProcessor] Failed to process ${block.type} block: ${errorMsg}`)
            // 保留原始block
            enhancedBlocks.push(block)
          }
        } else {
          // 普通文本块，直接保留
          enhancedBlocks.push(block)
        }
      }

      enhancedResults.push({
        ...ocrResult,
        blocks: enhancedBlocks,
      })

      console.log(`[ImagePdfProcessor] Page ${ocrResult.pageNumber}: ${vlmCallCount} blocks enhanced with VLM`)
    }

    return enhancedResults
  }

  /**
   * 提取当前块附近的文本作为VLM上下文
   */
  private getContextText(
    ocrResult: OcrPageResult,
    targetBlock: OcrBlock
  ): string {
    const [x1, y1, x2, y2] = targetBlock.bbox
    const centerY = (y1 + y2) / 2

    // 找上方和下方的文本块
    const nearbyBlocks = ocrResult.blocks
      .filter(b => b.type === 'text' || b.type === 'title')
      .filter(b => {
        const [, by1, , by2] = b.bbox
        const bCenterY = (by1 + by2) / 2
        // 距离阈值：200像素
        return Math.abs(bCenterY - centerY) < 200
      })
      .slice(0, 3)  // 最多取3个

    return nearbyBlocks.map(b => b.text).join('\n')
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
            // 表格块 - 保存裁剪图片和VLM理解结果
            const tableImageBuffer = this.extractImageRegion(pageImage!, block);
            if (block.cells && block.cells.length > 0) {
              const rows = this.extractTableRows(block.cells);
              const columns = this.extractTableColumns(block.cells);

              tables.push({
                type: 'table',
                content: block.text,  // VLM理解结果（如果启用）
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
                  // VLM增强相关
                  imageBuffer: tableImageBuffer,
                  confidence: block.confidence,
                },
              });
            } else {
              // 无cells数据，使用VLM文本（如果启用）
              tables.push({
                type: 'table',
                content: block.text,
                position,
                rows: [],
                columns: [],
                cells: [],
                blockIndex: blockIndex++,
                metadata: {
                  hasHeaders: false,
                  // VLM增强相关
                  imageBuffer: tableImageBuffer,
                  confidence: block.confidence,
                },
              });
            }
            break;

          case 'figure':
            // 图片块 - 保存裁剪图片和VLM理解结果
            const figureImageBuffer = this.extractImageRegion(pageImage!, block);
            images.push({
              type: 'image',
              content: figureImageBuffer,
              position,
              blockIndex: blockIndex++,
              metadata: {
                format: 'png',
                width: block.bbox[2] - block.bbox[0],
                height: block.bbox[3] - block.bbox[1],
                // VLM增强相关
                vlmText: block.text,  // VLM理解结果（如果启用）
                blockType: 'figure',
                confidence: block.confidence,
              },
            });
            break;

          case 'formula':
            // 公式块 - 保存裁剪图片和VLM理解结果
            const formulaImageBuffer = this.extractImageRegion(pageImage!, block);
            formulas.push({
              type: 'formula',
              content: block.text,  // VLM理解结果（如果启用）
              position,
              latex: block.text,  // VLM可能输出LaTeX格式
              blockIndex: blockIndex++,
              metadata: {
                positionType: 'block',
                confidence: block.confidence,
                // VLM增强相关
                imageBuffer: formulaImageBuffer,
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
   * 使用@napi-rs/canvas实现精确裁剪
   */
  private extractImageRegion(pageImage: PageImage, block: OcrBlock): Buffer {
    const [x1, y1, x2, y2] = block.bbox

    // 计算裁剪区域尺寸
    const cropWidth = Math.floor(x2 - x1)
    const cropHeight = Math.floor(y2 - y1)

    // 边界检查
    if (cropWidth <= 0 || cropHeight <= 0) {
      console.warn(`[ImagePdfProcessor] Invalid bbox: [${x1}, ${y1}, ${x2}, ${y2}], returning full page`)
      return pageImage.imageBuffer
    }

    // 确保裁剪区域不超出图片范围
    const clampedX1 = Math.max(0, Math.floor(x1))
    const clampedY1 = Math.max(0, Math.floor(y1))
    const clampedWidth = Math.min(cropWidth, pageImage.width - clampedX1)
    const clampedHeight = Math.min(cropHeight, pageImage.height - clampedY1)

    if (clampedWidth <= 0 || clampedHeight <= 0) {
      console.warn(`[ImagePdfProcessor] Clamped bbox exceeds image bounds, returning full page`)
      return pageImage.imageBuffer
    }

    try {
      // 创建裁剪canvas
      const cropCanvas = createCanvas(clampedWidth, clampedHeight)
      const cropContext = cropCanvas.getContext('2d')

      // 从源Buffer创建Image对象
      const sourceImage = new Image()
      sourceImage.src = pageImage.imageBuffer

      // 绘制裁剪区域
      cropContext.drawImage(
        sourceImage,
        clampedX1, clampedY1, clampedWidth, clampedHeight,  // 源区域
        0, 0, clampedWidth, clampedHeight                    // 目标区域（全canvas）
      )

      // 提取裁剪后的Buffer
      return cropCanvas.toBuffer('image/png')
    } catch (error) {
      console.warn(`[ImagePdfProcessor] Failed to crop image: ${error instanceof Error ? error.message : error}`)
      return pageImage.imageBuffer
    }
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