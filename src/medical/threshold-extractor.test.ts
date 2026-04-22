/**
 * Threshold Extractor Tests
 */

import { describe, it, expect } from 'vitest';
import {
  extractThresholds,
  toThresholdCondition,
  matchesThreshold,
  extractPatientIndicatorValues,
} from './threshold-extractor.js';

describe('ThresholdExtractor', () => {
  describe('extractThresholds', () => {
    it('should extract simple threshold', () => {
      const text = 'eGFR < 30 禁用二甲双胍';
      const thresholds = extractThresholds(text);

      expect(thresholds.length).toBeGreaterThan(0);
      expect(thresholds[0]?.indicator).toBe('indicator_egfr');
      expect(thresholds[0]?.operator).toBe('<');
      expect(thresholds[0]?.value).toBe(30);
    });

    it('should extract threshold with unit', () => {
      const text = '血糖 > 7.8 mmol/L';
      const thresholds = extractThresholds(text);

      expect(thresholds.length).toBeGreaterThan(0);
      expect(thresholds[0]?.indicator).toBe('indicator_fasting_glucose');
      expect(thresholds[0]?.operator).toBe('>');
      expect(thresholds[0]?.value).toBe(7.8);
      expect(thresholds[0]?.unit).toMatch(/mmol/i);
      expect(thresholds[0]?.isValidUnit).toBe(true);
    });

    it('should extract multiple thresholds', () => {
      const text = 'eGFR=45，HbA1c 8.5%';
      const thresholds = extractThresholds(text);

      expect(thresholds.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle Unicode operators (≤≥)', () => {
      const text = 'eGFR ≤ 45 需减量';
      const thresholds = extractThresholds(text);

      expect(thresholds.length).toBeGreaterThan(0);
      expect(thresholds[0]?.operator).toBe('<=');
    });

    it('should return empty array when no threshold found', () => {
      const text = '二甲双胍有什么副作用';
      const thresholds = extractThresholds(text);

      expect(thresholds).toEqual([]);
    });
  });

  describe('toThresholdCondition', () => {
    it('should convert ExtractedThreshold to ThresholdCondition', () => {
      const extracted = {
        indicator: 'indicator_egfr',
        indicatorName: 'eGFR',
        operator: '<' as const,
        value: 30,
        unit: 'mL/min/1.73m²',
        isValidUnit: true,
        sourceText: 'eGFR < 30',
      };

      const condition = toThresholdCondition(extracted);

      expect(condition.indicator).toBe('indicator_egfr');
      expect(condition.operator).toBe('<');
      expect(condition.value).toBe(30);
    });
  });

  describe('matchesThreshold', () => {
    it('should match less than operator', () => {
      expect(matchesThreshold(25, { indicator: 'indicator_egfr', operator: '<', value: 30 })).toBe(true);
      expect(matchesThreshold(35, { indicator: 'indicator_egfr', operator: '<', value: 30 })).toBe(false);
    });

    it('should match greater than operator', () => {
      expect(matchesThreshold(35, { indicator: 'indicator_egfr', operator: '>', value: 30 })).toBe(true);
      expect(matchesThreshold(25, { indicator: 'indicator_egfr', operator: '>', value: 30 })).toBe(false);
    });

    it('should match equals operator', () => {
      expect(matchesThreshold(30, { indicator: 'indicator_egfr', operator: '=', value: 30 })).toBe(true);
      expect(matchesThreshold(31, { indicator: 'indicator_egfr', operator: '=', value: 30 })).toBe(false);
    });

    it('should match less than or equals operator', () => {
      expect(matchesThreshold(30, { indicator: 'indicator_egfr', operator: '<=', value: 30 })).toBe(true);
      expect(matchesThreshold(31, { indicator: 'indicator_egfr', operator: '<=', value: 30 })).toBe(false);
    });

    it('should match greater than or equals operator', () => {
      expect(matchesThreshold(30, { indicator: 'indicator_egfr', operator: '>=', value: 30 })).toBe(true);
      expect(matchesThreshold(29, { indicator: 'indicator_egfr', operator: '>=', value: 30 })).toBe(false);
    });
  });

  describe('extractPatientIndicatorValues', () => {
    it('should extract patient indicator values as map', () => {
      const query = '我的eGFR是35，血糖7.8';
      const values = extractPatientIndicatorValues(query);

      expect(values.size).toBeGreaterThanOrEqual(1);
      expect(values.get('indicator_egfr')).toBe(35);
    });
  });
});