import type {
  SemanticCliff,
} from './types.js';
import type { CliffDetectionConfig } from './config.js';
import {
  adjacentSimilarity,
} from './utils.js';

/**
 * Cliff detection result
 */
export interface CliffDetectionResult {
  cliffs: SemanticCliff[];
  similaritySequence: number[];
  embeddingSequence: number[][];
}

/**
 * CliffDetector - detects semantic cliffs via similarity analysis
 *
 * Algorithm:
 * 1. Calculate adjacent embedding cosine similarities
 * 2. Identify cliff candidates where similarity < threshold
 * 3. Validate with gradient check (|si - si-1| > gradientThreshold)
 * 4. Filter noise by requiring minimum cliff width
 * 5. Compute confidence score based on gradient and width
 */
export class CliffDetector {
  private config: CliffDetectionConfig;

  constructor(config?: Partial<CliffDetectionConfig>) {
    this.config = {
      similarityThreshold: config?.similarityThreshold ?? 0.7,
      gradientThreshold: config?.gradientThreshold ?? 0.15,
      minCliffWidth: config?.minCliffWidth ?? 2,
      highConfidenceThreshold: config?.highConfidenceThreshold ?? 0.8,
    };

    this.validateConfig();
  }

  /**
   * Validate configuration parameters
   */
  private validateConfig(): void {
    if (this.config.similarityThreshold < 0 || this.config.similarityThreshold > 1) {
      throw new Error('similarityThreshold must be in range [0, 1]');
    }
    if (this.config.gradientThreshold < 0 || this.config.gradientThreshold > 1) {
      throw new Error('gradientThreshold must be in range [0, 1]');
    }
    if (this.config.minCliffWidth < 1) {
      throw new Error('minCliffWidth must be >= 1');
    }
  }

  /**
   * Detect semantic cliffs from embedding sequence
   */
  detect(embeddings: number[][]): CliffDetectionResult {
    // Calculate similarity sequence between adjacent embeddings
    const similaritySequence = adjacentSimilarity(embeddings);

    // Identify cliff candidates
    const candidates = this.identifyCandidates(similaritySequence);

    // Validate with gradient
    const validatedCliffs = this.validateWithGradient(candidates, similaritySequence);

    // Filter noise
    const filteredCliffs = this.filterNoise(validatedCliffs);

    // Select final boundaries
    const finalCliffs = this.selectBoundaries(filteredCliffs);

    // Add confidence scores
    const cliffs = this.computeConfidence(finalCliffs, similaritySequence);

    return {
      cliffs,
      similaritySequence,
      embeddingSequence: embeddings,
    };
  }

  /**
   * Task 2.2: Identify cliff candidates where similarity < threshold
   */
  private identifyCandidates(similarities: number[]): CliffCandidate[] {
    const candidates: CliffCandidate[] = [];

    for (let i = 0; i < similarities.length; i++) {
      const sim = similarities[i];
      if (sim !== undefined && sim < this.config.similarityThreshold) {
        candidates.push({
          position: i,
          similarity: sim,
          gradient: 0, // will be computed later
          width: 1,
        });
      }
    }

    return candidates;
  }

  /**
   * Task 2.3: Validate cliffs with gradient check
   */
  private validateWithGradient(
    candidates: CliffCandidate[],
    similarities: number[]
  ): CliffCandidate[] {
    const validated: CliffCandidate[] = [];

    for (const candidate of candidates) {
      // Calculate gradient from previous similarity
      const prevSimilarity = candidate.position > 0
        ? (similarities[candidate.position - 1] ?? 1)
        : 1; // assume full similarity at start

      const gradient = Math.abs(candidate.similarity - prevSimilarity);

      if (gradient > this.config.gradientThreshold) {
        validated.push({
          ...candidate,
          gradient,
        });
      }
    }

    return validated;
  }

  /**
   * Task 2.4: Filter noise by requiring minimum cliff width
   */
  private filterNoise(cliffs: CliffCandidate[]): CliffCandidate[] {
    // Group adjacent cliff candidates
    const groups: CliffCandidate[][] = [];
    let currentGroup: CliffCandidate[] = [];

    for (const cliff of cliffs) {
      if (currentGroup.length === 0) {
        currentGroup.push(cliff);
      } else {
        // Check if adjacent to previous candidate
        const lastInGroup = currentGroup[currentGroup.length - 1];
        const prevPosition = lastInGroup?.position ?? -999;
        if (cliff.position === prevPosition + 1) {
          currentGroup.push(cliff);
        } else {
          // New group
          groups.push(currentGroup);
          currentGroup = [cliff];
        }
      }
    }

    // Don't forget the last group
    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }

    // Filter groups by minimum width
    const filtered: CliffCandidate[] = [];
    for (const group of groups) {
      if (group.length >= this.config.minCliffWidth) {
        // Take the cliff with highest gradient from the group
        const bestCliff = group.reduce((best, current) =>
          current.gradient > best.gradient ? current : best
        );
        filtered.push({
          ...bestCliff,
          width: group.length,
        });
      }
    }

    return filtered;
  }

  /**
   * Task 2.5: Select final boundaries from confirmed candidates
   */
  private selectBoundaries(cliffs: CliffCandidate[]): CliffCandidate[] {
    // If multiple cliffs are close, select the one with largest gradient
    const minDistance = 3; // minimum positions between cliffs

    const selected: CliffCandidate[] = [];

    for (const cliff of cliffs) {
      // Check distance from last selected cliff
      if (selected.length === 0) {
        selected.push(cliff);
      } else {
        const lastSelected = selected[selected.length - 1];
        const lastPosition = lastSelected?.position ?? -999;
        if (cliff.position - lastPosition >= minDistance) {
          selected.push(cliff);
        } else {
          // Replace if this cliff has higher gradient
          if (lastSelected && cliff.gradient > lastSelected.gradient) {
            selected[selected.length - 1] = cliff;
          }
        }
      }
    }

    return selected;
  }

  /**
   * Task 2.6: Compute confidence score for each cliff
   */
  private computeConfidence(
    cliffs: CliffCandidate[],
    _similarities: number[]
  ): SemanticCliff[] {
    return cliffs.map(cliff => {
      // Confidence based on gradient magnitude and width
      // Higher gradient and wider cliff = higher confidence

      // Normalize gradient (max possible is 1, threshold is min)
      const normalizedGradient = (cliff.gradient - this.config.gradientThreshold) /
        (1 - this.config.gradientThreshold);

      // Normalize width (max reasonable is 5)
      const normalizedWidth = Math.min(cliff.width / 5, 1);

      // Combine with equal weight
      const confidence = (normalizedGradient * 0.6 + normalizedWidth * 0.4);

      return {
        position: cliff.position,
        similarity: cliff.similarity,
        gradient: cliff.gradient,
        width: cliff.width,
        confidence: Math.max(0, Math.min(1, confidence)),
      };
    });
  }

  /**
   * Get cliffs marked as high confidence
   */
  getHighConfidenceCliffs(result: CliffDetectionResult): SemanticCliff[] {
    return result.cliffs.filter(
      cliff => cliff.confidence >= this.config.highConfidenceThreshold
    );
  }

  /**
   * Get configuration
   */
  getConfig(): CliffDetectionConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<CliffDetectionConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
    this.validateConfig();
  }
}

/**
 * Internal cliff candidate structure
 */
interface CliffCandidate {
  position: number;
  similarity: number;
  gradient: number;
  width: number;
}

/**
 * Create cliff detector with default config
 */
export function createCliffDetector(
  config?: Partial<CliffDetectionConfig>
): CliffDetector {
  return new CliffDetector(config);
}