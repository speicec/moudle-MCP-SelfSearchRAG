import type {
  HierarchicalChunk,
  QualityScore,
  QualityDimensions,
  QualityFilterMode,
} from './types.js';
import type { QualityFilterConfig } from './config.js';
import { DEFAULT_QUALITY_FILTER_CONFIG } from './config.js';
import {
  countUniqueTokens,
  calculateRepetitionRatio,
  isCompleteSentence,
  cosineSimilarity,
  estimateTokenCount,
  splitIntoParagraphs,
} from './utils.js';

/**
 * ChunkQualityFilter - evaluates and filters chunks based on quality metrics
 *
 * Quality dimensions:
 * - Information density: unique tokens / total tokens
 * - Repetition ratio: duplicate content ratio (lower is better)
 * - Semantic completeness: sentence/paragraph structure score
 * - Document relevance: similarity to document theme
 */
export class ChunkQualityFilter {
  private config: QualityFilterConfig;
  private documentEmbeddings: Map<string, number[]> = new Map();

  constructor(config?: Partial<QualityFilterConfig>) {
    this.config = { ...DEFAULT_QUALITY_FILTER_CONFIG, ...config };
  }

  /**
   * 5.5: Evaluate quality score for a chunk
   */
  evaluate(chunk: HierarchicalChunk): QualityScore {
    const dimensions: QualityDimensions = {
      // 5.1: Information density
      informationDensity: this.calculateInformationDensity(chunk.content),

      // 5.2: Repetition ratio (inverse - lower is better)
      repetitionRatio: 1 - calculateRepetitionRatio(chunk.content),

      // 5.3: Semantic completeness
      semanticCompleteness: this.calculateSemanticCompleteness(chunk.content),

      // 5.4: Document relevance
      documentRelevance: this.calculateDocumentRelevance(chunk),
    };

    // Calculate composite score
    const composite = this.calculateCompositeScore(dimensions);

    return {
      composite,
      dimensions,
      evaluatedAt: new Date(),
    };
  }

  /**
   * 5.1: Calculate information density (unique token ratio)
   */
  private calculateInformationDensity(content: string): number {
    const tokens = content.toLowerCase().split(/\s+/).filter(t => t.length > 0);
    if (tokens.length === 0) {
      return 0;
    }

    const uniqueCount = countUniqueTokens(content);
    return uniqueCount / tokens.length;
  }

  /**
   * 5.3: Calculate semantic completeness based on structure
   */
  private calculateSemanticCompleteness(content: string): number {
    let score = 0;

    // Check for complete sentences
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const completeSentenceRatio = sentences.length > 0
      ? sentences.filter(s => isCompleteSentence(s.trim() + '.')).length / sentences.length
      : 0;

    score += completeSentenceRatio * 0.5;

    // Check for paragraph structure
    const paragraphs = splitIntoParagraphs(content);
    const avgParagraphLength = paragraphs.length > 0
      ? content.length / paragraphs.length
      : 0;

    // Reasonable paragraph length (100-500 chars) scores higher
    const paragraphScore = avgParagraphLength >= 100 && avgParagraphLength <= 500
      ? 1
      : Math.max(0, 1 - Math.abs(avgParagraphLength - 300) / 500);

    score += paragraphScore * 0.3;

    // Check for proper ending (complete thought)
    const endsWithPunctuation = /[.!?]$/.test(content.trim());
    score += endsWithPunctuation ? 0.2 : 0;

    return Math.min(1, score);
  }

  /**
   * 5.4: Calculate document relevance (similarity to document theme)
   */
  private calculateDocumentRelevance(chunk: HierarchicalChunk): number {
    const docEmbedding = this.documentEmbeddings.get(chunk.sourceDocumentId);

    if (!docEmbedding || chunk.embedding.length === 0) {
      return 0.5; // Default neutral score
    }

    return cosineSimilarity(chunk.embedding, docEmbedding);
  }

  /**
   * 5.5: Calculate composite score from dimensions
   */
  private calculateCompositeScore(dimensions: QualityDimensions): number {
    const weights = this.config.dimensionWeights;

    return (
      dimensions.informationDensity * weights.informationDensity +
      dimensions.repetitionRatio * weights.repetitionRatio +
      dimensions.semanticCompleteness * weights.semanticCompleteness +
      dimensions.documentRelevance * weights.documentRelevance
    );
  }

  /**
   * 5.6: Filter chunks based on quality threshold
   */
  filter(chunks: HierarchicalChunk[]): {
    passed: HierarchicalChunk[];
    failed: HierarchicalChunk[];
  } {
    const passed: HierarchicalChunk[] = [];
    const failed: HierarchicalChunk[] = [];

    for (const chunk of chunks) {
      const qualityScore = this.evaluate(chunk);

      if (qualityScore.composite >= this.config.qualityThreshold) {
        chunk.qualityScore = qualityScore;
        passed.push(chunk);
      } else {
        chunk.qualityScore = qualityScore;
        failed.push(chunk);
      }
    }

    return { passed, failed };
  }

