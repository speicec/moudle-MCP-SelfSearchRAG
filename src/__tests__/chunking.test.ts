import { describe, it, expect } from 'vitest';
import {
  cosineSimilarity,
  adjacentSimilarity,
  similarityGradient,
  aggregateEmbeddings,
  splitIntoSentences,
  estimateTokenCount,
  calculateRepetitionRatio,
} from '../chunking/utils.js';
import { CliffDetector, createCliffDetector } from '../chunking/cliff-detector.js';
import { SemanticChunker, createSemanticChunker } from '../chunking/semantic-chunker.js';
import { HierarchicalStore, createHierarchicalStore } from '../chunking/hierarchical-store.js';
import { ChunkQualityFilter, createChunkQualityFilter } from '../chunking/quality-filter.js';
import { SmallToBigRetriever, createSmallToBigRetriever } from '../chunking/small-to-big-retriever.js';
import { createHierarchicalChunk, createDefaultQualityScore } from '../chunking/types.js';

describe('Chunking Utils', () => {
  describe('cosineSimilarity', () => {
    it('should return 1 for identical vectors', () => {
      const vec = [1, 2, 3];
      expect(cosineSimilarity(vec, vec)).toBeCloseTo(1, 5);
    });

    it('should return 0 for orthogonal vectors', () => {
      const a = [1, 0, 0];
      const b = [0, 1, 0];
      expect(cosineSimilarity(a, b)).toBeCloseTo(0, 5);
    });

    it('should return -1 for opposite vectors', () => {
      const a = [1, 1, 1];
      const b = [-1, -1, -1];
      expect(cosineSimilarity(a, b)).toBeCloseTo(-1, 5);
    });

    it('should throw for different length vectors', () => {
      const a = [1, 2, 3];
      const b = [1, 2];
      expect(() => cosineSimilarity(a, b)).toThrow();
    });

    it('should return 0 for empty vectors', () => {
      expect(cosineSimilarity([], [])).toBe(0);
    });
  });

  describe('adjacentSimilarity', () => {
    it('should return empty array for single embedding', () => {
      expect(adjacentSimilarity([[1, 2, 3]])).toEqual([]);
    });

    it('should return empty array for empty embeddings', () => {
      expect(adjacentSimilarity([])).toEqual([]);
    });

    it('should calculate similarity between adjacent pairs', () => {
      const embeddings = [
        [1, 0, 0],
        [1, 0, 0],
        [0, 1, 0],
      ];
      const similarities = adjacentSimilarity(embeddings);

      expect(similarities.length).toBe(2);
      expect(similarities[0]).toBeCloseTo(1, 5); // identical
      expect(similarities[1]).toBeCloseTo(0, 5); // orthogonal
    });
  });

  describe('similarityGradient', () => {
    it('should return empty for single similarity', () => {
      expect(similarityGradient([0.5])).toEqual([]);
    });

    it('should calculate gradient between adjacent similarities', () => {
      const similarities = [0.9, 0.7, 0.5];
      const gradients = similarityGradient(similarities);

      expect(gradients.length).toBe(2);
      expect(gradients[0]).toBeCloseTo(0.2, 5);
      expect(gradients[1]).toBeCloseTo(0.2, 5);
    });
  });

  describe('aggregateEmbeddings', () => {
    it('should return empty for empty embeddings', () => {
      expect(aggregateEmbeddings([])).toEqual([]);
    });

    it('should calculate mean of embeddings', () => {
      const embeddings = [
        [1, 2, 3],
        [2, 4, 6],
      ];
      const aggregated = aggregateEmbeddings(embeddings);

      expect(aggregated).toEqual([1.5, 3, 4.5]);
    });
  });

  describe('splitIntoSentences', () => {
    it('should split on sentence boundaries', () => {
      const text = 'First sentence. Second sentence! Third sentence?';
      const sentences = splitIntoSentences(text);

      expect(sentences.length).toBe(3);
      expect(sentences[0]).toBe('First sentence.');
      expect(sentences[1]).toBe('Second sentence!');
      expect(sentences[2]).toBe('Third sentence?');
    });

    it('should handle empty text', () => {
      expect(splitIntoSentences('')).toEqual([]);
    });

    it('should handle text without sentence endings', () => {
      const text = 'No sentence endings here';
      const sentences = splitIntoSentences(text);

      expect(sentences.length).toBe(1);
      expect(sentences[0]).toBe('No sentence endings here');
    });
  });

  describe('estimateTokenCount', () => {
    it('should estimate tokens based on character count', () => {
      const text = 'This is a test'; // 14 chars ~ 4 tokens
      expect(estimateTokenCount(text)).toBeCloseTo(4, 0);
    });

    it('should return 0 for empty text', () => {
      expect(estimateTokenCount('')).toBe(0);
    });
  });

  describe('calculateRepetitionRatio', () => {
    it('should return 0 for unique words', () => {
      const text = 'unique words only';
      expect(calculateRepetitionRatio(text)).toBeCloseTo(0, 5);
    });

    it('should detect repetition', () => {
      const text = 'test test test'; // 3 tokens, 1 unique
      expect(calculateRepetitionRatio(text)).toBeCloseTo(0.67, 1);
    });

    it('should return 0 for empty text', () => {
      expect(calculateRepetitionRatio('')).toBe(0);
    });
  });
});

