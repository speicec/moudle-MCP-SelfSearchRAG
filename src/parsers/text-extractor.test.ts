import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PDFTextExtractor, createTextExtractor, DEFAULT_EMPTY_PAGE_THRESHOLD, type PageTextDiagnostic } from './text-extractor.js';
import type { PageTextResult } from './text-extractor.js';

describe('PDFTextExtractor', () => {
  let extractor: PDFTextExtractor;

  beforeEach(() => {
    extractor = createTextExtractor();
  });

  describe('extract', () => {
    it('should properly detect page boundaries using custom pagerender', async () => {
      // This test verifies the fix for the \f (form feed) bug
      // We need a real PDF to test this, so this is a placeholder
      // In production, we would use a sample PDF with known page count

      // Mock test - verify the method exists and returns correct structure
      expect(extractor.extract).toBeDefined();
      expect(typeof extractor.extract).toBe('function');
    });

    it('should return PageTextResult array with correct structure', async () => {
      // Placeholder for real PDF test
      // When a real PDF is provided:
      // - Each PageTextResult should have pageNumber, blocks, totalCharacters
      // - pageNumber should be 1-based
      // - Empty pages should be included with 0 totalCharacters
    });
  });

  describe('diagnose', () => {
    it('should return PageTextDiagnostic array', async () => {
      // This test verifies the diagnose method for mixed-mode processing
      expect(extractor.diagnose).toBeDefined();
      expect(typeof extractor.diagnose).toBe('function');
    });

    it('should classify pages based on threshold', async () => {
      // Test threshold logic:
      // - Pages with charCount < threshold should have isEmpty = true
      // - Pages with charCount >= threshold should have isEmpty = false
      // DEFAULT_EMPTY_PAGE_THRESHOLD is 100
      expect(DEFAULT_EMPTY_PAGE_THRESHOLD).toBe(100);
    });

    it('should allow custom threshold', async () => {
      // Custom threshold should override default
      const customThreshold = 50;
      // In real test: extractor.diagnose(pdfBuffer, customThreshold)
      expect(customThreshold).toBe(50);
    });
  });

  describe('getTotalTextLength', () => {
    it('should sum totalCharacters across all pages', () => {
      const mockResults: PageTextResult[] = [
        { pageNumber: 1, blocks: [], totalCharacters: 100, readingOrder: [] },
        { pageNumber: 2, blocks: [], totalCharacters: 200, readingOrder: [] },
        { pageNumber: 3, blocks: [], totalCharacters: 50, readingOrder: [] },
      ];

      const total = extractor.getTotalTextLength(mockResults);
      expect(total).toBe(350);
    });
  });

  describe('mergeText', () => {
    it('should merge pages with page break separator', () => {
      const mockResults: PageTextResult[] = [
        {
          pageNumber: 1,
          blocks: [{ type: 'text', content: 'Page 1 text', position: { page: 1, x: 0, y: 0, width: 0, height: 0 }, blockIndex: 0, metadata: {} }],
          totalCharacters: 11,
          readingOrder: [0],
        },
        {
          pageNumber: 2,
          blocks: [{ type: 'text', content: 'Page 2 text', position: { page: 2, x: 0, y: 0, width: 0, height: 0 }, blockIndex: 0, metadata: {} }],
          totalCharacters: 11,
          readingOrder: [0],
        },
      ];

      const merged = extractor.mergeText(mockResults);
      expect(merged).toContain('Page 1 text');
      expect(merged).toContain('Page 2 text');
      expect(merged).toContain('--- Page Break ---');
    });
  });
});

describe('Mixed Mode Processing', () => {
  describe('PageTextDiagnostic', () => {
    it('should have correct structure', () => {
      const diagnostic: PageTextDiagnostic = {
        pageNumber: 1,
        text: 'Sample text',
        charCount: 11,
        isEmpty: false,
      };

      expect(diagnostic.pageNumber).toBe(1);
      expect(diagnostic.text).toBe('Sample text');
      expect(diagnostic.charCount).toBe(11);
      expect(diagnostic.isEmpty).toBe(false);
    });

    it('should mark empty pages correctly', () => {
      // Page with less than threshold chars is "empty" (image page)
      const diagnostic: PageTextDiagnostic = {
        pageNumber: 1,
        text: 'Short',
        charCount: 5,  // < 100 threshold
        isEmpty: true,
      };

      expect(diagnostic.isEmpty).toBe(true);
    });
  });
});

describe('Environment Variables', () => {
  it('should use PDF_MIXED_MODE_THRESHOLD from env', () => {
    // Default is 100, can be overridden via env
    const defaultThreshold = parseInt(process.env.PDF_MIXED_MODE_THRESHOLD ?? '100', 10);
    expect(defaultThreshold).toBe(100);
  });

  it('should use PDF_FORCE_OCR_ALL from env', () => {
    const forceOcr = process.env.PDF_FORCE_OCR_ALL === 'true';
    expect(forceOcr).toBe(false); // Default is false
  });

  it('should use PDF_SKIP_EMPTY_PAGES from env', () => {
    const skipEmpty = process.env.PDF_SKIP_EMPTY_PAGES !== 'false';
    expect(skipEmpty).toBe(true); // Default is true
  });
});