  /**
   * 5.7: Process chunks with filter mode
   */
  process(chunks: HierarchicalChunk[]): HierarchicalChunk[] {
    const { passed, failed } = this.filter(chunks);

    switch (this.config.filterMode) {
      case 'discard':
        return passed;

      case 'merge':
        return this.mergeFailedChunks(passed, failed);

      case 'flag':
      default:
        // Mark failed chunks with low quality flag
        for (const chunk of failed) {
          chunk.metadata.boundaryConfidence = 0; // Low confidence flag
        }
        return [...passed, ...failed];
    }
  }

  /**
   * 5.7: Merge failed chunks with nearest passing neighbor
   */
  private mergeFailedChunks(
    passed: HierarchicalChunk[],
    failed: HierarchicalChunk[]
  ): HierarchicalChunk[] {
    if (failed.length === 0) {
      return passed;
    }

    const result: HierarchicalChunk[] = [...passed];

    for (const failedChunk of failed) {
      // Find nearest passing chunk by position
      const nearest = this.findNearestChunk(failedChunk, result);

      if (nearest) {
        // Merge content
        nearest.content += '\n\n' + failedChunk.content;

        // Update position
        nearest.position.end = Math.max(
          nearest.position.end,
          failedChunk.position.end
        );

        // Update childIds if this is a parent
        if (nearest.level === 'parent' && nearest.childIds && failedChunk.childIds) {
          nearest.childIds.push(...failedChunk.childIds);
        }
      } else {
        // No neighbor to merge with, keep as flagged
        failedChunk.metadata.boundaryConfidence = 0;
        result.push(failedChunk);
      }
    }

    return result;
  }

  /**
   * Find nearest chunk by position
   */
  private findNearestChunk(
    target: HierarchicalChunk,
    candidates: HierarchicalChunk[]
  ): HierarchicalChunk | undefined {
    const sameDoc = candidates.filter(
      c => c.sourceDocumentId === target.sourceDocumentId
    );

    if (sameDoc.length === 0) {
      return undefined;
    }

    // Find closest by position
    return sameDoc.reduce((nearest, candidate) => {
      const targetDist = Math.abs(candidate.position.start - target.position.start);
      const nearestDist = Math.abs(nearest.position.start - target.position.start);
      return targetDist < nearestDist ? candidate : nearest;
    });
  }

  /**
   * Set document embedding for relevance calculation
   */
  setDocumentEmbedding(documentId: string, embedding: number[]): void {
    this.documentEmbeddings.set(documentId, embedding);
  }

  /**
   * Get configuration
   */
  getConfig(): QualityFilterConfig {
    return { ...this.config };
  }

  /**
   * Set configuration
   */
  setConfig(config: Partial<QualityFilterConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get quality statistics for chunks
   */
  getStatistics(chunks: HierarchicalChunk[]): {
    avgComposite: number;
    avgDimensions: QualityDimensions;
    lowQualityCount: number;
  } {
    if (chunks.length === 0) {
      return {
        avgComposite: 0,
        avgDimensions: {
          informationDensity: 0,
          repetitionRatio: 0,
          semanticCompleteness: 0,
          documentRelevance: 0,
        },
        lowQualityCount: 0,
      };
    }

    let sumComposite = 0;
    let sumInfoDensity = 0;
    let sumRepRatio = 0;
    let sumSemantic = 0;
    let sumRelevance = 0;
    let lowCount = 0;

    for (const chunk of chunks) {
      const score = this.evaluate(chunk);
      sumComposite += score.composite;
      sumInfoDensity += score.dimensions.informationDensity;
      sumRepRatio += score.dimensions.repetitionRatio;
      sumSemantic += score.dimensions.semanticCompleteness;
      sumRelevance += score.dimensions.documentRelevance;

      if (score.composite < this.config.qualityThreshold) {
        lowCount++;
      }
    }

    return {
      avgComposite: sumComposite / chunks.length,
      avgDimensions: {
        informationDensity: sumInfoDensity / chunks.length,
        repetitionRatio: sumRepRatio / chunks.length,
        semanticCompleteness: sumSemantic / chunks.length,
        documentRelevance: sumRelevance / chunks.length,
      },
      lowQualityCount: lowCount,
    };
  }
}

/**
 * Create chunk quality filter
 */
export function createChunkQualityFilter(
  config?: Partial<QualityFilterConfig>
): ChunkQualityFilter {
  return new ChunkQualityFilter(config);
}