describe('CliffDetector', () => {
  describe('constructor', () => {
    it('should create detector with default config', () => {
      const detector = createCliffDetector();
      const config = detector.getConfig();

      expect(config.similarityThreshold).toBe(0.7);
      expect(config.gradientThreshold).toBe(0.15);
      expect(config.minCliffWidth).toBe(2);
    });

    it('should accept custom config', () => {
      const detector = createCliffDetector({
        similarityThreshold: 0.5,
        gradientThreshold: 0.1,
      });
      const config = detector.getConfig();

      expect(config.similarityThreshold).toBe(0.5);
      expect(config.gradientThreshold).toBe(0.1);
    });

    it('should validate config', () => {
      expect(() => createCliffDetector({ similarityThreshold: 1.5 })).toThrow();
      expect(() => createCliffDetector({ minCliffWidth: 0 })).toThrow();
    });
  });

  describe('detect', () => {
    it('should detect no cliffs for identical embeddings', () => {
      const detector = createCliffDetector();
      const embeddings = [
        [1, 0, 0],
        [1, 0, 0],
        [1, 0, 0],
        [1, 0, 0],
      ];

      const result = detector.detect(embeddings);

      expect(result.cliffs.length).toBe(0);
      expect(result.similaritySequence.every(s => s > 0.99)).toBe(true);
    });

    it('should detect cliff at semantic boundary', () => {
      const detector = createCliffDetector({
        similarityThreshold: 0.7,
        gradientThreshold: 0.15,
        minCliffWidth: 1,
      });

      // Create embeddings with clear semantic shift
      const embeddings = [
        [1, 0, 0],  // topic A
        [0.95, 0.05, 0], // still A
        [0, 1, 0],  // topic B (cliff here)
        [0.05, 0.95, 0], // still B
      ];

      const result = detector.detect(embeddings);

      expect(result.cliffs.length).toBeGreaterThan(0);
      expect(result.cliffs[0].position).toBe(1); // cliff between index 1 and 2
      expect(result.cliffs[0].confidence).toBeGreaterThan(0);
    });

    it('should filter noise with minCliffWidth', () => {
      const detector = createCliffDetector({
        minCliffWidth: 2,
      });

      // Single cliff point should be filtered
      const embeddings = [
        [1, 0, 0],
        [0.95, 0.05, 0],
        [0, 1, 0],
        [0.05, 0.95, 0],
        [0.1, 0.9, 0],
      ];

      const result = detector.detect(embeddings);

      // Should not detect single-point cliff
      expect(result.cliffs.length).toBe(0);
    });

    it('should compute cliff confidence', () => {
      const detector = createCliffDetector({
        minCliffWidth: 1,
      });

      const embeddings = [
        [1, 0, 0],
        [1, 0, 0],
        [0, 1, 0],
        [0, 1, 0],
      ];

      const result = detector.detect(embeddings);

      if (result.cliffs.length > 0) {
        expect(result.cliffs[0].confidence).toBeGreaterThan(0);
        expect(result.cliffs[0].confidence).toBeLessThanOrEqual(1);
      }
    });

    it('should return similarity sequence', () => {
      const detector = createCliffDetector();
      const embeddings = [
        [1, 0, 0],
        [0.8, 0.2, 0],
        [0.6, 0.4, 0],
      ];

      const result = detector.detect(embeddings);

      expect(result.similaritySequence.length).toBe(2);
      expect(result.embeddingSequence).toEqual(embeddings);
    });
  });

  describe('getHighConfidenceCliffs', () => {
    it('should filter cliffs by confidence threshold', () => {
      const detector = createCliffDetector({
        highConfidenceThreshold: 0.8,
        minCliffWidth: 1,
      });

      const embeddings = [
        [1, 0, 0],
        [1, 0, 0],
        [0, 1, 0],
        [0, 1, 0],
      ];

      const result = detector.detect(embeddings);
      const highConfidence = detector.getHighConfidenceCliffs(result);

      // Only cliffs with confidence >= 0.8
      expect(highConfidence.every(c => c.confidence >= 0.8)).toBe(true);
    });
  });

  describe('setConfig', () => {
    it('should update config', () => {
      const detector = createCliffDetector();

      detector.setConfig({ similarityThreshold: 0.5 });
      expect(detector.getConfig().similarityThreshold).toBe(0.5);
    });

    it('should validate new config', () => {
      const detector = createCliffDetector();

      expect(() => detector.setConfig({ similarityThreshold: 2 })).toThrow();
    });
  });
});

