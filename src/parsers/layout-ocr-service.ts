import type { ContentPosition } from './pdf-parser.js';
import type { PageImage, PageCoordinateInfo } from './pdf-to-image-converter.js';

/**
 * OCR服务配置
 */
export interface LayoutOcrConfig {
  baseUrl: string;           // OCR服务地址
  timeoutMs: number;         // 请求超时
  batchSize: number;         // 批量处理数量
  enableStatusCheck: boolean; // 是否启用状态预检
}

export const DEFAULT_OCR_CONFIG: LayoutOcrConfig = {
  baseUrl: process.env.OCR_SERVICE_URL ?? 'http://localhost:8080',
  // 大型文档需要更长超时时间
  // 默认10分钟，可通过环境变量调整
  timeoutMs: parseInt(process.env.OCR_TIMEOUT_MS ?? '600000', 10),
  // 批量处理数量 - 降低以减少队列压力
  // 服务端队列模式下建议 1-2
  batchSize: parseInt(process.env.OCR_BATCH_SIZE ?? '2', 10),
  // 是否在发送请求前检查服务状态
  enableStatusCheck: process.env.OCR_ENABLE_STATUS_CHECK === 'true',
};

/**
 * OCR服务状态响应
 */
export interface OcrServiceStatus {
  status: string;
  gpu_enabled: boolean;
  queue: {
    size: number;
    max_size: number;
    available_slots: number;
  };
  timing: {
    avg_processing_time_ms: number;
    avg_queue_wait_ms: number;
    estimated_wait_seconds: number;
  };
  stats: {
    total_processed: number;
    total_failed: number;
    total_timeout: number;
  };
}

/**
 * OCR输出的单个块
 */
export interface OcrBlock {
  type: 'title' | 'text' | 'table' | 'figure' | 'header' | 'footer' | 'formula';
  bbox: [number, number, number, number];  // [x1, y1, x2, y2] 像素坐标
  text: string;
  confidence: number;
  cells?: TableCell[];       // 表格单元格
}

/**
 * 表格单元格
 */
export interface TableCell {
  row: number;
  col: number;
  text: string;
  bbox: [number, number, number, number];
}

/**
 * 单页OCR结果
 */
export interface OcrPageResult {
  pageNumber: number;
  blocks: OcrBlock[];
  processingTimeMs: number;
  width: number;             // 图片宽度
  height: number;            // 图片高度
}

/**
 * 布局OCR服务客户端
 */
export class LayoutOcrService {
  private config: LayoutOcrConfig;

  constructor(config: Partial<LayoutOcrConfig> = {}) {
    this.config = { ...DEFAULT_OCR_CONFIG, ...config };
  }

  /**
   * 检查服务健康状态
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.baseUrl}/health`, {
        signal: AbortSignal.timeout(5000),
      });
      const data = await response.json() as { status: string };
      return data.status === 'healthy';
    } catch {
      console.error('[LayoutOcr] Health check failed');
      return false;
    }
  }

  /**
   * 获取服务状态（队列信息）
   */
  async getStatus(): Promise<OcrServiceStatus | null> {
    try {
      const response = await fetch(`${this.config.baseUrl}/status`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) {
        return null;
      }
      return await response.json() as OcrServiceStatus;
    } catch {
      console.warn('[LayoutOcr] Status check failed');
      return null;
    }
  }

  /**
   * 检查队列是否有可用槽位
   */
  async checkQueueAvailable(): Promise<{ available: boolean; waitSeconds: number }> {
    const status = await this.getStatus();
    if (!status) {
      // 无法获取状态，假设可用
      return { available: true, waitSeconds: 0 };
    }

    return {
      available: status.queue.available_slots > 0,
      waitSeconds: status.timing.estimated_wait_seconds,
    };
  }

  /**
   * 处理单页图片（带重试机制，支持503/408响应）
   */
  async processPage(
    pageImage: PageImage,
    coordinateInfo: PageCoordinateInfo,
    maxRetries: number = 3
  ): Promise<OcrPageResult> {
    const startTime = Date.now();
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[LayoutOcr] Processing page ${pageImage.pageNumber}... (attempt ${attempt}/${maxRetries})`);

        // 可选：预检队列状态
        if (this.config.enableStatusCheck && attempt === 1) {
          const queueStatus = await this.checkQueueAvailable();
          if (!queueStatus.available) {
            console.log(`[LayoutOcr] Queue full, waiting ${queueStatus.waitSeconds}s before sending request...`);
            await new Promise(resolve => setTimeout(resolve, queueStatus.waitSeconds * 1000));
          }
        }

        // 构建multipart/form-data请求
        const formData = new FormData();
        // Node.js Buffer需要转换为Uint8Array
        const imageBlob = new Blob([new Uint8Array(pageImage.imageBuffer)], { type: 'image/png' });
        formData.append('file', imageBlob, `page_${pageImage.pageNumber}.png`);
        formData.append('page_number', pageImage.pageNumber.toString());

        // 调用OCR服务
        const response = await fetch(`${this.config.baseUrl}/ocr/layout`, {
          method: 'POST',
          body: formData,
          signal: AbortSignal.timeout(this.config.timeoutMs),
        });

        // 处理特殊响应码
        if (response.status === 503) {
          // 队列已满，等待后重试
          const errorData = await response.json() as { detail?: { retry_after_seconds?: number } };
          const retryAfter = errorData.detail?.retry_after_seconds ?? 30;
          console.warn(`[LayoutOcr] Page ${pageImage.pageNumber}: Queue full (503), waiting ${retryAfter}s before retry...`);
          await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
          continue; // 重试
        }

        if (response.status === 408) {
          // 请求超时，可以重试或返回空结果
          console.warn(`[LayoutOcr] Page ${pageImage.pageNumber}: Request timeout (408)`);
          // 对于超时，不重试，直接返回空结果（避免长时间等待）
          return {
            pageNumber: pageImage.pageNumber,
            blocks: [],
            processingTimeMs: Date.now() - startTime,
            width: 0,
            height: 0,
          };
        }

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`OCR service error: ${response.status} - ${errorText}`);
        }

        const result = await response.json() as OcrPageResult;

        const processingTime = Date.now() - startTime;
        console.log(`[LayoutOcr] Page ${pageImage.pageNumber} processed: ${result.blocks.length} blocks, ${processingTime}ms`);

        return {
          pageNumber: pageImage.pageNumber,
          blocks: result.blocks,
          processingTimeMs: processingTime,
          width: result.width,
          height: result.height,
        };

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        console.warn(`[LayoutOcr] Page ${pageImage.pageNumber} attempt ${attempt} failed: ${lastError.message}`);

        // 如果不是最后一次尝试，等待后重试
        if (attempt < maxRetries) {
          const waitTime = attempt * 2000; // 2s, 4s, 6s
          console.log(`[LayoutOcr] Retrying in ${waitTime}ms...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }

