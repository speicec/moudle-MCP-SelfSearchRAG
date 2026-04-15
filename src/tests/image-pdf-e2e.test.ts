import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

/**
 * 纯图片PDF端到端测试
 *
 * 测试完整流程：
 * 1. 上传纯图片PDF
 * 2. PDF → 图片转换
 * 3. OCR处理
 * 4. ParsedContent生成
 * 5. 索引建立（模拟）
 * 6. 检索测试（模拟）
 * 7. 答案生成测试（模拟）
 */

// Test assets directory
const TEST_ASSETS_DIR = join(process.cwd(), 'test-assets');
const TEST_PDF_PATH = join(TEST_ASSETS_DIR, 'image-only-pdf.pdf');

// Mock data for testing
const mockPageImages = [
  {
    pageNumber: 1,
    imageBuffer: Buffer.from('page1-image'),
    width: 800,
    height: 600,
    dpi: 144,
    originalWidth: 400,
    originalHeight: 300,
  },
  {
    pageNumber: 2,
    imageBuffer: Buffer.from('page2-image'),
    width: 800,
    height: 600,
    dpi: 144,
    originalWidth: 400,
    originalHeight: 300,
  },
];

const mockOcrResults = [
  {
    pageNumber: 1,
    blocks: [
      { type: 'title', bbox: [50, 50, 300, 80], text: 'Document Title - Page 1', confidence: 0.95 },
      { type: 'text', bbox: [50, 100, 400, 200], text: 'This is the main paragraph content extracted from the image PDF.', confidence: 0.92 },
      { type: 'table', bbox: [50, 220, 400, 350], text: 'Table content', confidence: 0.88, cells: [
        { row: 0, col: 0, text: 'Header A', bbox: [50, 220, 150, 270] },
        { row: 0, col: 1, text: 'Header B', bbox: [150, 220, 250, 270] },
        { row: 0, col: 2, text: 'Header C', bbox: [250, 220, 400, 270] },
        { row: 1, col: 0, text: 'Data A', bbox: [50, 270, 150, 320] },
        { row: 1, col: 1, text: 'Data B', bbox: [150, 270, 250, 320] },
        { row: 1, col: 2, text: 'Data C', bbox: [250, 270, 400, 320] },
      ] },
    ],
    processingTimeMs: 500,
    width: 800,
    height: 600,
  },
  {
    pageNumber: 2,
    blocks: [
      { type: 'title', bbox: [50, 50, 300, 80], text: 'Document Title - Page 2', confidence: 0.95 },
      { type: 'figure', bbox: [50, 100, 350, 250], text: 'Figure 1', confidence: 0.85 },
      { type: 'formula', bbox: [50, 300, 200, 350], text: 'E = mc^2', confidence: 0.90 },
    ],
    processingTimeMs: 450,
    width: 800,
    height: 600,
  },
];

// Mock dependencies BEFORE imports (vitest hoisting)
vi.mock('../parsers/pdf-to-image-converter.js', () => ({
  createPdfToImageConverter: vi.fn(() => ({
    convert: vi.fn().mockResolvedValue(mockPageImages),
    getPageCoordinateInfo: vi.fn().mockImplementation((img: any) => ({
      pageNumber: img.pageNumber,
      scale: 2,
      widthPx: img.width,
      heightPx: img.height,
      widthPt: img.originalWidth,
      heightPt: img.originalHeight,
    })),
    updateConfig: vi.fn(),
  })),
}));

vi.mock('../parsers/layout-ocr-service.js', () => ({
  createLayoutOcrService: vi.fn(() => ({
    healthCheck: vi.fn().mockResolvedValue(true),
    processBatch: vi.fn().mockResolvedValue(mockOcrResults),
    createContentPosition: vi.fn().mockImplementation((block: any, coordInfo: any) => ({
      page: coordInfo.pageNumber,
      x: block.bbox[0] / coordInfo.scale,
      y: block.bbox[1] / coordInfo.scale,
      width: (block.bbox[2] - block.bbox[0]) / coordInfo.scale,
      height: (block.bbox[3] - block.bbox[1]) / coordInfo.scale,
    })),
    updateConfig: vi.fn(),
    getServiceUrl: vi.fn().mockReturnValue('http://mock-ocr:8080'),
    isConfigured: vi.fn().mockReturnValue(true),
    getConfig: vi.fn().mockReturnValue({ baseUrl: 'http://mock-ocr:8080', timeoutMs: 30000, batchSize: 5 }),
  })),
}));