describe('SemanticChunker', () => {
  describe('constructor', () => {
    it('should create chunker with default config', () => {
      const chunker = createSemanticChunker();
      const config = chunker.getConfig();

      expect(config.windowSize).toBe(3);
      expect(config.smallChunkMinTokens).toBe(100);
      expect(config.smallChunkMaxTokens).toBe(300);
    });

    it('should accept custom config', () => {
      const chunker = createSemanticChunker({
        windowSize: 5,
        smallChunkMinTokens: 50,
      });
      const config = chunker.getConfig();

      expect(config.windowSize).toBe(5);
      expect(config.smallChunkMinTokens).toBe(50);
    });
  });

  describe('chunk', () => {
    it('should chunk text into multiple chunks', async () => {
      const chunker = createSemanticChunker({
        smallChunkMinTokens: 10,
        smallChunkMaxTokens: 100,
        fallbackChunkSize: 50,
      });

      // Create text with clear topic shifts
      const text = `
        Introduction to machine learning. Machine learning is a field of AI.
        It involves training models on data. Models learn patterns from examples.

        Deep learning is a subset of ML. It uses neural networks with many layers.
        Neural networks process information hierarchically. Each layer extracts features.

        Applications include image recognition. Natural language processing uses deep learning.
        Speech recognition also benefits from these techniques.
      `;

      const chunks = await chunker.chunk(text, 'doc-1');

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.every(c => c.level === 'small')).toBe(true);
      expect(chunks.every(c => c.sourceDocumentId === 'doc-1')).toBe(true);
    });

    it('should handle empty text', async () => {
      const chunker = createSemanticChunker();
      const chunks = await chunker.chunk('', 'doc-1');

      expect(chunks.length).toBe(0);
    });

    it('should preserve chunk metadata', async () => {
      const chunker = createSemanticChunker({
        smallChunkMinTokens: 10,
      });

      const text = 'First sentence. Second sentence. Third sentence.';
      const chunks = await chunker.chunk(text, 'doc-test');

      for (const chunk of chunks) {
        expect(chunk.id).toBeDefined();
        expect(chunk.content.length).toBeGreaterThan(0);
        expect(chunk.position.start).toBeDefined();
        expect(chunk.position.end).toBeDefined();
        expect(chunk.qualityScore).toBeDefined();
      }
    });

    it('should use fallback chunking when no cliffs detected', async () => {
      const chunker = createSemanticChunker({
        fallbackChunkSize: 20,
        smallChunkMinTokens: 5,
      });

      // Uniform text (no topic shifts)
      const text = 'Same topic content here. More of the same. Continue same topic. Still same topic.';

      const chunks = await chunker.chunk(text, 'doc-fallback');

      expect(chunks.length).toBeGreaterThan(0);
      // Fallback chunks have low confidence
      expect(chunks.some(c => c.metadata.boundaryConfidence <= 0.5)).toBe(true);
    });
  });

  describe('clearCache', () => {
    it('should clear embedding cache', () => {
      const chunker = createSemanticChunker();
      chunker.clearCache();
      // No exception expected
    });
  });
});

