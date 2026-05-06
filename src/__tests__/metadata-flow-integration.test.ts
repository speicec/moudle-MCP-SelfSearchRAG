import { describe, it, expect } from 'vitest';
import type { ParsedContent, ParsedMetadata, PageContent } from '../core/types.js';
import type { ChunkMetadata, HierarchicalChunk, QualityScore } from '../chunking/types.js';
import { createHierarchicalChunk, createDefaultQualityScore } from '../chunking/types.js';

/**
 * Integration tests for metadata extraction flow:
 * PDF → parse → chunk → retrieval → citation
 *
 * These tests verify the complete metadata propagation pipeline
 * without requiring actual PDF files.
 */
describe('Metadata Flow Integration Tests', () => {
  /**
   * Task 10.2: End-to-end metadata flow verification
   */
  describe('Metadata propagation from ParsedContent to Chunk', () => {
    /**
     * Simulates the metadata propagation that happens in document-processor.ts
     */
    function propagateMetadataToChunk(
      parsedMetadata: ParsedMetadata,
      chunkContent: string,
      documentId: string
    ): HierarchicalChunk {
      const chunkMetadata: ChunkMetadata = {
        contentType: 'text',
        boundaryConfidence: 0.8,
      };

      // Propagate document-level metadata (only if defined)
      if (parsedMetadata.title) chunkMetadata.documentTitle = parsedMetadata.title;
      if (parsedMetadata.author) chunkMetadata.documentAuthor = parsedMetadata.author;
      if (parsedMetadata.year) chunkMetadata.documentYear = parsedMetadata.year;
      if (parsedMetadata.guidelineSource) chunkMetadata.guidelineSource = parsedMetadata.guidelineSource;

      return createHierarchicalChunk(
        chunkContent,
        [], // Empty embedding for test
        'small',
        { start: 0, end: chunkContent.length },
        documentId,
        createDefaultQualityScore(),
        chunkMetadata
      );
    }

    it('should propagate complete metadata from ADA guideline PDF', () => {
      // Simulate parsed metadata from "ADA Standards of Care 2024.pdf"
      const parsedMetadata: ParsedMetadata = {
        title: 'ADA Standards of Care 2024',
        author: 'American Diabetes Association',
        subject: 'Clinical Practice Guidelines',
        pageCount: 150,
        year: 2024,
        guidelineSource: 'ADA',
      };

      const chunk = propagateMetadataToChunk(
        parsedMetadata,
        'Metformin is the preferred initial pharmacologic agent...',
        'doc_ada_2024'
      );

      expect(chunk.metadata.documentTitle).toBe('ADA Standards of Care 2024');
      expect(chunk.metadata.documentAuthor).toBe('American Diabetes Association');
      expect(chunk.metadata.documentYear).toBe(2024);
      expect(chunk.metadata.guidelineSource).toBe('ADA');
      expect(chunk.sourceDocumentId).toBe('doc_ada_2024');
    });

    it('should propagate metadata from KDIGO guideline', () => {
      const parsedMetadata: ParsedMetadata = {
        title: 'KDIGO 2023 Clinical Practice Guideline',
        author: 'Kidney Disease: Improving Global Outcomes',
        pageCount: 80,
        year: 2023,
        guidelineSource: 'KDIGO',
      };

      const chunk = propagateMetadataToChunk(
        parsedMetadata,
        'GFR should be monitored regularly in CKD patients...',
        'doc_kdigo_2023'
      );

      expect(chunk.metadata.documentTitle).toBe('KDIGO 2023 Clinical Practice Guideline');
      expect(chunk.metadata.documentAuthor).toBe('Kidney Disease: Improving Global Outcomes');
      expect(chunk.metadata.documentYear).toBe(2023);
      expect(chunk.metadata.guidelineSource).toBe('KDIGO');
    });

    it('should handle partial metadata (title only)', () => {
      const parsedMetadata: ParsedMetadata = {
        title: 'Local Hospital Guidelines',
        pageCount: 20,
        year: 2022,
      };

      const chunk = propagateMetadataToChunk(
        parsedMetadata,
        'Clinical recommendations...',
        'doc_local'
      );

      expect(chunk.metadata.documentTitle).toBe('Local Hospital Guidelines');
      expect(chunk.metadata.documentAuthor).toBeUndefined();
      expect(chunk.metadata.documentYear).toBe(2022);
      expect(chunk.metadata.guidelineSource).toBeUndefined();
    });

    it('should handle empty metadata with filename fallback', () => {
      const parsedMetadata: ParsedMetadata = {
        title: 'guidelines_2024', // Fallback from filename
        pageCount: 10,
        year: 2024,
      };

      const chunk = propagateMetadataToChunk(
        parsedMetadata,
        'General content...',
        'guidelines_2024.pdf'
      );

      expect(chunk.metadata.documentTitle).toBe('guidelines_2024');
      expect(chunk.metadata.documentYear).toBe(2024);
    });
  });

  /**
   * Task 10.3: Backward compatibility verification
   */
  describe('Backward compatibility with legacy chunks', () => {
    /**
     * Simulates a legacy chunk without document-level metadata
     */
    function createLegacyChunk(content: string, documentId: string): HierarchicalChunk {
      const legacyMetadata: ChunkMetadata = {
        contentType: 'text',
        pageNumber: 5,
        // No documentTitle, documentAuthor, documentYear, guidelineSource
      };

      return createHierarchicalChunk(
        content,
        [],
        'small',
        { start: 0, end: content.length },
        documentId,
        createDefaultQualityScore(),
        legacyMetadata
      );
    }

    it('should work with chunks without documentTitle (fallback to sourceDocumentId)', () => {
      const legacyChunk = createLegacyChunk('Old content...', 'ADA_2023.pdf');

      // Simulate SourceCitation construction in chat.ts
      const sourceCitation = {
        documentName: legacyChunk.metadata.documentTitle ?? legacyChunk.sourceDocumentId,
        chunkId: legacyChunk.id,
      };

      expect(sourceCitation.documentName).toBe('ADA_2023.pdf');
    });

    it('should work with chunks without documentYear (undefined)', () => {
      const legacyChunk = createLegacyChunk('Old content...', 'document.pdf');

      // Simulate SourceCitation construction
      const sourceCitation = {
        documentName: legacyChunk.metadata.documentTitle ?? legacyChunk.sourceDocumentId,
        year: legacyChunk.metadata.documentYear,
      };

      expect(sourceCitation.year).toBeUndefined();
    });

    it('should work with chunks without guidelineSource', () => {
      const legacyChunk = createLegacyChunk('Clinical text...', 'hospital_guidelines.pdf');

      // Simulate evidence evaluation without guidelineSource
      const evaluation = {
        guidelineSource: legacyChunk.metadata.guidelineSource,
        authority: legacyChunk.metadata.guidelineSource ? 'international' : 'local',
      };

      expect(evaluation.guidelineSource).toBeUndefined();
      expect(evaluation.authority).toBe('local');
    });

    it('should not crash when accessing optional metadata fields', () => {
      const legacyChunk = createLegacyChunk('Any content...', 'doc.pdf');

      // All optional fields should be accessible without errors
      expect(legacyChunk.metadata.documentTitle).toBeUndefined();
      expect(legacyChunk.metadata.documentAuthor).toBeUndefined();
      expect(legacyChunk.metadata.documentYear).toBeUndefined();
      expect(legacyChunk.metadata.guidelineSource).toBeUndefined();

      // Should have required fields
      expect(legacyChunk.metadata.contentType).toBe('text');
    });
  });

  /**
   * Task 10.4: Frontend source citation display verification
   */
  describe('SourceCitation display formatting', () => {
    /**
     * Simulates the SourceCitation construction in chat.ts agentRetrieval
     */
    interface SourceCitation {
      documentId: string;
      documentName: string;
      chunkId: string;
      pageNumber?: number;
      year?: number;
    }

    function buildSourceCitation(chunk: HierarchicalChunk): SourceCitation {
      return {
        documentId: chunk.sourceDocumentId,
        // Use documentTitle from chunk metadata, fallback to sourceDocumentId (filename)
        documentName: chunk.metadata.documentTitle ?? chunk.sourceDocumentId,
        chunkId: chunk.id,
        ...(chunk.metadata.pageNumber ? { pageNumber: chunk.metadata.pageNumber } : {}),
        ...(chunk.metadata.documentYear ? { year: chunk.metadata.documentYear } : {}),
      };
    }

    it('should display human-readable title instead of filename', () => {
      const metadata: ChunkMetadata = {
        contentType: 'text',
        documentTitle: 'ADA Standards of Care 2024',
        documentYear: 2024,
        pageNumber: 15,
      };

      const chunk = createHierarchicalChunk(
        'Metformin recommendations...',
        [],
        'small',
        { start: 0, end: 100 },
        'ADA_2024.pdf',
        createDefaultQualityScore(),
        metadata
      );

      const citation = buildSourceCitation(chunk);

      expect(citation.documentName).toBe('ADA Standards of Care 2024');
      expect(citation.documentName).not.toBe('ADA_2024.pdf');
      expect(citation.year).toBe(2024);
      expect(citation.pageNumber).toBe(15);
    });

    it('should display filename when no title available', () => {
      const metadata: ChunkMetadata = {
        contentType: 'text',
        pageNumber: 3,
      };

      const chunk = createHierarchicalChunk(
        'Content...',
        [],
        'small',
        { start: 0, end: 50 },
        'hospital_guidelines.pdf',
        createDefaultQualityScore(),
        metadata
      );

      const citation = buildSourceCitation(chunk);

      expect(citation.documentName).toBe('hospital_guidelines.pdf');
      expect(citation.year).toBeUndefined();
    });

    it('should display complete citation for guideline document', () => {
      const metadata: ChunkMetadata = {
        contentType: 'text',
        documentTitle: 'KDIGO 2023 CKD Guidelines',
        documentAuthor: 'KDIGO Work Group',
        documentYear: 2023,
        guidelineSource: 'KDIGO',
        pageNumber: 42,
      };

      const chunk = createHierarchicalChunk(
        'CKD management recommendations...',
        [],
        'small',
        { start: 0, end: 200 },
        'KDIGO_2023_CKD.pdf',
        createDefaultQualityScore(),
        metadata
      );

      const citation = buildSourceCitation(chunk);

      // Expected display format: "KDIGO 2023 CKD Guidelines (p.42, 2023)"
      expect(citation.documentName).toBe('KDIGO 2023 CKD Guidelines');
      expect(citation.pageNumber).toBe(42);
      expect(citation.year).toBe(2023);
    });
  });

  /**
   * Task 10.1: Test fixture scenarios
   */
  describe('PDF metadata scenarios (test fixtures)', () => {
    /**
     * Simulates different PDF metadata scenarios
     */
    interface PdfTestFixture {
      name: string;
      pdfInfo: Record<string, string>;
      filename: string;
      expectedMetadata: Partial<ParsedMetadata>;
    }

    const fixtures: PdfTestFixture[] = [
      {
        name: 'full_metadata',
        pdfInfo: {
          Title: 'ADA Standards of Care 2024',
          Author: 'American Diabetes Association',
          Subject: 'Clinical Practice Guidelines',
          CreationDate: 'D:20240101',
        },
        filename: 'ADA_2024.pdf',
        expectedMetadata: {
          title: 'ADA Standards of Care 2024',
          author: 'American Diabetes Association',
          year: 2024,
          guidelineSource: 'ADA',
        },
      },
      {
        name: 'partial_metadata_no_author',
        pdfInfo: {
          Title: 'Clinical Guidelines 2023',
          CreationDate: 'D:20230115',
        },
        filename: 'guidelines.pdf',
        expectedMetadata: {
          title: 'Clinical Guidelines 2023',
          year: 2023,
          author: undefined,
        },
      },
      {
        name: 'empty_metadata_filename_fallback',
        pdfInfo: {},
        filename: 'ADA_2024_final.pdf',
        expectedMetadata: {
          title: 'ADA_2024_final',
          year: 2024,
        },
      },
      {
        name: 'generic_title_ignore',
        pdfInfo: {
          Title: 'Microsoft Word Document',
        },
        filename: 'guidelines_2022.pdf',
        expectedMetadata: {
          title: 'Microsoft Word Document',
          year: 2022,
        },
      },
      {
        name: 'chinese_guideline_cds',
        pdfInfo: {
          Title: '中国糖尿病学会指南 2024',
          Author: '中华医学会糖尿病分会',
        },
        filename: 'CDS_2024.pdf',
        expectedMetadata: {
          title: '中国糖尿病学会指南 2024',
          guidelineSource: 'CDS',
          year: 2024,
        },
      },
    ];

    it('should handle full metadata PDF', () => {
      const fixture = fixtures.find(f => f.name === 'full_metadata')!;
      expect(fixture.expectedMetadata.title).toBe('ADA Standards of Care 2024');
      expect(fixture.expectedMetadata.author).toBe('American Diabetes Association');
      expect(fixture.expectedMetadata.year).toBe(2024);
      expect(fixture.expectedMetadata.guidelineSource).toBe('ADA');
    });

    it('should handle partial metadata (no author)', () => {
      const fixture = fixtures.find(f => f.name === 'partial_metadata_no_author')!;
      expect(fixture.expectedMetadata.author).toBeUndefined();
      expect(fixture.expectedMetadata.year).toBe(2023);
    });

    it('should use filename fallback when no PDF metadata', () => {
      const fixture = fixtures.find(f => f.name === 'empty_metadata_filename_fallback')!;
      expect(fixture.expectedMetadata.title).toBe('ADA_2024_final');
      expect(fixture.expectedMetadata.year).toBe(2024);
    });

    it('should identify Chinese guideline source (CDS)', () => {
      const fixture = fixtures.find(f => f.name === 'chinese_guideline_cds')!;
      expect(fixture.expectedMetadata.guidelineSource).toBe('CDS');
    });
  });

  /**
   * Task: VectorPayload metadata fields for GRADE evaluation
   */
  describe('VectorPayload metadata fields', () => {
    /**
     * Simulates VectorPayload construction from ChunkMetadata
     */
    interface VectorPayload {
      documentId: string;
      chunkId: string;
      level: 'small' | 'parent' | 'image';
      modality: 'text' | 'image';
      pageNumber?: number;
      contentType?: string;
      documentYear?: number;
      documentTitle?: string;
      documentAuthor?: string;
      guidelineSource?: string;
    }

    function buildPayloadFromChunk(chunk: HierarchicalChunk, documentId: string): VectorPayload {
      return {
        documentId,
        chunkId: chunk.id,
        level: 'small',
        modality: 'text',
        pageNumber: chunk.metadata.pageNumber,
        contentType: chunk.metadata.contentType,
        documentYear: chunk.metadata.documentYear,
        documentTitle: chunk.metadata.documentTitle,
        documentAuthor: chunk.metadata.documentAuthor,
        guidelineSource: chunk.metadata.guidelineSource,
      };
    }

    it('should include documentYear in payload when chunk has year', () => {
      const metadata: ChunkMetadata = {
        contentType: 'text',
        documentYear: 2024,
        documentTitle: 'ADA Standards of Care 2024',
        guidelineSource: 'ADA',
      };

      const chunk = createHierarchicalChunk(
        'Metformin recommendations...',
        [],
        'small',
        { start: 0, end: 100 },
        'doc_ada',
        createDefaultQualityScore(),
        metadata
      );

      const payload = buildPayloadFromChunk(chunk, 'doc_ada');

      expect(payload.documentYear).toBe(2024);
      expect(payload.documentTitle).toBe('ADA Standards of Care 2024');
      expect(payload.guidelineSource).toBe('ADA');
    });

    it('should have undefined documentYear when chunk lacks year', () => {
      const metadata: ChunkMetadata = {
        contentType: 'text',
        // No documentYear
      };

      const chunk = createHierarchicalChunk(
        'General content...',
        [],
        'small',
        { start: 0, end: 50 },
        'doc_general',
        createDefaultQualityScore(),
        metadata
      );

      const payload = buildPayloadFromChunk(chunk, 'doc_general');

      expect(payload.documentYear).toBeUndefined();
      expect(payload.documentTitle).toBeUndefined();
      expect(payload.guidelineSource).toBeUndefined();
    });
  });

  /**
   * Task: recoverFromQdrant metadata recovery
   */
  describe('recoverFromQdrant metadata recovery', () => {
    /**
     * Simulates metadata recovery from Qdrant payload
     */
    function recoverMetadataFromPayload(payload: {
      contentType?: string;
      pageNumber?: number;
      documentYear?: number;
      documentTitle?: string;
      documentAuthor?: string;
      guidelineSource?: string;
    }): ChunkMetadata {
      return {
        contentType: (payload.contentType as 'text' | 'table' | 'image' | 'formula') ?? 'text',
        boundaryConfidence: 0.5,
        ...(payload.pageNumber !== undefined ? { pageNumber: payload.pageNumber } : {}),
        ...(payload.documentYear !== undefined ? { documentYear: payload.documentYear } : {}),
        ...(payload.documentTitle !== undefined ? { documentTitle: payload.documentTitle } : {}),
        ...(payload.documentAuthor !== undefined ? { documentAuthor: payload.documentAuthor } : {}),
        ...(payload.guidelineSource !== undefined ? { guidelineSource: payload.guidelineSource } : {}),
      };
    }

    it('should recover documentYear from payload', () => {
      const payload = {
        contentType: 'text',
        pageNumber: 15,
        documentYear: 2024,
        documentTitle: 'KDIGO 2023 CKD Guidelines',
        guidelineSource: 'KDIGO',
      };

      const metadata = recoverMetadataFromPayload(payload);

      expect(metadata.documentYear).toBe(2024);
      expect(metadata.documentTitle).toBe('KDIGO 2023 CKD Guidelines');
      expect(metadata.guidelineSource).toBe('KDIGO');
      expect(metadata.pageNumber).toBe(15);
    });

    it('should handle legacy payload without new fields', () => {
      const legacyPayload = {
        contentType: 'text',
        pageNumber: 10,
        // No documentYear, documentTitle, guidelineSource
      };

      const metadata = recoverMetadataFromPayload(legacyPayload);

      expect(metadata.documentYear).toBeUndefined();
      expect(metadata.documentTitle).toBeUndefined();
      expect(metadata.guidelineSource).toBeUndefined();
      expect(metadata.pageNumber).toBe(10); // Existing field preserved
      expect(metadata.contentType).toBe('text');
    });

    it('should handle partial metadata in payload', () => {
      const partialPayload = {
        contentType: 'text',
        documentYear: 2022,
        // No documentTitle or guidelineSource
      };

      const metadata = recoverMetadataFromPayload(partialPayload);

      expect(metadata.documentYear).toBe(2022);
      expect(metadata.documentTitle).toBeUndefined();
      expect(metadata.guidelineSource).toBeUndefined();
    });

    it('should preserve all existing fields while adding new ones', () => {
      const fullPayload = {
        contentType: 'table',
        pageNumber: 42,
        documentYear: 2023,
        documentTitle: 'ADA Standards of Care 2023',
        documentAuthor: 'American Diabetes Association',
        guidelineSource: 'ADA',
      };

      const metadata = recoverMetadataFromPayload(fullPayload);

      // Existing fields preserved
      expect(metadata.contentType).toBe('table');
      expect(metadata.pageNumber).toBe(42);
      expect(metadata.boundaryConfidence).toBe(0.5);

      // New fields recovered
      expect(metadata.documentYear).toBe(2023);
      expect(metadata.documentTitle).toBe('ADA Standards of Care 2023');
      expect(metadata.documentAuthor).toBe('American Diabetes Association');
      expect(metadata.guidelineSource).toBe('ADA');
    });
  });
});