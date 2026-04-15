import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { LayoutOcrService, createLayoutOcrService, type OcrBlock, type OcrPageResult, type TableCell } from './layout-ocr-service.js';
import type { PageImage, PageCoordinateInfo } from './pdf-to-image-converter.js';

// Mock fetch for OCR service calls
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('LayoutOcrService', () => {
  let ocrService: LayoutOcrService;

  beforeAll(() => {
    ocrService = createLayoutOcrService({
      baseUrl: 'http://localhost:8080',
      timeoutMs: 30000,
      batchSize: 5,
    });
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create service with default config', () => {
      const defaultService = createLayoutOcrService();
      const config = defaultService.getConfig();
      expect(config.baseUrl).toBe('http://localhost:8080');
      expect(config.timeoutMs).toBe(30000);
      expect(config.batchSize).toBe(5);
    });

    it('should accept custom config', () => {
      const customService = createLayoutOcrService({
        baseUrl: 'http://custom-ocr:9000',
        timeoutMs: 60000,
        batchSize: 10,
      });
      const config = customService.getConfig();
      expect(config.baseUrl).toBe('http://custom-ocr:9000');
      expect(config.timeoutMs).toBe(60000);
      expect(config.batchSize).toBe(10);
    });
  });

  describe('healthCheck', () => {
    it('should return true when service is healthy', async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({ status: 'healthy' }),
      });

      const result = await ocrService.healthCheck();
      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/health',
        expect.objectContaining({ signal: expect.any(Object) })
      );
    });

    it('should return false when service is unhealthy', async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({ status: 'unhealthy' }),
      });

      const result = await ocrService.healthCheck();
      expect(result).toBe(false);
    });

    it('should return false on fetch error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await ocrService.healthCheck();
      expect(result).toBe(false);
    });
  });

  describe('processPage', () => {
    it('should process single page and return OcrPageResult', async () => {
      const mockOcrResult: OcrPageResult = {
        pageNumber: 1,
        blocks: [
          {
            type: 'text',
            bbox: [100, 50, 300, 150],
            text: 'Sample text',
            confidence: 0.95,
          },
        ],
        processingTimeMs: 500,
        width: 800,
        height: 600,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockOcrResult,
      });

      const pageImage: PageImage = {
        pageNumber: 1,
        imageBuffer: Buffer.from('mock-image'),
        width: 800,
        height: 600,
        dpi: 144,
        originalWidth: 400,
        originalHeight: 300,
      };

      const coordInfo: PageCoordinateInfo = {
        pageNumber: 1,
        scale: 2,
        widthPx: 800,
        heightPx: 600,
        widthPt: 400,
        heightPt: 300,
      };

      const result = await ocrService.processPage(pageImage, coordInfo);

      expect(result.pageNumber).toBe(1);
      expect(result.blocks.length).toBe(1);
      expect(result.blocks[0].type).toBe('text');
      expect(result.blocks[0].text).toBe('Sample text');
    });

    it('should throw error on OCR service failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });

      const pageImage: PageImage = {
        pageNumber: 1,
        imageBuffer: Buffer.from('mock-image'),
        width: 800,
        height: 600,
        dpi: 144,
        originalWidth: 400,
        originalHeight: 300,
      };

      const coordInfo: PageCoordinateInfo = {
        pageNumber: 1,
        scale: 2,
        widthPx: 800,
        heightPx: 600,
        widthPt: 400,
        heightPt: 300,
      };

      await expect(ocrService.processPage(pageImage, coordInfo)).rejects.toThrow('OCR service error');
    });
  });

  describe('createContentPosition', () => {
    it('should convert OcrBlock bbox to ContentPosition', () => {
      const block: OcrBlock = {
        type: 'text',
        bbox: [100, 50, 300, 150],
        text: 'Sample',
        confidence: 0.95,
      };

      const coordInfo: PageCoordinateInfo = {
        pageNumber: 1,
        scale: 2,
        widthPx: 800,
        heightPx: 600,
        widthPt: 400,
        heightPt: 300,
      };

      const position = ocrService.createContentPosition(block, coordInfo);

      expect(position.page).toBe(1);
      expect(position.x).toBe(50);   // 100 / 2
      expect(position.y).toBe(25);   // 50 / 2
      expect(position.width).toBe(100);  // (300 - 100) / 2
      expect(position.height).toBe(50);  // (150 - 50) / 2
    });

    it('should handle table blocks with cells', () => {
      const block: OcrBlock = {
        type: 'table',
        bbox: [50, 100, 400, 300],
        text: 'Table content',
        confidence: 0.92,
        cells: [
          { row: 0, col: 0, text: 'Header 1', bbox: [50, 100, 150, 150] },
          { row: 0, col: 1, text: 'Header 2', bbox: [150, 100, 400, 150] },
          { row: 1, col: 0, text: 'Data 1', bbox: [50, 150, 150, 200] },
        ] as TableCell[],
      };

      const coordInfo: PageCoordinateInfo = {
        pageNumber: 2,
        scale: 2,
        widthPx: 800,
        heightPx: 600,
        widthPt: 400,
        heightPt: 300,
      };

      const position = ocrService.createContentPosition(block, coordInfo);

      expect(position.page).toBe(2);
      expect(position.x).toBe(25);
      expect(position.y).toBe(50);
    });
  });

  describe('mapBlockType', () => {
    it('should map OCR types to logical types', () => {
      expect(ocrService.mapBlockType('title')).toBe('title');
      expect(ocrService.mapBlockType('text')).toBe('paragraph');
      expect(ocrService.mapBlockType('header')).toBe('header');
      expect(ocrService.mapBlockType('footer')).toBe('footer');
      expect(ocrService.mapBlockType('table')).toBe('table');
      expect(ocrService.mapBlockType('figure')).toBe('figure');
      expect(ocrService.mapBlockType('formula')).toBe('formula');
    });

    it('should default to paragraph for unknown types', () => {
      expect(ocrService.mapBlockType('unknown')).toBe('paragraph');
      expect(ocrService.mapBlockType('random')).toBe('paragraph');
    });
  });

  describe('processBatch', () => {
    it('should process multiple pages in batch', async () => {
      const mockResults: OcrPageResult[] = [
        {
          pageNumber: 1,
          blocks: [{ type: 'text', bbox: [0, 0, 100, 50], text: 'Page 1', confidence: 0.9 }],
          processingTimeMs: 300,
          width: 800,
          height: 600,
        },
        {
          pageNumber: 2,
          blocks: [{ type: 'title', bbox: [0, 0, 200, 30], text: 'Page 2 Title', confidence: 0.95 }],
          processingTimeMs: 280,
          width: 800,
          height: 600,
        },
      ];

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockResults[0],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockResults[1],
        });

      const pageImages: PageImage[] = [
        { pageNumber: 1, imageBuffer: Buffer.from('img1'), width: 800, height: 600, dpi: 144, originalWidth: 400, originalHeight: 300 },
        { pageNumber: 2, imageBuffer: Buffer.from('img2'), width: 800, height: 600, dpi: 144, originalWidth: 400, originalHeight: 300 },
      ];

      const coordInfos: PageCoordinateInfo[] = [
        { pageNumber: 1, scale: 2, widthPx: 800, heightPx: 600, widthPt: 400, heightPt: 300 },
        { pageNumber: 2, scale: 2, widthPx: 800, heightPx: 600, widthPt: 400, heightPt: 300 },
      ];

      const results = await ocrService.processBatch(pageImages, coordInfos);

      expect(results.length).toBe(2);
      expect(results[0].pageNumber).toBe(1);
      expect(results[1].pageNumber).toBe(2);
    });
  });

  describe('isConfigured', () => {
    it('should return true when baseUrl is set', () => {
      const configuredService = createLayoutOcrService({ baseUrl: 'http://ocr-service:8080' });
      expect(configuredService.isConfigured()).toBe(true);
    });

    it('should return false for default localhost without env', () => {
      // Clear OCR_SERVICE_URL env for this test
      const originalEnv = process.env.OCR_SERVICE_URL;
      delete process.env.OCR_SERVICE_URL;

      const defaultService = createLayoutOcrService();
      // Default localhost:8080 without env is considered not configured
      expect(defaultService.isConfigured()).toBe(false);

      // Restore env
      if (originalEnv) process.env.OCR_SERVICE_URL = originalEnv;
    });
  });

  describe('updateConfig', () => {
    it('should update config without replacing all', () => {
      ocrService.updateConfig({ timeoutMs: 60000 });
      const config = ocrService.getConfig();

      expect(config.timeoutMs).toBe(60000);
      expect(config.baseUrl).toBe('http://localhost:8080');  // preserved
    });
  });
});

describe('createLayoutOcrService factory', () => {
  it('should create instance without config', () => {
    const service = createLayoutOcrService();
    expect(service).toBeInstanceOf(LayoutOcrService);
  });

  it('should create instance with partial config', () => {
    const service = createLayoutOcrService({ timeoutMs: 45000 });
    expect(service.getConfig().timeoutMs).toBe(45000);
  });
});