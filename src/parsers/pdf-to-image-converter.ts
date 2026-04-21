import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas, Image, Canvas } from '@napi-rs/canvas';
import type { ContentPosition } from './pdf-parser.js';

// ========================================
// 关键配置：使用与 pdfjs-dist 兼容的 Canvas
// ========================================
// pdfjs-dist 5.x 内部使用 @napi-rs/canvas
// 我们必须使用相同的包，否则会出现类型不兼容错误
//
// 错误示例：如果使用 'canvas' 包（node-canvas）
//   → pdfjs-dist render() 时调用 drawImage/createPattern
//   → pdfjs-dist 使用 @napi-rs/canvas 的 Image 对象
//   → 但 context 是 node-canvas 的
//   → 报错: "Image or Canvas expected"
//
// 解决方案：统一使用 @napi-rs/canvas

/**
 * PDF页面渲染配置
 */
export interface PdfRenderConfig {
  scale: number;              // 渲染缩放比例 (1=72dpi, 2=144dpi)
  format: 'png' | 'jpeg';     // 输出格式
  quality?: number;           // JPEG质量 (0-100)
  backgroundColor?: string;   // 背景颜色 (默认白色)
  maxWidth?: number;          // 最大宽度限制
  maxHeight?: number;         // 最大高度限制
}

/**
 * 默认配置：适合OCR的最佳分辨率
 */
export const DEFAULT_RENDER_CONFIG: PdfRenderConfig = {
  scale: 2,                   // 144dpi - OCR最佳平衡点
  format: 'png',              // PNG无损，保证OCR精度
  backgroundColor: '#FFFFFF', // 白色背景
};

/**
 * 渲染后的页面图片
 */
export interface PageImage {
  pageNumber: number;
  imageBuffer: Buffer;
  width: number;              // 像素宽度
  height: number;             // 像素高度
  dpi: number;                // 实际DPI
  originalWidth: number;      // PDF原始宽度 (点)
  originalHeight: number;     // PDF原始高度 (点)
}

/**
 * PDF页面坐标信息（用于OCR结果映射）
 */
export interface PageCoordinateInfo {
  pageNumber: number;
  scale: number;
  widthPx: number;            // 渲染后像素宽度
  heightPx: number;           // 渲染后像素高度
  widthPt: number;            // PDF原始点宽度
  heightPt: number;           // PDF原始点高度
}

/**
 * PDF转图片转换器
 */
export class PdfToImageConverter {
  private config: PdfRenderConfig;

  constructor(config: Partial<PdfRenderConfig> = {}) {
    this.config = { ...DEFAULT_RENDER_CONFIG, ...config };
  }

  /**
   * 将PDF转换为页面图片数组
   */
  async convert(pdfBuffer: Buffer): Promise<PageImage[]> {
    const startTime = Date.now();
    console.log(`[PdfToImage] Starting conversion, PDF size: ${(pdfBuffer.length / 1024).toFixed(2)} KB`);

    // 加载PDF文档
    // workerSrc 已在全局 GlobalWorkerOptions 中配置（禁用 Web Worker）
    const loadingTask = getDocument({
      data: new Uint8Array(pdfBuffer),
      useSystemFonts: true,       // 使用系统字体作为备选
      disableFontFace: false,      // 启用字体渲染
      isEvalSupported: false,      // Node.js环境禁用eval
    });

    const pdfDocument = await loadingTask.promise;
    const numPages = pdfDocument.numPages;

    console.log(`[PdfToImage] PDF loaded: ${numPages} pages`);

    const results: PageImage[] = [];

    // 逐页渲染
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const pageStartTime = Date.now();

      const pageImage = await this.renderPage(pdfDocument, pageNum);
      results.push(pageImage);

      const pageDuration = Date.now() - pageStartTime;
      console.log(`[PdfToImage] Page ${pageNum} rendered: ${pageImage.width}x${pageImage.height} px, ${(pageImage.imageBuffer.length / 1024).toFixed(2)} KB, ${pageDuration}ms`);
    }