    // 所有重试都失败，返回空结果而不是抛出错误
    // 这样可以继续处理其他页面
    console.error(`[LayoutOcr] Page ${pageImage.pageNumber} failed after ${maxRetries} retries: ${lastError?.message}`);
    return {
      pageNumber: pageImage.pageNumber,
      blocks: [],  // 空结果
      processingTimeMs: Date.now() - startTime,
      width: 0,
      height: 0,
    };
  }

  /**
   * 批量处理多页图片
   */
  async processBatch(
    pageImages: PageImage[],
    coordinateInfos: PageCoordinateInfo[]
  ): Promise<OcrPageResult[]> {
    // 分批处理，避免超大请求
    const results: OcrPageResult[] = [];

    for (let i = 0; i < pageImages.length; i += this.config.batchSize) {
      const batch = pageImages.slice(i, i + this.config.batchSize);
      const batchCoords = coordinateInfos.slice(i, i + this.config.batchSize);

      // 并行处理批次（每个请求带重试）
      const batchResults = await Promise.all(
        batch.map((img, idx) => {
          const coordInfo = batchCoords[idx];
          if (!coordInfo) {
            console.warn(`[LayoutOcr] Missing coordinate info for page ${img.pageNumber}, skipping`);
            return Promise.resolve({
              pageNumber: img.pageNumber,
              blocks: [],
              processingTimeMs: 0,
              width: 0,
              height: 0,
            });
          }
          return this.processPage(img, coordInfo);
        })
      );

      results.push(...batchResults);

      // 统计本批次成功/失败数
      const successCount = batchResults.filter(r => r.blocks.length > 0).length;
      console.log(`[LayoutOcr] Processed batch ${Math.floor(i / this.config.batchSize) + 1}: ${successCount}/${batch.length} pages successful`);

      // 批次间添加短暂延迟，让服务端队列有时间处理
      // 特别是在队列模式下，避免连续批次压垮服务
      if (i + this.config.batchSize < pageImages.length && this.config.batchSize > 1) {
        const delayMs = 1000; // 1秒
        console.log(`[LayoutOcr] Waiting ${delayMs}ms before next batch...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    return results;
  }

  /**
   * 从OcrBlock创建ContentPosition
   */
  createContentPosition(
    block: OcrBlock,
    coordInfo: PageCoordinateInfo
  ): ContentPosition {
    const [x1, y1, x2, y2] = block.bbox;
    const scale = coordInfo.scale;

    return {
      page: coordInfo.pageNumber,
      x: x1 / scale,
      y: y1 / scale,
      width: (x2 - x1) / scale,
      height: (y2 - y1) / scale,
    };
  }

  /**
   * 映射block类型到LogicalBlock类型
   */
  mapBlockType(ocrType: string): string {
    const typeMap: Record<string, string> = {
      'title': 'title',
      'text': 'paragraph',
      'header': 'header',
      'footer': 'footer',
      'table': 'table',
      'figure': 'figure',
      'formula': 'formula',
      'caption': 'caption',
    };
    return typeMap[ocrType] ?? 'paragraph';
  }

  /**
   * 获取服务URL
   */
  getServiceUrl(): string {
    return this.config.baseUrl;
  }

  /**
   * 检查服务是否已配置
   */
  isConfigured(): boolean {
    return !!this.config.baseUrl && this.config.baseUrl !== 'http://localhost:8080' || process.env.OCR_SERVICE_URL !== undefined;
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<LayoutOcrConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取当前配置
   */
  getConfig(): LayoutOcrConfig {
    return { ...this.config };
  }
}

/**
 * 创建布局OCR服务
 */
export function createLayoutOcrService(
  config?: Partial<LayoutOcrConfig>
): LayoutOcrService {
  return new LayoutOcrService(config);
}