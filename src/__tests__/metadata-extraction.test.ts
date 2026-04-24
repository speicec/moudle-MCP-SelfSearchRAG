import { describe, it, expect } from 'vitest';
import {
  parsePdfDate,
  extractPdfMetadata,
  type PdfMetadataInfo,
} from '../parsers/text-extractor.js';
import {
  inferYear,
  identifyGuidelineSource,
  buildParsedMetadata,
} from '../parsers/parse-stage.js';

describe('Metadata Extraction Tests', () => {
  describe('parsePdfDate', () => {
    it('should parse PDF date format D:YYYYMMDD', () => {
      const result = parsePdfDate('D:20240101');
      expect(result).toBeDefined();
      expect(result?.getFullYear()).toBe(2024);
      expect(result?.getMonth()).toBe(0); // January
      expect(result?.getDate()).toBe(1);
    });

    it('should parse PDF date with timezone', () => {
      const result = parsePdfDate('D:20240101120000+08\'00\'');
      expect(result).toBeDefined();
      expect(result?.getFullYear()).toBe(2024);
    });

    it('should return undefined for invalid date', () => {
      expect(parsePdfDate(undefined)).toBeUndefined();
      expect(parsePdfDate('invalid')).toBeUndefined();
      expect(parsePdfDate('')).toBeUndefined();
    });

    it('should handle date without D: prefix', () => {
      const result = parsePdfDate('20240101');
      expect(result).toBeDefined();
      expect(result?.getFullYear()).toBe(2024);
    });
  });

  describe('extractPdfMetadata', () => {
    it('should extract all metadata fields', () => {
      const info = {
        Title: 'ADA Standards of Care 2024',
        Author: 'American Diabetes Association',
        Subject: 'Clinical Practice Guidelines',
        Creator: 'Microsoft Word',
        Producer: 'Adobe PDF Library',
        CreationDate: 'D:20240101',
        ModDate: 'D:20240115',
      };

      const result = extractPdfMetadata(info);

      expect(result.title).toBe('ADA Standards of Care 2024');
      expect(result.author).toBe('American Diabetes Association');
      expect(result.subject).toBe('Clinical Practice Guidelines');
      expect(result.creator).toBe('Microsoft Word');
      expect(result.producer).toBe('Adobe PDF Library');
      expect(result.creationDate).toBeDefined();
      expect(result.creationDate?.getFullYear()).toBe(2024);
      expect(result.modificationDate?.getFullYear()).toBe(2024);
    });

    it('should return empty object for undefined info', () => {
      const result = extractPdfMetadata(undefined);
      expect(result).toEqual({});
    });

    it('should handle partial metadata', () => {
      const info = {
        Title: 'Test Document',
      };

      const result = extractPdfMetadata(info);
      expect(result.title).toBe('Test Document');
      expect(result.author).toBeUndefined();
      expect(result.creationDate).toBeUndefined();
    });
  });

  describe('inferYear', () => {
    it('should extract year from title (highest priority)', () => {
      const result = inferYear('Standards of Care 2024', 'ADA_2023.pdf', new Date('2022-01-01'));
      expect(result).toBe(2024);
    });

    it('should extract year from filename if title has no year', () => {
      const result = inferYear('General Guidelines', 'ADA_2023.pdf', new Date('2022-01-01'));
      expect(result).toBe(2023);
    });

    it('should use creationDate year if title and filename have no year', () => {
      const result = inferYear('General Guidelines', 'guidelines.pdf', new Date('2022-06-15'));
      expect(result).toBe(2022);
    });

    it('should return undefined if no year found', () => {
      const result = inferYear('General Guidelines', 'guidelines.pdf');
      expect(result).toBeUndefined();
    });

    it('should handle year patterns like _2024 in filename', () => {
      const result = inferYear('General Guidelines', 'ADA_2024_final.pdf');
      expect(result).toBe(2024);
    });

    it('should handle year in middle of title', () => {
      const result = inferYear('KDIGO 2023 Clinical Practice Guideline');
      expect(result).toBe(2023);
    });

    it('should handle 1900s years', () => {
      const result = inferYear('Historical Guidelines 1999');
      expect(result).toBe(1999);
    });
  });

  describe('identifyGuidelineSource', () => {
    it('should identify ADA from title', () => {
      expect(identifyGuidelineSource('ADA Standards of Care 2024')).toBe('ADA');
    });

    it('should identify ADA from "American Diabetes Association"', () => {
      expect(identifyGuidelineSource('American Diabetes Association Guidelines')).toBe('ADA');
    });

    it('should identify ADA from "Standards of Care"', () => {
      expect(identifyGuidelineSource('Standards of Care 2024')).toBe('ADA');
    });

    it('should identify KDIGO', () => {
      expect(identifyGuidelineSource('KDIGO Clinical Practice Guideline')).toBe('KDIGO');
      expect(identifyGuidelineSource('Kidney Disease: Improving Global Outcomes')).toBe('KDIGO');
    });

    it('should identify ESC', () => {
      expect(identifyGuidelineSource('ESC Guidelines for Diabetes')).toBe('ESC');
      expect(identifyGuidelineSource('European Society of Cardiology')).toBe('ESC');
    });

    it('should identify CDS (Chinese)', () => {
      expect(identifyGuidelineSource('中国糖尿病学会指南')).toBe('CDS');
      expect(identifyGuidelineSource('中华医学会糖尿病分会')).toBe('CDS');
    });

    it('should identify ATA', () => {
      expect(identifyGuidelineSource('ATA Guidelines')).toBe('ATA');
      expect(identifyGuidelineSource('American Thyroid Association')).toBe('ATA');
    });

    it('should identify EASD', () => {
      expect(identifyGuidelineSource('EASD Annual Meeting')).toBe('EASD');
      expect(identifyGuidelineSource('European Association for the Study of Diabetes')).toBe('EASD');
    });

    it('should return undefined for unknown sources', () => {
      expect(identifyGuidelineSource('Local Hospital Guidelines')).toBeUndefined();
      expect(identifyGuidelineSource('Random Document')).toBeUndefined();
    });

    it('should combine title and author for identification', () => {
      expect(identifyGuidelineSource('Clinical Guidelines', 'American Diabetes Association')).toBe('ADA');
    });
  });

  describe('buildParsedMetadata', () => {
    it('should build complete metadata with all fields', () => {
      const pdfMetadata: PdfMetadataInfo = {
        title: 'ADA Standards of Care 2024',
        author: 'American Diabetes Association',
        subject: 'Clinical Practice Guidelines',
        creationDate: new Date('2024-01-01'),
      };

      const result = buildParsedMetadata(pdfMetadata, 10, 'ADA_2024.pdf');

      expect(result.title).toBe('ADA Standards of Care 2024');
      expect(result.author).toBe('American Diabetes Association');
      expect(result.subject).toBe('Clinical Practice Guidelines');
      expect(result.pageCount).toBe(10);
      expect(result.year).toBe(2024);
      expect(result.guidelineSource).toBe('ADA');
    });

    it('should use filename as fallback title', () => {
      const pdfMetadata: PdfMetadataInfo = {
        author: 'Test Author',
      };

      const result = buildParsedMetadata(pdfMetadata, 5, 'test_document.pdf');

      expect(result.title).toBe('test_document');
      expect(result.author).toBe('Test Author');
    });

    it('should infer year from filename when title has no year', () => {
      const pdfMetadata: PdfMetadataInfo = {
        title: 'Clinical Guidelines',
      };

      const result = buildParsedMetadata(pdfMetadata, 10, 'guidelines_2023.pdf');

      expect(result.year).toBe(2023);
    });

    it('should not identify guideline source for non-medical documents', () => {
      const pdfMetadata: PdfMetadataInfo = {
        title: 'Technical Manual 2024',
        author: 'Engineering Team',
      };

      const result = buildParsedMetadata(pdfMetadata, 20);

      expect(result.guidelineSource).toBeUndefined();
      expect(result.year).toBe(2024);
    });

    it('should handle empty pdfMetadata', () => {
      const pdfMetadata: PdfMetadataInfo = {};

      const result = buildParsedMetadata(pdfMetadata, 5, 'document_2022.pdf');

      expect(result.title).toBe('document_2022');
      expect(result.year).toBe(2022);
      expect(result.pageCount).toBe(5);
    });
  });
});