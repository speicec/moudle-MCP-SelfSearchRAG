/**
 * Dynamic TopK Calculator
 *
 * Calculates dynamic topK based on model context window and parent chunk size.
 */

import type { ModelContextWindow, TopKResult, EnhancedRetrievalConfig } from './config.js';
import {
  DEFAULT_ENHANCED_RETRIEVAL_CONFIG,
  CONTEXT_WINDOW_PRESETS,
} from './config.js';

/**
 * TopK calculation formula:
 *
 * effectiveWindow = modelContextWindow - systemPromptTokens - outputReservation
 * targetTokens = effectiveWindow × fillRatio
 * coarseTopK = ceil(targetTokens × overfetchRatio / avgParentTokens)
 */

/**
 * Dynamic TopK Calculator class
 */
export class DynamicTopKCalculator {
  private config: EnhancedRetrievalConfig;

  constructor(config?: Partial<EnhancedRetrievalConfig>) {
    this.config = { ...DEFAULT_ENHANCED_RETRIEVAL_CONFIG, ...config };
  }

  /**
   * Calculate dynamic topK based on average parent token length
   */
  calculate(avgParentTokens: number): TopKResult {
    const {
      modelContextWindow,
      systemPromptTokens,
      outputReservation,
      fillRatio,
      overfetchRatio,
    } = this.config;

    // Calculate effective window
    const effectiveWindow = modelContextWindow - systemPromptTokens - outputReservation;

    // Calculate target tokens to fill
    const targetTokens = Math.floor(effectiveWindow * fillRatio);

    // Calculate coarse topK with overfetch
    // If avgParentTokens is 0 or very small, use a safe default
    const safeAvgTokens = avgParentTokens > 0 ? avgParentTokens : 800;
    const coarseTopK = Math.ceil((targetTokens * overfetchRatio) / safeAvgTokens);

    // Ensure reasonable bounds
    const boundedTopK = Math.max(5, Math.min(200, coarseTopK));

    console.log('[DynamicTopKCalculator] Calculation:', {
      modelContextWindow,
      effectiveWindow,
      targetTokens,
      avgParentTokens: safeAvgTokens,
      coarseTopK: boundedTopK,
    });

    return {
      coarseTopK: boundedTopK,
      targetTokens,
      effectiveWindow,
    };
  }

  /**
   * Calculate for specific preset (light/standard/extended)
   */
  calculateForPreset(
    preset: 'light' | 'standard' | 'extended',
    avgParentTokens: number
  ): TopKResult {
    const presetConfig = CONTEXT_WINDOW_PRESETS[preset];
    const mergedConfig = {
      ...this.config,
      ...presetConfig,
    };

    const calculator = new DynamicTopKCalculator(mergedConfig);
    return calculator.calculate(avgParentTokens);
  }

  /**
   * Calculate for specific context window size
   */
  calculateForWindow(
    modelContextWindow: ModelContextWindow,
    avgParentTokens: number
  ): TopKResult {
    const mergedConfig = {
      ...this.config,
      modelContextWindow,
    };

    const calculator = new DynamicTopKCalculator(mergedConfig);
    return calculator.calculate(avgParentTokens);
  }

  /**
   * Get target tokens for current configuration
   */
  getTargetTokens(): number {
    const { modelContextWindow, systemPromptTokens, outputReservation, fillRatio } = this.config;
    const effectiveWindow = modelContextWindow - systemPromptTokens - outputReservation;
    return Math.floor(effectiveWindow * fillRatio);
  }

  /**
   * Get effective window size
   */
  getEffectiveWindow(): number {
    const { modelContextWindow, systemPromptTokens, outputReservation } = this.config;
    return modelContextWindow - systemPromptTokens - outputReservation;
  }

  /**
   * Calculate context utilization percentage
   */
  getContextUtilization(actualTokens: number): number {
    const targetTokens = this.getTargetTokens();
    if (targetTokens === 0) return 0;
    return Math.min(100, (actualTokens / targetTokens) * 100);
  }

  /**
   * Validate if a topK value is reasonable
   */
  validateTopK(topK: number, avgParentTokens: number): {
    valid: boolean;
    reason: string;
    recommendation?: number;
  } {
    const result = this.calculate(avgParentTokens);
    const recommended = result.coarseTopK;

    // Check if topK is within reasonable range
    if (topK < 5) {
      return {
        valid: false,
        reason: 'topK too small (min 5)',
        recommendation: 5,
      };
    }

    if (topK > 200) {
      return {
        valid: false,
        reason: 'topK too large (max 200)',
        recommendation: 200,
      };
    }

    // Check deviation from recommended
    const deviation = Math.abs(topK - recommended) / recommended;
    if (deviation > 0.5) {
      return {
        valid: true,
        reason: `topK deviates ${Math.round(deviation * 100)}% from recommended`,
        recommendation: recommended,
      };
    }

    return {
      valid: true,
      reason: 'topK within acceptable range',
      recommendation: recommended,
    };
  }

  /**
   * Get all preset calculations
   */
  getAllPresets(avgParentTokens: number): Record<string, TopKResult> {
    return {
      light: this.calculateForPreset('light', avgParentTokens),
      standard: this.calculateForPreset('standard', avgParentTokens),
      extended: this.calculateForPreset('extended', avgParentTokens),
    };
  }

  /**
   * Estimate retrieval latency impact
   * Rough estimate: more chunks = more processing time
   */
  estimateLatencyImpact(topK: number): {
    estimatedMs: number;
    factor: string;
  } {
    // Linear approximation: base time + chunk processing
    const baseMs = 100; // Base retrieval time
    const perChunkMs = 20; // Per chunk processing time

    const estimatedMs = baseMs + topK * perChunkMs;

    const factor = estimatedMs < 500 ? 'fast' :
                   estimatedMs < 1000 ? 'moderate' :
                   estimatedMs < 2000 ? 'slow' : 'very_slow';

    return { estimatedMs, factor };
  }

  /**
   * Get configuration
   */
  getConfig(): EnhancedRetrievalConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<EnhancedRetrievalConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

/**
 * Create DynamicTopK calculator instance
 */
export function createDynamicTopKCalculator(
  config?: Partial<EnhancedRetrievalConfig>
): DynamicTopKCalculator {
  return new DynamicTopKCalculator(config);
}