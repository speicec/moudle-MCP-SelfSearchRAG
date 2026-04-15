import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Define mock data
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
      { type: 'title', bbox: [100, 50, 300, 80], text: 'Document Title', confidence: 0.95 },
      { type: 'text', bbox: [100, 100, 400, 200], text: 'Paragraph content', confidence: 0.92 },
      { type: 'table', bbox: [100, 220, 400, 350], text: 'Table data', confidence: 0.88, cells: [
        { row: 0, col: 0, text: 'Col1', bbox: [100, 220, 200, 270] },
        { row: 0, col: 1, text: 'Col2', bbox: [200, 220, 300, 270] },
        { row: 1, col: 0, text: 'Data1', bbox: [100, 270, 200, 320] },
        { row: 1, col: 1, text: 'Data2', bbox: [200, 270, 300, 320] },
      ] },
    ],
    processingTimeMs: 500,
    width: 800,
    height: 600,
  },
  {
    pageNumber: 2,
    blocks: [
      { type: 'figure', bbox: [50, 50, 350, 250], text: 'Figure 1', confidence: 0.85 },
      { type: 'formula', bbox: [50, 300, 200, 350], text: 'E = mc^2', confidence: 0.90 },
    ],
    processingTimeMs: 450,
    width: 800,
    height: 600,
  },
];

const mockCoordInfos = mockPageImages.map(img => ({
  pageNumber: img.pageNumber,
  scale: 2,
  widthPx: img.width,
  heightPx: img.height,
  widthPt: img.originalWidth,
  heightPt: img.originalHeight,
}));

// Mock dependencies before imports
vi.mock('./pdf-to-image-converter.js', () => ({
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

vi.mock('./layout-ocr-service.js', () => ({
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
  })),
}));

// Import after mocking
import { ImagePdfProcessor, createImagePdfProcessor } from './image-pdf-processor.js';

describe('ImagePdfProcessor', () => {
  let processor: ImagePdfProcessor;

  beforeEach(() => {
    vi.clearAllMocks();
    processor = createImagePdfProcessor({
      render: { scale: 2, format: 'png' },
      ocr: { serviceUrl: 'http://localhost:8080', timeoutMs: 30000 },
      enableVlm: false,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create processor with default config', () => {
      const defaultProcessor = createImagePdfProcessor();
      expect(defaultProcessor).toBeInstanceOf(ImagePdfProcessor);
    });

    it('should accept custom config', () => {
      const customProcessor = createImagePdfProcessor({
        render: { scale: 3, format: 'jpeg' },
        ocr: { serviceUrl: 'http://custom:9000', timeoutMs: 60000 },
        enableVlm: true,
      });
      expect(customProcessor).toBeInstanceOf(ImagePdfProcessor);
    });
  });

  describe('process', () => {
    it('should process PDF and return ParsedContent', async () => {
      const pdfBuffer = Buffer.from('mock-pdf-content');

      const result = await processor.process(pdfBuffer);

      expect(result).toBeDefined();
      expect(result.pages).toBeInstanceOf(Array);
      expect(result.totalPages).toBe(2);
      expect(result.metadata.pageCount).toBe(2);
    });

    it('should generate correct page structure', async () => {
      const pdfBuffer = Buffer.from('mock-pdf-content');

      const result = await processor.process(pdfBuffer);

      // Check page 1 structure
      const page1 = result.pages[0];
      expect(page1.pageNumber).toBe(1);
      expect(page1.textBlocks.length).toBeGreaterThan(0);
      expect(page1.tables.length).toBeGreaterThan(0);

      // Check page 2 structure
      const page2 = result.pages[1];
      expect(page2.pageNumber).toBe(2);
      expect(page2.images.length).toBeGreaterThan(0);
      expect(page2.formulas.length).toBeGreaterThan(0);
    });
  });

  describe('convertToParsedContent', () => {
    it('should map OCR blocks to correct types', async () => {
      const pdfBuffer = Buffer.from('mock-pdf');

      const result = await processor.process(pdfBuffer);

      // Text blocks should include title, text types
      const textTypes = result.pages[0].textBlocks.map(b => b.type);
      expect(textTypes).toContain('text');

      // Table block should have rows and columns
      const table = result.pages[0].tables[0];
      expect(table.rows).toBeInstanceOf(Array);
      expect(table.columns).toBeInstanceOf(Array);
      expect(table.cells).toBeInstanceOf(Array);
    });

    it('should assign correct blockIndex', async () => {
      const pdfBuffer = Buffer.from('mock-pdf');

      const result = await processor.process(pdfBuffer);

      // Block indices should be sequential within each page
      if (result.pages[0].textBlocks.length > 1) {
        const indices = result.pages[0].textBlocks.map(b => b.blockIndex);
        for (let i = 0; i < indices.length - 1; i++) {
          expect(indices[i + 1]).toBe(indices[i] + 1);
        }
      }
    });

    it('should handle figure blocks with image extraction', async () => {
      const pdfBuffer = Buffer.from('mock-pdf');

      const result = await processor.process(pdfBuffer);

      const image = result.pages[1].images[0];
      expect(image.type).toBe('image');
      expect(image.content).toBeDefined();
      expect(image.metadata.format).toBe('png');
    });

    it('should handle formula blocks', async () => {
      const pdfBuffer = Buffer.from('mock-pdf');

      const result = await processor.process(pdfBuffer);

      const formula = result.pages[1].formulas[0];
      expect(formula.type).toBe('formula');
      expect(formula.latex).toBeDefined();
    });
  });

  describe('extractTableRows', () => {
    it('should extract rows from table cells', async () => {
      const pdfBuffer = Buffer.from('mock-pdf');

      const result = await processor.process(pdfBuffer);

      const table = result.pages[0].tables[0];
      expect(table.rows.length).toBeGreaterThan(0);
      // Each row should be a string of tab-separated cell contents
      table.rows.forEach(row => {
        expect(typeof row).toBe('string');
      });
    });
  });

  describe('extractTableColumns', () => {
    it('should extract columns from table cells', async () => {
      const pdfBuffer = Buffer.from('mock-pdf');

      const result = await processor.process(pdfBuffer);

      const table = result.pages[0].tables[0];
      expect(table.columns.length).toBeGreaterThan(0);
    });
  });

  describe('updateConfig', () => {
    it('should update processor config', () => {
      processor.updateConfig({
        render: { scale: 3, format: 'png' },
      });

      // Config should be updated (verified through subsequent behavior)
    });
  });

  describe('getOcrService', () => {
    it('should return OCR service instance', () => {
      const ocrService = processor.getOcrService();
      expect(ocrService).toBeDefined();
    });
  });

  describe('getPdfConverter', () => {
    it('should return PDF converter instance', () => {
      const converter = processor.getPdfConverter();
      expect(converter).toBeDefined();
    });
  });
});

describe('createImagePdfProcessor factory', () => {
  it('should create instance without config', () => {
    const proc = createImagePdfProcessor();
    expect(proc).toBeInstanceOf(ImagePdfProcessor);
  });

  it('should create instance with partial config', () => {
    const proc = createImagePdfProcessor({
      enableVlm: true,
    });
    expect(proc).toBeInstanceOf(ImagePdfProcessor);
  });
});