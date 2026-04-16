/**
 * Enhanced Context Assembler
 *
 * Assembles context with confidence metadata and dynamic truncation.
 */

import type {
  ConfidenceRetrievalResult,
  ContextWithConfidence,
  EnhancedAssembledContext,
} from './types.js';
import { determineConfidenceLevel, CONFIDENCE_THRESHOLDS } from './types.js';
import type { TopKResult, EnhancedRetrievalConfig } from './config.js';
import { DEFAULT_ENHANCED_RETRIEVAL_CONFIG } from './config.js';

/**
 * Token estimation utility
 */
function estimateTokens(text: string): number {
  // Approximate: 4 characters per token for mixed text
  return Math.ceil(text.length / 4);
}

/**
 * Enhanced Context Assembler class
 */
export class EnhancedContextAssembler {
  private config: EnhancedRetrievalConfig;

  constructor(config?: Partial<EnhancedRetrievalConfig>) {
    this.config = { ...DEFAULT_ENHANCED_RETRIEVAL_CONFIG, ...config };
  }

  /**
   * Assemble context from confidence-ranked results
   */
  assemble(
    results: ConfidenceRetrievalResult[],
    topKConfig: TopKResult
  ): EnhancedAssembledContext {
    console.log('[EnhancedContextAssembler] Assembling context:', {
      resultCount: results.length,
      targetTokens: topKConfig.targetTokens,
    });

    const chunks: ContextWithConfidence[] = [];
    let totalTokens = 0;
    let truncated = false;

    for (const result of results) {
      const content = result.parentChunkContent || result.smallChunkContent;
      const tokens = estimateTokens(content);

      // Check if adding this chunk would exceed target
      if (totalTokens + tokens > topKConfig.targetTokens) {
        truncated = true;
        break;
      }

      // Create context chunk with confidence metadata
      const chunk: ContextWithConfidence = {
        content,
        confidence: result.confidenceScore,
        confidenceLevel: result.confidenceLevel,
        source: result.sourceDocumentId,
        page: result.metadata?.pageNumber,
        section: result.metadata?.section,
      };

      chunks.push(chunk);
      totalTokens += tokens;
    }

    // Calculate average confidence
    const avgConfidence = chunks.length > 0
      ? chunks.reduce((sum, c) => sum + c.confidence, 0) / chunks.length
      : 0;

    console.log('[EnhancedContextAssembler] Assembled:', {
      chunkCount: chunks.length,
      totalTokens,
      avgConfidence,
      truncated,
    });

    return {
      chunks,
      totalTokens,
      truncated,
      avgConfidence,
    };
  }

  /**
   * Assemble with custom token limit
   */
  assembleWithLimit(
    results: ConfidenceRetrievalResult[],
    maxTokens: number
  ): EnhancedAssembledContext {
    const topKConfig: TopKResult = {
      coarseTopK: results.length,
      targetTokens: maxTokens,
      effectiveWindow: maxTokens,
    };

    return this.assemble(results, topKConfig);
  }

  /**
   * Get confidence level for a score
   */
  getConfidenceLevel(score: number): 'high' | 'medium' | 'low' {
    return determineConfidenceLevel(score);
  }

  /**
   * Filter chunks by minimum confidence
   */
  filterByConfidence(
    chunks: ContextWithConfidence[],
    minConfidence: number
  ): ContextWithConfidence[] {
    return chunks.filter(c => c.confidence >= minConfidence);
  }

  /**
   * Get chunks by confidence level
   */
  getChunksByLevel(
    chunks: ContextWithConfidence[],
    level: 'high' | 'medium' | 'low'
  ): ContextWithConfidence[] {
    return chunks.filter(c => c.confidenceLevel === level);
  }

  /**
   * Create context string for LLM prompt
   */
  createContextString(chunks: ContextWithConfidence[]): string {
    const sections = chunks.map((chunk, index) => {
      const levelLabel = this.getConfidenceLabel(chunk.confidenceLevel);
      const sourceInfo = chunk.page
        ? `[来源: ${chunk.source}, 第${chunk.page}页]`
        : `[来源: ${chunk.source}]`;

      return `[${levelLabel}] ${sourceInfo}\n${chunk.content}`;
    });

    return sections.join('\n\n---\n\n');
  }

  /**
   * Get human-readable confidence label
   */
  private getConfidenceLabel(level: 'high' | 'medium' | 'low'): string {
    switch (level) {
      case 'high': return '高置信度';
      case 'medium': return '中置信度';
      case 'low': return '低置信度';
    }
  }

  /**
   * Get statistics for assembled context
   */
  getStatistics(context: EnhancedAssembledContext): {
    chunkCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    avgConfidence: number;
    totalTokens: number;
    utilizationPercent: number;
    truncated: boolean;
  } {
    const highCount = context.chunks.filter(c => c.confidenceLevel === 'high').length;
    const mediumCount = context.chunks.filter(c => c.confidenceLevel === 'medium').length;
    const lowCount = context.chunks.filter(c => c.confidenceLevel === 'low').length;

    // Calculate utilization based on config
    const targetTokens = this.config.modelContextWindow *
      this.config.fillRatio -
      this.config.systemPromptTokens -
      this.config.outputReservation;

    const utilizationPercent = Math.min(100,
      (context.totalTokens / Math.max(1, targetTokens)) * 100
    );

    return {
      chunkCount: context.chunks.length,
      highCount,
      mediumCount,
      lowCount,
      avgConfidence: context.avgConfidence,
      totalTokens: context.totalTokens,
      utilizationPercent,
      truncated: context.truncated,
    };
  }

  /**
   * Validate context for LLM generation
   */
  validateContext(context: EnhancedAssembledContext): {
    valid: boolean;
    warnings: string[];
  } {
    const warnings: string[] = [];

    if (context.chunks.length === 0) {
      warnings.push('No chunks in context');
    }

    if (context.avgConfidence < CONFIDENCE_THRESHOLDS.low) {
      warnings.push('Average confidence below threshold');
    }

    const lowCount = context.chunks.filter(c => c.confidenceLevel === 'low').length;
    if (lowCount > context.chunks.length * 0.5) {
      warnings.push('More than 50% chunks are low confidence');
    }

    return {
      valid: warnings.length === 0,
      warnings,
    };
  }

  /**
   * Get configuration
   */
  getConfig(): EnhancedRetrievalConfig {
    return { ...this.config };
  }
}

/**
 * Create enhanced context assembler instance
 */
export function createEnhancedContextAssembler(
  config?: Partial<EnhancedRetrievalConfig>
): EnhancedContextAssembler {
  return new EnhancedContextAssembler(config);
}