    // 清理
    pdfDocument.destroy();

    const totalDuration = Date.now() - startTime;
    console.log(`[PdfToImage] Conversion complete: ${numPages} pages, ${totalDuration}ms total`);

    return results;
  }

  /**
   * 选择性转换指定页面（用于混合模式处理）
   * 只渲染给定的页面编号，而非全部PDF
   *
   * @param pdfBuffer PDF文件Buffer
   * @param pageNumbers 要渲染的页面编号数组（1-based）
   * @returns 渲染后的页面图片数组
   */
  async convertPages(pdfBuffer: Buffer, pageNumbers: number[]): Promise<PageImage[]> {
    const startTime = Date.now();
    console.log(`[PdfToImage] Starting selective conversion, target pages: ${pageNumbers.length}`);
    console.log(`[PdfToImage] Pages to render: ${pageNumbers.join(', ')}`);

    if (pageNumbers.length === 0) {
      return [];
    }

    // 加载PDF文档
    const loadingTask = getDocument({
      data: new Uint8Array(pdfBuffer),
      useSystemFonts: true,
      disableFontFace: false,
      isEvalSupported: false,
    });

    const pdfDocument = await loadingTask.promise;
    const numPages = pdfDocument.numPages;
    console.log(`[PdfToImage] PDF loaded: ${numPages} total pages`);

    // 验证页码有效性
    const validPageNumbers = pageNumbers.filter(pn => pn >= 1 && pn <= numPages);
    if (validPageNumbers.length !== pageNumbers.length) {
      const invalidPages = pageNumbers.filter(pn => pn < 1 || pn > numPages);
      console.warn(`[PdfToImage] Invalid page numbers skipped: ${invalidPages.join(', ')}`);
    }

    const results: PageImage[] = [];

    // 渲染指定页面
    for (const pageNum of validPageNumbers) {
      const pageStartTime = Date.now();

      const pageImage = await this.renderPage(pdfDocument, pageNum);
      results.push(pageImage);

      const pageDuration = Date.now() - pageStartTime;
      console.log(`[PdfToImage] Page ${pageNum} rendered: ${pageImage.width}x${pageImage.height} px, ${(pageImage.imageBuffer.length / 1024).toFixed(2)} KB, ${pageDuration}ms`);
    }

    // 清理
    pdfDocument.destroy();

    const totalDuration = Date.now() - startTime;
    console.log(`[PdfToImage] Selective conversion complete: ${validPageNumbers.length} pages, ${totalDuration}ms total`);

    return results;
  }

  /**
   * 渲染单个页面
   */
  private async renderPage(pdfDocument: any, pageNumber: number): Promise<PageImage> {
    const page = await pdfDocument.getPage(pageNumber);

    // 获取原始尺寸（PDF点）
    const viewport = page.getViewport({ scale: 1 });
    const originalWidth = viewport.width;
    const originalHeight = viewport.height;

    // 计算渲染尺寸
    const renderViewport = page.getViewport({ scale: this.config.scale });
    const renderWidth = Math.floor(renderViewport.width);
    const renderHeight = Math.floor(renderViewport.height);

    // 应用尺寸限制
    let finalWidth = renderWidth;
    let finalHeight = renderHeight;
    let finalScale = this.config.scale;

    if (this.config.maxWidth && renderWidth > this.config.maxWidth) {
      finalScale = this.config.maxWidth / originalWidth;
      finalWidth = Math.floor(originalWidth * finalScale);
      finalHeight = Math.floor(originalHeight * finalScale);
    }

    if (this.config.maxHeight && finalHeight > this.config.maxHeight) {
      const heightScale = this.config.maxHeight / originalHeight;
      if (heightScale < finalScale) {
        finalScale = heightScale;
        finalWidth = Math.floor(originalWidth * finalScale);
        finalHeight = Math.floor(originalHeight * finalScale);
      }
    }

    // 重新计算viewport（如果尺寸被调整）
    const finalViewport = page.getViewport({ scale: finalScale });

    // 创建Canvas
    const canvas = createCanvas(finalWidth, finalHeight);
    const context = canvas.getContext('2d');

    // 填充背景色
    context.fillStyle = this.config.backgroundColor ?? '#FFFFFF';
    context.fillRect(0, 0, finalWidth, finalHeight);

    // 渲染PDF页面
    const renderContext = {
      canvasContext: context,
      viewport: finalViewport,
      renderInteractiveForms: false,
    };

    await page.render(renderContext).promise;

    // 提取图片Buffer
    const imageBuffer = this.extractImageBuffer(canvas);

    // 清理页面资源
    page.cleanup();

    return {
      pageNumber,
      imageBuffer,
      width: finalWidth,
      height: finalHeight,
      dpi: Math.round(72 * finalScale),
      originalWidth,
      originalHeight,
    };
  }

  /**
   * 从Canvas提取图片Buffer
   */
  private extractImageBuffer(canvas: Canvas): Buffer {
    if (this.config.format === 'png') {
      return canvas.toBuffer('image/png');
    } else {
      // @napi-rs/canvas JPEG API: toBuffer('image/jpeg', qualityNumber)
      const quality = this.config.quality ?? 85;
      return canvas.toBuffer('image/jpeg', quality);
    }
  }

  /**
   * 获取页面坐标信息（用于OCR结果映射回PDF坐标）
   */
  getPageCoordinateInfo(pageImage: PageImage): PageCoordinateInfo {
    return {
      pageNumber: pageImage.pageNumber,
      scale: pageImage.dpi / 72,
      widthPx: pageImage.width,
      heightPx: pageImage.height,
      widthPt: pageImage.originalWidth,
      heightPt: pageImage.originalHeight,
    };
  }

  /**
   * 将像素坐标转换为PDF点坐标
   * OCR输出的是像素坐标，需要转换回PDF原始坐标
   */
  convertPixelToPdfPoint(
    pixelX: number,
    pixelY: number,
    coordInfo: PageCoordinateInfo
  ): { x: number; y: number } {
    const scale = coordInfo.scale;
    return {
      x: pixelX / scale,
      y: pixelY / scale,
    };
  }

  /**
   * 将像素bbox转换为PDF ContentPosition
   */
  convertBboxToContentPosition(
    bbox: [number, number, number, number], // [x1, y1, x2, y2] 像素坐标
    coordInfo: PageCoordinateInfo
  ): ContentPosition {
    const topLeft = this.convertPixelToPdfPoint(bbox[0], bbox[1], coordInfo);
    const bottomRight = this.convertPixelToPdfPoint(bbox[2], bbox[3], coordInfo);

    return {
      page: coordInfo.pageNumber,
      x: topLeft.x,
      y: topLeft.y,
      width: bottomRight.x - topLeft.x,
      height: bottomRight.y - topLeft.y,
    };
  }

  /**
   * 批量转换（并行处理多页）
   */
  async convertBatch(
    pdfBuffers: Buffer[],
    maxConcurrency: number = 4
  ): Promise<PageImage[][]> {
    const results: PageImage[][] = [];

    // 分批处理，避免内存爆炸
    for (let i = 0; i < pdfBuffers.length; i += maxConcurrency) {
      const batch = pdfBuffers.slice(i, i + maxConcurrency);
      const batchResults = await Promise.all(
        batch.map(buf => this.convert(buf))
      );
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<PdfRenderConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取当前配置
   */
  getConfig(): PdfRenderConfig {
    return { ...this.config };
  }
}

/**
 * 创建PDF转图片转换器
 */
export function createPdfToImageConverter(
  config?: Partial<PdfRenderConfig>
): PdfToImageConverter {
  return new PdfToImageConverter(config);
}