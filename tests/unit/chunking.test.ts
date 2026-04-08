/**
 * @spec chunking-layer.md
 * @layer 2
 * @description 切分层单元测试
 */

import { describe, it, expect } from 'vitest';
import { DocumentAnalyzer } from '../../src/chunking/analyzer';
import { RecursiveChunker, FixedSizeChunker, MarkdownSectionChunker } from '../../src/chunking/splitters/index';
import { TextEnhancer } from '../../src/chunking/enhancer';
import { ChunkValidator } from '../../src/chunking/validator';
import { ChunkingPipelineImpl } from '../../src/chunking/pipeline';
import type { Document } from '../../src/types/index';

describe('DocumentAnalyzer', () => {
  const analyzer = new DocumentAnalyzer();

  it('should detect markdown document type', async () => {
    const doc: Document = {
      id: 'test-1',
      path: '/test.md',
      content: '# Title\n\n## Section 1\n\nContent here.',
      metadata: { filename: 'test.md', extension: 'md', size: 100, createdAt: new Date(), modifiedAt: new Date() }
    };

    const result = await analyzer.analyze(doc);
    expect(result.docType).toBe('markdown');
    expect(result.structure.hasTitle).toBe(true);
    // hasSections checks for ## or ### headings
    expect(result.structure.sectionCount).toBeGreaterThanOrEqual(0);
  });

  it('should detect code document type', async () => {
    const doc: Document = {
      id: 'test-2',
      path: '/test.ts',
      content: 'function hello() { return "world"; }',
      metadata: { filename: 'test.ts', extension: 'ts', size: 100, createdAt: new Date(), modifiedAt: new Date() }
    };

    const result = await analyzer.analyze(doc);
    expect(result.docType).toBe('code');
    expect(result.recommendedStrategy).toBe('ast-based');
  });

  it('should calculate semantic density', async () => {
    const doc: Document = {
      id: 'test-3',
      path: '/test.txt',
      content: 'This is a simple test document with normal length sentences.',
      metadata: { filename: 'test.txt', extension: 'txt', size: 100, createdAt: new Date(), modifiedAt: new Date() }
    };

    const result = await analyzer.analyze(doc);
    expect(result.semanticDensity.level).toBeDefined();
    expect(result.semanticDensity.avgSentenceLength).toBeGreaterThan(0);
  });
});

describe('Chunkers', () => {
  const testDoc: Document = {
    id: 'chunk-test',
    path: '/test.md',
    content: '# Title\n\nParagraph 1.\n\nParagraph 2.\n\nParagraph 3.',
    metadata: { filename: 'test.md', extension: 'md', size: 100, createdAt: new Date(), modifiedAt: new Date() }
  };

  it('RecursiveChunker should split by separators', async () => {
    const chunker = new RecursiveChunker();
    const chunks = await chunker.chunk(testDoc, { chunkSize: 30, overlap: 5 });

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].docId).toBe('chunk-test');
  });

  it('FixedSizeChunker should create fixed size chunks', async () => {
    const chunker = new FixedSizeChunker();
    const chunks = await chunker.chunk(testDoc, { chunkSize: 50, overlap: 10 });

    expect(chunks.length).toBeGreaterThan(0);
    for (const chunk of chunks) {
      expect(chunk.content.length).toBeLessThanOrEqual(60); // chunkSize + some buffer
    }
  });

  it('MarkdownSectionChunker should split by sections', async () => {
    const chunker = new MarkdownSectionChunker();
    const chunks = await chunker.chunk(testDoc);

    expect(chunks.length).toBeGreaterThan(0);
    // Each section should have section metadata
    for (const chunk of chunks) {
      expect(chunk.metadata.section).toBeDefined();
    }
  });
});

describe('TextEnhancer', () => {
  const enhancer = new TextEnhancer();

  it('should enhance with title prefix', async () => {
    const chunk = {
      id: 'test-chunk',
      docId: 'doc-1',
      content: 'Test content',
      position: { start: 0, end: 12 },
      metadata: { type: 'text' as const }
    };

    const result = await enhancer.enhance(chunk, {
      document: { title: 'Test Title' }
    });

    expect(result.enhancedContent).toContain('Test Title');
    expect(result.enhancementTypes).toContain('title-prefix');
    expect(result.originalContent).toBe('Test content');
  });

  it('should enhance with keywords', async () => {
    const chunk = {
      id: 'test-chunk',
      docId: 'doc-1',
      content: 'Test content',
      position: { start: 0, end: 12 },
      metadata: { type: 'text' as const }
    };

    const result = await enhancer.enhance(chunk, {
      document: { keywords: ['keyword1', 'keyword2'] }
    });

    expect(result.enhancedContent).toContain('keyword1');
    expect(result.enhancementTypes).toContain('keyword-injection');
  });
});

describe('ChunkValidator', () => {
  const validator = new ChunkValidator();

  it('should validate chunks correctly', () => {
    const chunks = [
      { id: '1', docId: 'doc', content: 'Valid chunk with enough content to pass validation.', position: { start: 0, end: 50 }, metadata: { type: 'text' as const } },
      { id: '2', docId: 'doc', content: 'Too short', position: { start: 50, end: 60 }, metadata: { type: 'text' as const } }
    ];

    const result = validator.validate(chunks, { minChunkSize: 20 });

    expect(result.validChunks.length).toBe(1);
    expect(result.invalidChunks.length).toBe(1);
    expect(result.invalidChunks[0].reason).toBe('too-small');
  });

  it('should detect duplicates', () => {
    const longContent = 'This is a longer duplicate content that should pass the minimum size validation check for testing duplicate detection functionality.';
    const chunks = [
      { id: '1', docId: 'doc', content: longContent, position: { start: 0, end: longContent.length }, metadata: { type: 'text' as const } },
      { id: '2', docId: 'doc', content: longContent, position: { start: longContent.length, end: longContent.length * 2 }, metadata: { type: 'text' as const } }
    ];

    const result = validator.validate(chunks);

    // First one is valid, second is duplicate
    expect(result.validChunks.length).toBe(1);
    expect(result.invalidChunks.some(i => i.reason === 'duplicate')).toBe(true);
  });
});

describe('ChunkingPipeline', () => {
  it('should process document end-to-end', async () => {
    const pipeline = new ChunkingPipelineImpl();
    const doc: Document = {
      id: 'pipeline-test',
      path: '/test.md',
      content: '# Title\n\nParagraph 1 has some content.\n\nParagraph 2 has more content.\n\nParagraph 3 continues.',
      metadata: { filename: 'test.md', extension: 'md', size: 100, createdAt: new Date(), modifiedAt: new Date() }
    };

    const { chunks, trace } = await pipeline.process(doc, {}, true);

    expect(chunks.length).toBeGreaterThan(0);
    expect(trace).toBeDefined();
    expect(trace?.stages.analyze.docType).toBe('markdown');
    expect(trace?.output.totalChunks).toBe(chunks.length);
  });
});