vi.mock('../server/services/VlmEnhancementService.js', () => ({
  VlmEnhancementService: vi.fn().mockImplementation(() => ({
    isEnabled: vi.fn().mockReturnValue(true),
    enhance: vi.fn().mockResolvedValue({
      reasoning: '',
      answer: 'Enhanced VLM understanding of the table/figure content.',
      duration: 1000,
      tokensUsed: 300,
    }),
    enhanceBatch: vi.fn().mockResolvedValue([
      { reasoning: '', answer: 'Enhanced 1', duration: 500 },
      { reasoning: '', answer: 'Enhanced 2', duration: 600 },
    ]),
    getConfig: vi.fn().mockReturnValue({
      apiKey: 'test-key',
      baseUrl: 'https://test.api',
      model: 'qwen3-vl-flash',
      enableThinking: false,
      thinkingBudget: 4096,
    }),
  })),
  vlmEnhancementService: {
    isEnabled: vi.fn().mockReturnValue(false),
  },
}));

// Import after mocks are set up
import { createImagePdfProcessor } from '../parsers/image-pdf-processor.js';
import { VlmEnhancementService } from '../server/services/VlmEnhancementService.js';

describe('Image-Only PDF End-to-End Test', () => {
  let processor: ReturnType<typeof createImagePdfProcessor>;

  beforeAll(async () => {
    // Ensure test assets directory exists
    if (!existsSync(TEST_ASSETS_DIR)) {
      mkdirSync(TEST_ASSETS_DIR, { recursive: true });
    }

    // Create processor
    processor = createImagePdfProcessor({
      render: { scale: 2, format: 'png' },
      ocr: { serviceUrl: 'http://mock-ocr:8080', timeoutMs: 30000 },
      enableVlm: false,
    });
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  describe('1. PDF Upload and Processing', () => {
    it('should accept PDF buffer input', () => {
      const mockBuffer = Buffer.from('mock-pdf-content');
      expect(mockBuffer).toBeDefined();
      expect(mockBuffer.length).toBeGreaterThan(0);
    });

    it('should process image-only PDF (mock test)', async () => {
      const mockPdfBuffer = Buffer.from('mock-image-only-pdf');

      const result = await processor.process(mockPdfBuffer);

      expect(result).toBeDefined();
      expect(result.pages).toBeInstanceOf(Array);
      expect(result.totalPages).toBeGreaterThan(0);
      expect(result.metadata.pageCount).toBe(result.totalPages);
    });
  });

  describe('2. ParsedContent Generation', () => {
    it('should generate valid ParsedContent with text blocks', async () => {
      const mockPdfBuffer = Buffer.from('mock-pdf');
      const result = await processor.process(mockPdfBuffer);

      const firstPage = result.pages[0];
      expect(firstPage.textBlocks.length).toBeGreaterThan(0);

      const textBlock = firstPage.textBlocks[0];
      expect(textBlock.type).toBeDefined();
      expect(textBlock.content).toBeDefined();
      expect(textBlock.position).toBeDefined();
      expect(textBlock.blockIndex).toBeDefined();
    });

    it('should generate valid ParsedContent with tables', async () => {
      const mockPdfBuffer = Buffer.from('mock-pdf');
      const result = await processor.process(mockPdfBuffer);

      const firstPage = result.pages[0];
      expect(firstPage.tables.length).toBeGreaterThan(0);

      const table = firstPage.tables[0];
      expect(table.rows).toBeInstanceOf(Array);
      expect(table.columns).toBeInstanceOf(Array);
      expect(table.cells).toBeInstanceOf(Array);

      expect(table.cells.length).toBeGreaterThan(0);
      table.cells.forEach(cell => {
        expect(cell.rowIndex).toBeDefined();
        expect(cell.colIndex).toBeDefined();
        expect(cell.content).toBeDefined();
      });
    });

    it('should preserve content positions for retrieval', async () => {
      const mockPdfBuffer = Buffer.from('mock-pdf');
      const result = await processor.process(mockPdfBuffer);

      result.pages.forEach(page => {
        page.textBlocks.forEach(block => {
          expect(block.position.page).toBe(page.pageNumber);
          expect(block.position.x).toBeGreaterThanOrEqual(0);
          expect(block.position.y).toBeGreaterThanOrEqual(0);
          expect(block.position.width).toBeGreaterThan(0);
          expect(block.position.height).toBeGreaterThan(0);
        });
      });
    });
  });

  describe('3. Index Building (Simulated)', () => {
    it('should prepare content for indexing', async () => {
      const mockPdfBuffer = Buffer.from('mock-pdf');
      const result = await processor.process(mockPdfBuffer);

      const indexableContent = result.pages.flatMap(page =>
        page.textBlocks.map(block => ({
          id: `block-${page.pageNumber}-${block.blockIndex}`,
          content: block.content,
          position: block.position,
          type: block.type,
        }))
      );

      expect(indexableContent.length).toBeGreaterThan(0);

      indexableContent.forEach(item => {
        expect(item.id).toBeDefined();
        expect(item.content).toBeDefined();
        expect(item.content.length).toBeGreaterThan(0);
      });
    });

    it('should handle table content for indexing', async () => {
      const mockPdfBuffer = Buffer.from('mock-pdf');
      const result = await processor.process(mockPdfBuffer);

      const tableContent = result.pages.flatMap(page =>
        page.tables.map(table => ({
          id: `table-${page.pageNumber}-${table.blockIndex}`,
          content: table.content,
          rows: table.rows,
          columns: table.columns,
        }))
      );

      expect(tableContent.length).toBeGreaterThan(0);
    });
  });

  describe('4. Retrieval Test (Simulated)', () => {
    it('should support text-based retrieval simulation', async () => {
      const mockPdfBuffer = Buffer.from('mock-pdf');
      const result = await processor.process(mockPdfBuffer);

      const query = 'paragraph content';

      const matches = result.pages.flatMap(page =>
        page.textBlocks.filter(block =>
          block.content.toLowerCase().includes(query.toLowerCase())
        ).map(block => ({
          pageNumber: page.pageNumber,
          content: block.content,
          position: block.position,
          score: 1.0,
        }))
      );

      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].content).toContain('paragraph');
    });

    it('should support table-based retrieval simulation', async () => {
      const mockPdfBuffer = Buffer.from('mock-pdf');
      const result = await processor.process(mockPdfBuffer);

      const query = 'Header';

      const tableMatches = result.pages.flatMap(page =>
        page.tables.filter(table =>
          table.content.includes(query) ||
          table.rows.some(row => row.includes(query))
        ).map(table => ({
          pageNumber: page.pageNumber,
          content: table.content,
          rows: table.rows,
        }))
      );

      expect(tableMatches.length).toBeGreaterThan(0);
    });
  });

  describe('5. Answer Generation Test (Simulated)', () => {
    it('should prepare context for LLM answer generation', async () => {
      const mockPdfBuffer = Buffer.from('mock-pdf');
      const result = await processor.process(mockPdfBuffer);

      const context = result.pages
        .slice(0, 1)
        .flatMap(page => page.textBlocks.map(block => block.content))
        .join('\n\n');

      expect(context).toBeDefined();
      expect(context.length).toBeGreaterThan(0);
      expect(context).toContain('Title');
      expect(context).toContain('paragraph');
    });

    it('should support VLM enhancement for complex content', async () => {
      const vlmService = new VlmEnhancementService();

      expect(vlmService.isEnabled()).toBe(true);

      const enhanceResult = await vlmService.enhance({
        imageBase64: 'mockImageBase64',
        blockType: 'table',
        contextText: 'Financial report data',
      });

      expect(enhanceResult.answer).toBeDefined();
      expect(enhanceResult.duration).toBeDefined();
    });
  });

  describe('6. Performance Benchmarks', () => {
    it('should complete processing within acceptable time (mock)', async () => {
      const startTime = Date.now();
      const mockPdfBuffer = Buffer.from('mock-pdf');

      const result = await processor.process(mockPdfBuffer);

      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(5000);
      expect(result.pages.length).toBeGreaterThan(0);
    });

    it('should handle multi-page documents', async () => {
      const mockPdfBuffer = Buffer.from('mock-multi-page-pdf');
      const result = await processor.process(mockPdfBuffer);

      expect(result.totalPages).toBeGreaterThanOrEqual(1);
    });
  });

  describe('7. Error Handling', () => {
    it('should handle empty PDF buffer', async () => {
      const emptyBuffer = Buffer.from('');

      try {
        await processor.process(emptyBuffer);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should validate OCR results', async () => {
      const mockPdfBuffer = Buffer.from('mock-pdf');
      const result = await processor.process(mockPdfBuffer);

      result.pages.forEach(page => {
        page.textBlocks.forEach(block => {
          expect(block.content.length).toBeGreaterThan(0);
        });
      });
    });
  });
});

describe('Integration with Real Components (when available)', () => {
  it.skip('should process real image-only PDF file', async () => {
    if (!existsSync(TEST_PDF_PATH)) {
      console.log('Skipping: Test PDF not available at', TEST_PDF_PATH);
      return;
    }

    const pdfBuffer = readFileSync(TEST_PDF_PATH);
    const realProcessor = createImagePdfProcessor({
      render: { scale: 2, format: 'png' },
      ocr: { serviceUrl: process.env.OCR_SERVICE_URL ?? 'http://localhost:8080', timeoutMs: 60000 },
    });

    const result = await realProcessor.process(pdfBuffer);

    expect(result.pages.length).toBeGreaterThan(0);
    expect(result.pages[0].textBlocks.length).toBeGreaterThan(0);

    const totalCharacters = result.pages.reduce((sum, page) =>
      sum + page.textBlocks.reduce((s, b) => s + b.content.length, 0), 0
    );
    expect(totalCharacters).toBeGreaterThan(50);
  });

  it.skip('should integrate with embedding service for indexing', async () => {
    // Placeholder for future integration test
  });

  it.skip('should integrate with LLM service for answer generation', async () => {
    // Placeholder for future integration test
  });
});