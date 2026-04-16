/**
 * DynamicTopKCalculator Unit Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DynamicTopKCalculator, createDynamicTopKCalculator } from './dynamic-topk-calculator.js';
import type { TopKResult } from './config.js';

describe('DynamicTopKCalculator', () => {
  let calculator: DynamicTopKCalculator;

  beforeEach(() => {
    calculator = createDynamicTopKCalculator();
  });

  describe('calculate', () => {
    it('should calculate correct topK for standard config', () => {
      // Default: 64K window, 500 system prompt, 12K output, 0.6 fill, 1.5 overfetch
      // effectiveWindow = 64000 - 500 - 12000 = 51500
      // targetTokens = 51500 * 0.6 = 30900
      // coarseTopK = 30900 * 1.5 / 800 = 58 (approx)

      const result = calculator.calculate(800);

      expect(result.effectiveWindow).toBe(51500);
      expect(result.targetTokens).toBe(30900);
      expect(result.coarseTopK).toBeGreaterThan(50);
      expect(result.coarseTopK).toBeLessThan(70);
    });

    it('should handle small avgParentTokens', () => {
      const result = calculator.calculate(100);

      // Should still produce reasonable topK
      expect(result.coarseTopK).toBeGreaterThan(0);
      expect(result.coarseTopK).toBeLessThanOrEqual(200);
    });

    it('should handle zero avgParentTokens with safe default', () => {
      const result = calculator.calculate(0);

      // Should use default 800 tokens
      expect(result.coarseTopK).toBeGreaterThan(50);
      expect(result.coarseTopK).toBeLessThan(70);
    });

    it('should bound topK to min 5', () => {
      // Very large avgParentTokens should still produce min 5
      const result = calculator.calculate(100000);

      expect(result.coarseTopK).toBeGreaterThanOrEqual(5);
    });

    it('should bound topK to max 200', () => {
      // Very small avgParentTokens with large window should cap at 200
      const largeWindowCalculator = createDynamicTopKCalculator({
        modelContextWindow: 128000,
      });

      const result = largeWindowCalculator.calculate(10);

      expect(result.coarseTopK).toBeLessThanOrEqual(200);
    });
  });

  describe('presets', () => {
    it('should calculate for light preset (32K)', () => {
      const result = calculator.calculateForPreset('light', 800);

      expect(result.effectiveWindow).toBeLessThan(32000);
      // Light: 32K - 500 - 8K = 23.5K effective
      expect(result.effectiveWindow).toBe(23500);
    });

    it('should calculate for standard preset (64K)', () => {
      const result = calculator.calculateForPreset('standard', 800);

      expect(result.effectiveWindow).toBeLessThan(64000);
      expect(result.effectiveWindow).toBe(51500);
    });

    it('should calculate for extended preset (128K)', () => {
      const result = calculator.calculateForPreset('extended', 800);

      expect(result.effectiveWindow).toBeLessThan(128000);
      // Extended: 128K - 500 - 24K = 103.5K effective
      expect(result.effectiveWindow).toBe(103500);
    });

    it('should get all presets', () => {
      const presets = calculator.getAllPresets(800);

      expect(presets.light).toBeDefined();
      expect(presets.standard).toBeDefined();
      expect(presets.extended).toBeDefined();

      // Extended should have larger topK than standard
      expect(presets.extended.coarseTopK).toBeGreaterThan(presets.standard.coarseTopK);
    });
  });

  describe('calculateForWindow', () => {
    it('should calculate for 32K window', () => {
      const result = calculator.calculateForWindow(32000, 800);

      expect(result.effectiveWindow).toBeLessThan(32000);
    });

    it('should calculate for 64K window', () => {
      const result = calculator.calculateForWindow(64000, 800);

      expect(result.effectiveWindow).toBeLessThan(64000);
    });

    it('should calculate for 128K window', () => {
      const result = calculator.calculateForWindow(128000, 800);

      expect(result.effectiveWindow).toBeLessThan(128000);
    });
  });

  describe('utility methods', () => {
    it('should get target tokens', () => {
      const targetTokens = calculator.getTargetTokens();

      expect(targetTokens).toBe(30900);
    });

    it('should get effective window', () => {
      const effectiveWindow = calculator.getEffectiveWindow();

      expect(effectiveWindow).toBe(51500);
    });

    it('should calculate context utilization', () => {
      const utilization = calculator.getContextUtilization(20000);

      expect(utilization).toBeLessThan(100);
      expect(utilization).toBeGreaterThan(50);
    });

    it('should handle zero target tokens in utilization', () => {
      const smallCalculator = createDynamicTopKCalculator({
        modelContextWindow: 32000,
        fillRatio: 0.3,
      });

      const utilization = smallCalculator.getContextUtilization(10000);

      expect(utilization).toBeGreaterThan(0);
    });
  });

  describe('validateTopK', () => {
    it('should validate reasonable topK', () => {
      const validation = calculator.validateTopK(50, 800);

      expect(validation.valid).toBe(true);
    });

    it('should reject topK < 5', () => {
      const validation = calculator.validateTopK(2, 800);

      expect(validation.valid).toBe(false);
      expect(validation.reason).toContain('too small');
      expect(validation.recommendation).toBe(5);
    });

    it('should reject topK > 200', () => {
      const validation = calculator.validateTopK(300, 800);

      expect(validation.valid).toBe(false);
      expect(validation.reason).toContain('too large');
      expect(validation.recommendation).toBe(200);
    });

    it('should warn on large deviation', () => {
      // Recommended is ~58, test with 10
      const validation = calculator.validateTopK(10, 800);

      expect(validation.valid).toBe(true);
      expect(validation.reason).toContain('deviates');
    });
  });

  describe('estimateLatencyImpact', () => {
    it('should estimate fast latency for small topK', () => {
      const impact = calculator.estimateLatencyImpact(10);

      expect(impact.estimatedMs).toBeLessThan(500);
      expect(impact.factor).toBe('fast');
    });

    it('should estimate moderate latency for medium topK', () => {
      const impact = calculator.estimateLatencyImpact(30);

      expect(impact.estimatedMs).toBeLessThan(1000);
    });

    it('should estimate slow latency for large topK', () => {
      const impact = calculator.estimateLatencyImpact(80);

      // 100 + 80*20 = 1700ms, which is 'slow' (< 2000)
      expect(impact.estimatedMs).toBeLessThan(2000);
      expect(impact.factor).toBe('slow');
    });

    it('should estimate very_slow latency for very large topK', () => {
      const impact = calculator.estimateLatencyImpact(200);

      expect(impact.factor).toBe('very_slow');
    });
  });

  describe('configuration', () => {
    it('should return config', () => {
      const config = calculator.getConfig();

      expect(config.modelContextWindow).toBe(64000);
      expect(config.fillRatio).toBe(0.6);
      expect(config.overfetchRatio).toBe(1.5);
    });

    it('should update config', () => {
      calculator.setConfig({ modelContextWindow: 32000 });
      const config = calculator.getConfig();

      expect(config.modelContextWindow).toBe(32000);
    });

    it('should use custom fillRatio', () => {
      calculator = createDynamicTopKCalculator({ fillRatio: 0.8 });
      const result = calculator.calculate(800);

      // Higher fill ratio should result in more tokens
      expect(result.targetTokens).toBeGreaterThan(30900);
    });

    it('should use custom overfetchRatio', () => {
      calculator = createDynamicTopKCalculator({ overfetchRatio: 2.0 });
      const result = calculator.calculate(800);

      // Higher overfetch should result in larger topK
      expect(result.coarseTopK).toBeGreaterThan(58);
    });
  });

  describe('AC-003 acceptance criteria', () => {
    it('should meet AC-003: given 64K and avgParentTokens=800, coarseTopK≈58', () => {
      // AC-003 from spec:
      // Given modelContextWindow=64000, avgParentTokens=800
      // Then coarseTopK ≈ 58, targetTokens ≈ 30900

      calculator = createDynamicTopKCalculator({
        modelContextWindow: 64000,
        systemPromptTokens: 500,
        outputReservation: 12000,
        fillRatio: 0.6,
        overfetchRatio: 1.5,
      });

      const result = calculator.calculate(800);

      expect(result.targetTokens).toBe(30900);
      expect(result.coarseTopK).toBeGreaterThanOrEqual(55);
      expect(result.coarseTopK).toBeLessThanOrEqual(62);
    });
  });
});