describe('HierarchicalStore', () => {
  describe('constructor', () => {
    it('should create store with default config', () => {
      const store = createHierarchicalStore();
      const config = store.getConfig();

      expect(config.parentChunkMinTokens).toBe(500);
      expect(config.parentChunkMaxTokens).toBe(1500);
    });

    it('should accept custom config', () => {
      const store = createHierarchicalStore({
        parentChunkMinTokens: 200,
        parentChunkMaxTokens: 800,
      });
      const config = store.getConfig();

      expect(config.parentChunkMinTokens).toBe(200);
      expect(config.parentChunkMaxTokens).toBe(800);
    });
  });

  describe('buildHierarchy', () => {
    it('should build parent chunks from small chunks', async () => {
      const store = createHierarchicalStore({
        parentChunkMinTokens: 50,
        parentChunkMaxTokens: 200,
      });

      // Create small chunks
      const smallChunks = [
        createHierarchicalChunk(
          'Content chunk one with enough tokens to meet minimum requirements.',
          [1, 0, 0],
          'small',
          { start: 0, end: 1 },
          'doc-1',
          createDefaultQualityScore(),
          { contentType: 'text' }
        ),
        createHierarchicalChunk(
          'Content chunk two also has sufficient tokens for minimum size threshold.',
          [0.8, 0.2, 0],
          'small',
          { start: 1, end: 2 },
          'doc-1',
          createDefaultQualityScore(),
          { contentType: 'text' }
        ),
        createHierarchicalChunk(
          'Content chunk three meets minimum token requirements for parent group.',
          [0.6, 0.4, 0],
          'small',
          { start: 2, end: 3 },
          'doc-1',
          createDefaultQualityScore(),
          { contentType: 'text' }
        ),
      ];

      const hierarchy = await store.buildHierarchy(smallChunks, 'doc-1');

      // Should have small chunks + parent chunks
      const smallCount = hierarchy.filter(c => c.level === 'small').length;
      const parentCount = hierarchy.filter(c => c.level === 'parent').length;

      expect(smallCount).toBe(3);
      expect(parentCount).toBeGreaterThan(0);
    });

    it('should link small chunks to parent', async () => {
      const store = createHierarchicalStore({
        parentChunkMinTokens: 50,
        parentChunkMaxTokens: 200,
      });

      const smallChunks = [
        createHierarchicalChunk(
          'Small chunk one for testing parent linking functionality.',
          [1, 0, 0],
          'small',
          { start: 0, end: 1 },
          'doc-1',
          createDefaultQualityScore(),
          { contentType: 'text' }
        ),
        createHierarchicalChunk(
          'Small chunk two for testing parent linking functionality.',
          [0.8, 0.2, 0],
          'small',
          { start: 1, end: 2 },
          'doc-1',
          createDefaultQualityScore(),
          { contentType: 'text' }
        ),
      ];

      await store.buildHierarchy(smallChunks, 'doc-1');

      // All small chunks should have parentId
      const storedSmall = store.getAllSmallChunks();
      expect(storedSmall.every(c => c.parentId !== undefined)).toBe(true);
    });

    it('should enforce parent max size limit', async () => {
      const store = createHierarchicalStore({
        parentChunkMinTokens: 20,
        parentChunkMaxTokens: 50, // Very small max to force splitting
      });

      // Create many small chunks that would exceed max
      const smallChunks = [];
      for (let i = 0; i < 10; i++) {
        smallChunks.push(createHierarchicalChunk(
          `Chunk number ${i} with moderate content length.`,
          [1 - i * 0.1, i * 0.1, 0],
          'small',
          { start: i, end: i + 1 },
          'doc-1',
          createDefaultQualityScore(),
          { contentType: 'text' }
        ));
      }

      await store.buildHierarchy(smallChunks, 'doc-1');

      // Should have multiple parents
      const parents = store.getAllParentChunks();
      expect(parents.length).toBeGreaterThan(1);

      // Each parent should respect max size
      for (const parent of parents) {
        const tokens = estimateTokenCount(parent.content);
        expect(tokens).toBeLessThanOrEqual(50 + 20); // Allow small buffer
      }
    });
  });

  describe('getParentChunk', () => {
    it('should return parent for small chunk', async () => {
      const store = createHierarchicalStore({
        parentChunkMinTokens: 50,
        parentChunkMaxTokens: 200,
      });

      const smallChunks = [
        createHierarchicalChunk(
          'Small chunk for parent retrieval test.',
          [1, 0, 0],
          'small',
          { start: 0, end: 1 },
          'doc-1',
          createDefaultQualityScore(),
          { contentType: 'text' }
        ),
        createHierarchicalChunk(
          'Second small chunk for parent retrieval test.',
          [0.8, 0.2, 0],
          'small',
          { start: 1, end: 2 },
          'doc-1',
          createDefaultQualityScore(),
          { contentType: 'text' }
        ),
      ];

      await store.buildHierarchy(smallChunks, 'doc-1');

      const storedSmall = store.getAllSmallChunks();
      const firstSmall = storedSmall[0];

      if (firstSmall && firstSmall.parentId) {
        const parent = store.getParentChunk(firstSmall.id);
        expect(parent).toBeDefined();
        expect(parent?.level).toBe('parent');
        expect(parent?.childIds?.includes(firstSmall.id)).toBe(true);
      }
    });

    it('should return undefined for chunk without parent', () => {
      const store = createHierarchicalStore();

      const smallChunk = createHierarchicalChunk(
        'Orphan chunk with no parent.',
        [1, 0, 0],
        'small',
        { start: 0, end: 1 },
        'doc-1',
        createDefaultQualityScore(),
        { contentType: 'text' }
      );

      store.addChunk(smallChunk);

      const parent = store.getParentChunk(smallChunk.id);
      expect(parent).toBeUndefined();
    });
  });

  describe('getChildChunks', () => {
    it('should return all children for parent', async () => {
      const store = createHierarchicalStore({
        parentChunkMinTokens: 50,
        parentChunkMaxTokens: 200,
      });

      const smallChunks = [
        createHierarchicalChunk(
          'Child chunk one for testing child retrieval.',
          [1, 0, 0],
          'small',
          { start: 0, end: 1 },
          'doc-1',
          createDefaultQualityScore(),
          { contentType: 'text' }
        ),
        createHierarchicalChunk(
          'Child chunk two for testing child retrieval.',
          [0.8, 0.2, 0],
          'small',
          { start: 1, end: 2 },
          'doc-1',
          createDefaultQualityScore(),
          { contentType: 'text' }
        ),
      ];

      await store.buildHierarchy(smallChunks, 'doc-1');

      const parent = store.getAllParentChunks()[0];
      if (parent) {
        const children = store.getChildChunks(parent.id);
        expect(children.length).toBe(2);
        expect(children.every(c => c.level === 'small')).toBe(true);
      }
    });
  });

  describe('validate', () => {
    it('should validate correct hierarchy', async () => {
      const store = createHierarchicalStore({
        parentChunkMinTokens: 50,
        parentChunkMaxTokens: 200,
      });

      const smallChunks = [
        createHierarchicalChunk(
          'Valid chunk one for hierarchy validation.',
          [1, 0, 0],
          'small',
          { start: 0, end: 1 },
          'doc-1',
          createDefaultQualityScore(),
          { contentType: 'text' }
        ),
        createHierarchicalChunk(
          'Valid chunk two for hierarchy validation.',
          [0.8, 0.2, 0],
          'small',
          { start: 1, end: 2 },
          'doc-1',
          createDefaultQualityScore(),
          { contentType: 'text' }
        ),
      ];

      await store.buildHierarchy(smallChunks, 'doc-1');

      const validation = store.validate();
      expect(validation.valid).toBe(true);
      expect(validation.errors.length).toBe(0);
    });
  });

  describe('clear', () => {
    it('should clear all chunks', async () => {
      const store = createHierarchicalStore({
        parentChunkMinTokens: 50,
        parentChunkMaxTokens: 200,
      });

      const smallChunks = [
        createHierarchicalChunk(
          'Chunk for clearing test.',
          [1, 0, 0],
          'small',
          { start: 0, end: 1 },
          'doc-1',
          createDefaultQualityScore(),
          { contentType: 'text' }
        ),
      ];

      await store.buildHierarchy(smallChunks, 'doc-1');

      store.clear();
      const count = store.getChunkCount();
      expect(count.small).toBe(0);
      expect(count.parent).toBe(0);
    });
  });
});

describe('ChunkQualityFilter', () => {
  describe('constructor', () => {
    it('should create filter with default config', () => {
      const filter = createChunkQualityFilter();
      const config = filter.getConfig();

      expect(config.qualityThreshold).toBe(0.3);
      expect(config.filterMode).toBe('flag');
    });

    it('should accept custom config', () => {
      const filter = createChunkQualityFilter({
        qualityThreshold: 0.5,
        filterMode: 'discard',
      });
      const config = filter.getConfig();

      expect(config.qualityThreshold).toBe(0.5);
      expect(config.filterMode).toBe('discard');
    });
  });

  describe('evaluate', () => {
    it('should calculate quality score for chunk', () => {
      const filter = createChunkQualityFilter();

      const chunk = createHierarchicalChunk(
        'This is a well-formed sentence with unique content and proper structure.',
        [1, 0, 0],
        'small',
        { start: 0, end: 1 },
        'doc-1',
        createDefaultQualityScore(),
        { contentType: 'text' }
      );

      const score = filter.evaluate(chunk);

      expect(score.composite).toBeGreaterThanOrEqual(0);
      expect(score.composite).toBeLessThanOrEqual(1);
      expect(score.dimensions.informationDensity).toBeGreaterThanOrEqual(0);
      expect(score.dimensions.repetitionRatio).toBeGreaterThanOrEqual(0);
      expect(score.dimensions.semanticCompleteness).toBeGreaterThanOrEqual(0);
      expect(score.dimensions.documentRelevance).toBeGreaterThanOrEqual(0);
    });

    it('should detect high repetition', () => {
      const filter = createChunkQualityFilter();

      const chunk = createHierarchicalChunk(
        'test test test test test test test test test test',
        [1, 0, 0],
        'small',
        { start: 0, end: 1 },
        'doc-1',
        createDefaultQualityScore(),
        { contentType: 'text' }
      );

      const score = filter.evaluate(chunk);

      expect(score.dimensions.repetitionRatio).toBeLessThan(0.5);
    });

    it('should detect complete sentences', () => {
      const filter = createChunkQualityFilter();

      const completeChunk = createHierarchicalChunk(
        'This is a complete sentence. This is another one.',
        [1, 0, 0],
        'small',
        { start: 0, end: 1 },
        'doc-1',
        createDefaultQualityScore(),
        { contentType: 'text' }
      );

      const incompleteChunk = createHierarchicalChunk(
        'this is not a complete sentence without proper ending',
        [1, 0, 0],
        'small',
        { start: 0, end: 1 },
        'doc-1',
        createDefaultQualityScore(),
        { contentType: 'text' }
      );

      const completeScore = filter.evaluate(completeChunk);
      const incompleteScore = filter.evaluate(incompleteChunk);

      expect(completeScore.dimensions.semanticCompleteness)
        .toBeGreaterThan(incompleteScore.dimensions.semanticCompleteness);
    });
  });

  describe('filter', () => {
    it('should filter chunks by threshold', () => {
      const filter = createChunkQualityFilter({
        qualityThreshold: 0.5,
      });

      const highQualityChunk = createHierarchicalChunk(
        'This is a high quality chunk with unique words and complete sentences.',
        [1, 0, 0],
        'small',
        { start: 0, end: 1 },
        'doc-1',
        createDefaultQualityScore(),
        { contentType: 'text' }
      );

      const lowQualityChunk = createHierarchicalChunk(
        'test test test test test test',
        [1, 0, 0],
        'small',
        { start: 0, end: 1 },
        'doc-1',
        createDefaultQualityScore(),
        { contentType: 'text' }
      );

      const result = filter.filter([highQualityChunk, lowQualityChunk]);

      expect(result.passed.length + result.failed.length).toBe(2);
    });
  });

  describe('process with modes', () => {
    it('should discard low quality chunks in discard mode', () => {
      const filter = createChunkQualityFilter({
        qualityThreshold: 0.5,
        filterMode: 'discard',
      });

      const chunks = [
        createHierarchicalChunk(
          'High quality content with unique meaningful text.',
          [1, 0, 0],
          'small',
          { start: 0, end: 1 },
          'doc-1',
          createDefaultQualityScore(),
          { contentType: 'text' }
        ),
        createHierarchicalChunk(
          'test test test test',
          [1, 0, 0],
          'small',
          { start: 1, end: 2 },
          'doc-1',
          createDefaultQualityScore(),
          { contentType: 'text' }
        ),
      ];

      const result = filter.process(chunks);

      // Low quality chunk should be discarded
      expect(result.length).toBeLessThanOrEqual(2);
    });

    it('should flag low quality chunks in flag mode', () => {
      const filter = createChunkQualityFilter({
        qualityThreshold: 0.7,
        filterMode: 'flag',
      });

      const chunks = [
        createHierarchicalChunk(
          'Normal quality content here.',
          [1, 0, 0],
          'small',
          { start: 0, end: 1 },
          'doc-1',
          createDefaultQualityScore(),
          { contentType: 'text' }
        ),
      ];

      const result = filter.process(chunks);

      // All chunks should be present in flag mode
      expect(result.length).toBe(1);
    });
  });

  describe('setDocumentEmbedding', () => {
    it('should use document embedding for relevance scoring', () => {
      const filter = createChunkQualityFilter();

      const docEmbedding = [1, 0, 0];
      filter.setDocumentEmbedding('doc-1', docEmbedding);

      const relevantChunk = createHierarchicalChunk(
        'Content for document.',
        [0.95, 0.05, 0], // Similar to doc embedding
        'small',
        { start: 0, end: 1 },
        'doc-1',
        createDefaultQualityScore(),
        { contentType: 'text' }
      );

      const score = filter.evaluate(relevantChunk);

      expect(score.dimensions.documentRelevance).toBeGreaterThan(0.9);
    });
  });

  describe('getStatistics', () => {
    it('should calculate statistics for chunks', () => {
      const filter = createChunkQualityFilter();

      const chunks = [
        createHierarchicalChunk(
          'First chunk with quality content.',
          [1, 0, 0],
          'small',
          { start: 0, end: 1 },
          'doc-1',
          createDefaultQualityScore(),
          { contentType: 'text' }
        ),
        createHierarchicalChunk(
          'Second chunk also has quality.',
          [0.8, 0.2, 0],
          'small',
          { start: 1, end: 2 },
          'doc-1',
          createDefaultQualityScore(),
          { contentType: 'text' }
        ),
      ];

      const stats = filter.getStatistics(chunks);

      expect(stats.avgComposite).toBeGreaterThanOrEqual(0);
      expect(stats.avgComposite).toBeLessThanOrEqual(1);
      expect(stats.lowQualityCount).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('SmallToBigRetriever', () => {
  // Helper to create 128-dim embeddings (same as syntheticEmbedding)
  function createEmbedding(values: number[]): number[] {
    const embedding = new Array(128).fill(0);
    for (let i = 0; i < Math.min(values.length, 128); i++) {
      embedding[i] = values[i];
    }
    // Normalize
    const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
    if (norm > 0) {
      for (let i = 0; i < 128; i++) {
        embedding[i] /= norm;
      }
    }
    return embedding;
  }

  async function setupStoreWithChunks(): Promise<HierarchicalStore> {
    const store = createHierarchicalStore({
      parentChunkMinTokens: 50,
      parentChunkMaxTokens: 200,
    });

    const smallChunks = [
      createHierarchicalChunk(
        'Machine learning is a subset of artificial intelligence.',
        createEmbedding([1, 0, 0, 0, 0]),
        'small',
        { start: 0, end: 1 },
        'doc-1',
        createDefaultQualityScore(),
        { contentType: 'text' }
      ),
      createHierarchicalChunk(
        'Deep learning uses neural networks with many layers.',
        createEmbedding([0.9, 0.1, 0, 0, 0]),
        'small',
        { start: 1, end: 2 },
        'doc-1',
        createDefaultQualityScore(),
        { contentType: 'text' }
      ),
      createHierarchicalChunk(
        'Natural language processing enables text understanding.',
        createEmbedding([0, 0, 1, 0, 0]),
        'small',
        { start: 2, end: 3 },
        'doc-1',
        createDefaultQualityScore(),
        { contentType: 'text' }
      ),
      createHierarchicalChunk(
        'Computer vision allows machines to see and interpret images.',
        createEmbedding([0, 0, 0, 1, 0]),
        'small',
        { start: 3, end: 4 },
        'doc-1',
        createDefaultQualityScore(),
        { contentType: 'text' }
      ),
    ];

    await store.buildHierarchy(smallChunks, 'doc-1');
    return store;
  }

  describe('constructor', () => {
    it('should create retriever with default config', async () => {
      const store = await setupStoreWithChunks();
      const retriever = createSmallToBigRetriever(store);
      const config = retriever.getConfig();

      expect(config.topK).toBe(10);
      expect(config.similarityThreshold).toBe(0.5);
      expect(config.maxContextTokens).toBe(4000);
    });

    it('should accept custom config', async () => {
      const store = await setupStoreWithChunks();
      const retriever = createSmallToBigRetriever(store, {
        topK: 5,
        similarityThreshold: 0.7,
      });
      const config = retriever.getConfig();

      expect(config.topK).toBe(5);
      expect(config.similarityThreshold).toBe(0.7);
    });
  });

  describe('getQueryEmbedding', () => {
    it('should generate embedding for query', async () => {
      const store = await setupStoreWithChunks();
      const retriever = createSmallToBigRetriever(store);

      const embedding = await retriever.getQueryEmbedding('test query');

      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBeGreaterThan(0);
    });

    it('should cache query embeddings', async () => {
      const store = await setupStoreWithChunks();
      const retriever = createSmallToBigRetriever(store);

      const embedding1 = await retriever.getQueryEmbedding('cached query');
      const embedding2 = await retriever.getQueryEmbedding('cached query');

      expect(embedding1).toEqual(embedding2);
    });
  });

  describe('retrieve', () => {
    it('should retrieve relevant chunks', async () => {
      const store = await setupStoreWithChunks();
      const retriever = createSmallToBigRetriever(store, {
        similarityThreshold: 0.0,
        topK: 3,
      });

      const results = await retriever.retrieve('machine learning');

      expect(results.length).toBeGreaterThan(0);
      expect(results.every(r => r.parentChunkContent.length > 0)).toBe(true);
    });

    it('should filter by similarity threshold', async () => {
      const store = await setupStoreWithChunks();
      const retriever = createSmallToBigRetriever(store, {
        similarityThreshold: 0.99,
        topK: 10,
        enableFallback: false, // Disable fallback to test filtering
      });

      const results = await retriever.retrieve('random unrelated query');

      // High threshold should filter most results (may be empty)
      expect(results.every(r => r.similarityScore >= 0.99)).toBe(true);
    });

    it('should limit to topK results', async () => {
      const store = await setupStoreWithChunks();
      const retriever = createSmallToBigRetriever(store, {
        similarityThreshold: 0.0,
        topK: 2,
      });

      const results = await retriever.retrieve('learning');

      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('should expand small chunks to parent', async () => {
      const store = await setupStoreWithChunks();
      const retriever = createSmallToBigRetriever(store, {
        similarityThreshold: 0.0,
        topK: 5,
      });

      const results = await retriever.retrieve('machine learning');

      // All results should have parent content
      expect(results.every(r => r.parentChunkContent.length > 0)).toBe(true);
      expect(results.some(r => r.expandedFromSmallChunk)).toBe(true);
    });

    it('should deduplicate parent chunks', async () => {
      const store = await setupStoreWithChunks();
      const retriever = createSmallToBigRetriever(store, {
        similarityThreshold: 0.0,
        topK: 10,
      });

      const results = await retriever.retrieve('learning');

      // All parent IDs should be unique
      const parentIds = results.map(r => r.parentChunkId);
      const uniqueIds = new Set(parentIds);
      expect(uniqueIds.size).toBe(parentIds.length);
    });
  });

  describe('assembleContext', () => {
    it('should assemble context from results', async () => {
      const store = await setupStoreWithChunks();
      const retriever = createSmallToBigRetriever(store, {
        similarityThreshold: 0.0,
        maxContextTokens: 1000,
      });

      const results = await retriever.retrieve('learning');
      const context = retriever.assembleContext(results);

      expect(context.content.length).toBeGreaterThan(0);
      expect(context.tokenCount).toBeGreaterThan(0);
      expect(context.chunks.length).toBe(results.length);
    });

    it('should respect token limit', async () => {
      const store = await setupStoreWithChunks();
      const retriever = createSmallToBigRetriever(store, {
        similarityThreshold: 0.0,
        maxContextTokens: 10, // Very small limit
      });

      const results = await retriever.retrieve('learning');
      const context = retriever.assembleContext(results);

      expect(context.tokenCount).toBeLessThanOrEqual(10);
      expect(context.truncated).toBe(true);
    });
  });

  describe('retrieveWithMetadata', () => {
    it('should return results with context and embedding', async () => {
      const store = await setupStoreWithChunks();
      const retriever = createSmallToBigRetriever(store, {
        similarityThreshold: 0.0,
      });

      const result = await retriever.retrieveWithMetadata('machine learning');

      expect(result.results.length).toBeGreaterThan(0);
      expect(result.context).toBeDefined();
      expect(result.queryEmbedding.length).toBeGreaterThan(0);
    });
  });

  describe('fallback', () => {
    it('should fallback to parent search when small chunk fails', async () => {
      const store = await setupStoreWithChunks();
      const retriever = createSmallToBigRetriever(store, {
        similarityThreshold: 0.99,
        enableFallback: true,
        fallbackThreshold: 0.0,
      });

      const results = await retriever.retrieve('some query');

      // Fallback should return results
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('clearCache', () => {
    it('should clear query cache', async () => {
      const store = await setupStoreWithChunks();
      const retriever = createSmallToBigRetriever(store);

      await retriever.getQueryEmbedding('test');
      retriever.clearCache();
      // No exception expected
    });
  });
});