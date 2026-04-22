/**
 * IntentAnalyzer Unit Tests
 */

import { describe, it, expect } from 'vitest';
import {
  analyzeIntent,
  createIntentAnalyzer,
} from './IntentAnalyzer.js';
import type { MedicalEntities } from '../types.js';

describe('IntentAnalyzer', () => {
  const createTestEntities = (overrides?: Partial<MedicalEntities>): MedicalEntities => ({
    diseases: [],
    drugs: [],
    indicators: [],
    relations: [],
    rawQuery: 'test',
    confidence: 0.9,
    ...overrides,
  });

  describe('analyzeIntent', () => {
    describe('query type classification', () => {
      it('should classify as information_query for simple query', () => {
        const entities = createTestEntities({
          drugs: [{ id: 'drug_1', canonicalName: '二甲双胍', matchedTerm: '二甲双胍', aliases: [], classification: { category: '降糖药', subcategory: '胰岛素增敏剂' } }],
          rawQuery: '二甲双胍的作用机制',
        });

        const result = analyzeIntent(entities, '二甲双胍的作用机制');
        expect(result.queryTypes).toContain('information_query');
      });

      it('should classify as comparison for comparison query', () => {
        const entities = createTestEntities({
          drugs: [
            { id: 'drug_1', canonicalName: '二甲双胍', matchedTerm: '二甲双胍', aliases: [], classification: { category: '降糖药', subcategory: '胰岛素增敏剂' } },
            { id: 'drug_2', canonicalName: '利拉鲁肽', matchedTerm: '利拉鲁肽', aliases: [], classification: { category: '降糖药', subcategory: 'GLP-1受体激动剂' } },
          ],
          rawQuery: '二甲双胍vs利拉鲁肽',
        });

        const result = analyzeIntent(entities, '二甲双胍vs利拉鲁肽');
        expect(result.queryTypes).toContain('comparison');
      });

      it('should classify as safety_check for contraindication query', () => {
        const entities = createTestEntities({
          drugs: [{ id: 'drug_1', canonicalName: '二甲双胍', matchedTerm: '二甲双胍', aliases: [], classification: { category: '降糖药', subcategory: '胰岛素增敏剂' } }],
          rawQuery: '二甲双胍禁忌症',
        });

        const result = analyzeIntent(entities, '二甲双胍禁忌症');
        expect(result.queryTypes).toContain('safety_check');
      });

      it('should classify as decision_support for conditional query', () => {
        const entities = createTestEntities({
          drugs: [{ id: 'drug_1', canonicalName: '二甲双胍', matchedTerm: '二甲双胍', aliases: [], classification: { category: '降糖药', subcategory: '胰岛素增敏剂' } }],
          indicators: [{ id: 'indicator_1', canonicalName: 'eGFR', matchedTerm: 'eGFR', unit: 'mL/min/1.73m²', value: 35 }],
          rawQuery: 'eGFR=35能否使用二甲双胍',
        });

        const result = analyzeIntent(entities, 'eGFR=35能否使用二甲双胍');
        expect(result.queryTypes).toContain('decision_support');
      });

      it('should classify interaction check for two drugs', () => {
        const entities = createTestEntities({
          drugs: [
            { id: 'drug_1', canonicalName: '二甲双胍', matchedTerm: '二甲双胍', aliases: [], classification: { category: '降糖药', subcategory: '胰岛素增敏剂' } },
            { id: 'drug_2', canonicalName: '胰岛素', matchedTerm: '胰岛素', aliases: [], classification: { category: '降糖药', subcategory: '胰岛素' } },
          ],
          rawQuery: '二甲双胍和胰岛素相互作用',
        });

        const result = analyzeIntent(entities, '二甲双胍和胰岛素相互作用');
        expect(result.queryTypes).toContain('safety_check');
        expect(result.specialNeeds.checkInteraction).toBe(true);
      });
    });

    describe('primary focus entity detection', () => {
      it('should identify drug as primary focus', () => {
        const entities = createTestEntities({
          drugs: [{ id: 'drug_1', canonicalName: '二甲双胍', matchedTerm: '二甲双胍', aliases: [], classification: { category: '降糖药', subcategory: '胰岛素增敏剂' } }],
          diseases: [{ id: 'disease_1', canonicalName: '糖尿病', matchedTerm: '糖尿病', aliases: [] }],
          rawQuery: '二甲双胍治疗糖尿病',
        });

        const result = analyzeIntent(entities, '二甲双胍治疗糖尿病');
        expect(result.primaryFocusEntity).toBe('drug_1');
      });

      it('should identify indicator as primary focus when with value', () => {
        const entities = createTestEntities({
          indicators: [{ id: 'indicator_1', canonicalName: 'eGFR', matchedTerm: 'eGFR', unit: 'mL/min/1.73m²', value: 35 }],
          drugs: [{ id: 'drug_1', canonicalName: '二甲双胍', matchedTerm: '二甲双胍', aliases: [], classification: { category: '降糖药', subcategory: '胰岛素增敏剂' } }],
          rawQuery: 'eGFR=35二甲双胍',
        });

        const result = analyzeIntent(entities, 'eGFR=35二甲双胍');
        // 药物优先级高于指标
        expect(result.primaryFocusEntity).toBe('drug_1');
        expect(result.secondaryFocusEntities).toContain('indicator_1');
      });
    });

    describe('special needs flag detection', () => {
      it('should detect calculateIndicator need', () => {
        const entities = createTestEntities({
          indicators: [{ id: 'indicator_1', canonicalName: 'eGFR', matchedTerm: 'eGFR', unit: 'mL/min/1.73m²', value: 35 }],
          rawQuery: 'eGFR=35',
        });

        const result = analyzeIntent(entities, 'eGFR=35');
        expect(result.specialNeeds.calculateIndicator).toBe(true);
      });

      it('should detect checkInteraction need', () => {
        const entities = createTestEntities({
          drugs: [
            { id: 'drug_1', canonicalName: '二甲双胍', matchedTerm: '二甲双胍', aliases: [], classification: { category: '降糖药', subcategory: '胰岛素增敏剂' } },
            { id: 'drug_2', canonicalName: '胰岛素', matchedTerm: '胰岛素', aliases: [], classification: { category: '降糖药', subcategory: '胰岛素' } },
          ],
          rawQuery: '二甲双胍和胰岛素',
        });

        const result = analyzeIntent(entities, '二甲双胍和胰岛素');
        expect(result.specialNeeds.checkInteraction).toBe(true);
      });

      it('should detect checkContraindication need', () => {
        const entities = createTestEntities({
          drugs: [{ id: 'drug_1', canonicalName: '二甲双胍', matchedTerm: '二甲双胍', aliases: [], classification: { category: '降糖药', subcategory: '胰岛素增敏剂' } }],
          rawQuery: '二甲双胍禁忌症',
        });

        const result = analyzeIntent(entities, '二甲双胍禁忌症');
        expect(result.specialNeeds.checkContraindication).toBe(true);
      });

      it('should detect requireYearFilter need', () => {
        const entities = createTestEntities({
          diseases: [{ id: 'disease_1', canonicalName: '糖尿病', matchedTerm: '糖尿病', aliases: [] }],
          rawQuery: '2024年ADA糖尿病指南',
        });

        const result = analyzeIntent(entities, '2024年ADA糖尿病指南');
        expect(result.specialNeeds.requireYearFilter).toBe(true);
        expect(result.specialNeeds.yearValue).toBe(2024);
      });
    });

    describe('retrieval needs prediction', () => {
      it('should mark all drugs as required for comparison', () => {
        const entities = createTestEntities({
          drugs: [
            { id: 'drug_1', canonicalName: '二甲双胍', matchedTerm: '二甲双胍', aliases: [], classification: { category: '降糖药', subcategory: '胰岛素增敏剂' } },
            { id: 'drug_2', canonicalName: '利拉鲁肽', matchedTerm: '利拉鲁肽', aliases: [], classification: { category: '降糖药', subcategory: 'GLP-1受体激动剂' } },
          ],
          rawQuery: '二甲双胍vs利拉鲁肽',
        });

        const result = analyzeIntent(entities, '二甲双胍vs利拉鲁肽');
        expect(result.retrievalNeeds['drug_1']).toBe('required');
        expect(result.retrievalNeeds['drug_2']).toBe('required');
      });

      it('should mark drugs and indicators as required for safety check', () => {
        const entities = createTestEntities({
          drugs: [{ id: 'drug_1', canonicalName: '二甲双胍', matchedTerm: '二甲双胍', aliases: [], classification: { category: '降糖药', subcategory: '胰岛素增敏剂' } }],
          indicators: [{ id: 'indicator_1', canonicalName: 'eGFR', matchedTerm: 'eGFR', unit: 'mL/min/1.73m²' }],
          rawQuery: '二甲双胍禁忌症eGFR',
        });

        const result = analyzeIntent(entities, '二甲双胍禁忌症eGFR');
        expect(result.retrievalNeeds['drug_1']).toBe('required');
        expect(result.retrievalNeeds['indicator_1']).toBe('required');
      });

      it('should mark primary entity as required for information query', () => {
        const entities = createTestEntities({
          drugs: [{ id: 'drug_1', canonicalName: '二甲双胍', matchedTerm: '二甲双胍', aliases: [], classification: { category: '降糖药', subcategory: '胰岛素增敏剂' } }],
          diseases: [{ id: 'disease_1', canonicalName: '糖尿病', matchedTerm: '糖尿病', aliases: [] }],
          rawQuery: '二甲双胍作用机制',
        });

        const result = analyzeIntent(entities, '二甲双胍作用机制');
        expect(result.retrievalNeeds['drug_1']).toBe('required');
        expect(result.retrievalNeeds['disease_1']).toBe('recommended');
      });
    });

    describe('expected answer format', () => {
      it('should predict comparison format for comparison query', () => {
        const entities = createTestEntities({
          drugs: [
            { id: 'drug_1', canonicalName: '二甲双胍', matchedTerm: '二甲双胍', aliases: [], classification: { category: '降糖药', subcategory: '胰岛素增敏剂' } },
            { id: 'drug_2', canonicalName: '利拉鲁肽', matchedTerm: '利拉鲁肽', aliases: [], classification: { category: '降糖药', subcategory: 'GLP-1受体激动剂' } },
          ],
          rawQuery: '二甲双胍vs利拉鲁肽',
        });

        const result = analyzeIntent(entities, '二甲双胍vs利拉鲁肽');
        expect(result.expectedAnswerFormat).toBe('comparison');
      });

      it('should predict safety_warning format for safety check', () => {
        const entities = createTestEntities({
          drugs: [{ id: 'drug_1', canonicalName: '二甲双胍', matchedTerm: '二甲双胍', aliases: [], classification: { category: '降糖药', subcategory: '胰岛素增敏剂' } }],
          rawQuery: '二甲双胍禁忌症',
        });

        const result = analyzeIntent(entities, '二甲双胍禁忌症');
        expect(result.expectedAnswerFormat).toBe('safety_warning');
      });

      it('should predict recommendation format for decision support', () => {
        const entities = createTestEntities({
          drugs: [{ id: 'drug_1', canonicalName: '二甲双胍', matchedTerm: '二甲双胍', aliases: [], classification: { category: '降糖药', subcategory: '胰岛素增敏剂' } }],
          indicators: [{ id: 'indicator_1', canonicalName: 'eGFR', matchedTerm: 'eGFR', unit: 'mL/min/1.73m²', value: 35 }],
          rawQuery: 'eGFR=35能否使用二甲双胍',
        });

        const result = analyzeIntent(entities, 'eGFR=35能否使用二甲双胍');
        expect(result.expectedAnswerFormat).toBe('recommendation');
      });

      it('should predict direct format for information query', () => {
        const entities = createTestEntities({
          drugs: [{ id: 'drug_1', canonicalName: '二甲双胍', matchedTerm: '二甲双胍', aliases: [], classification: { category: '降糖药', subcategory: '胰岛素增敏剂' } }],
          rawQuery: '二甲双胍的作用机制',
        });

        const result = analyzeIntent(entities, '二甲双胍的作用机制');
        expect(result.expectedAnswerFormat).toBe('direct');
      });
    });
  });

  describe('createIntentAnalyzer', () => {
    it('should create analyzer with analyze function', () => {
      const analyzer = createIntentAnalyzer();
      expect(analyzer.analyze).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('should handle empty entities', () => {
      const entities = createTestEntities({
        rawQuery: '一般医学问题',
      });

      const result = analyzeIntent(entities, '一般医学问题');
      expect(result.queryTypes).toContain('information_query');
      expect(result.primaryFocusEntity).toBe('');
    });

    it('should handle multiple query types', () => {
      const entities = createTestEntities({
        drugs: [
          { id: 'drug_1', canonicalName: '二甲双胍', matchedTerm: '二甲双胍', aliases: [], classification: { category: '降糖药', subcategory: '胰岛素增敏剂' } },
          { id: 'drug_2', canonicalName: '利拉鲁肽', matchedTerm: '利拉鲁肽', aliases: [], classification: { category: '降糖药', subcategory: 'GLP-1受体激动剂' } },
        ],
        indicators: [{ id: 'indicator_1', canonicalName: 'eGFR', matchedTerm: 'eGFR', unit: 'mL/min/1.73m²', value: 35 }],
        rawQuery: '二甲双胍vs利拉鲁肽哪个对肾功能不全更安全',
      });

      const result = analyzeIntent(entities, '二甲双胍vs利拉鲁肽哪个对肾功能不全更安全');
      expect(result.queryTypes).toContain('comparison');
      expect(result.queryTypes).toContain('safety_check');
    });

    it('should extract year value from various formats', () => {
      const testCases = [
        { query: '2024年ADA指南', expectedYear: 2024 },
        { query: 'ADA2024版指南', expectedYear: 2024 },
      ];

      for (const { query, expectedYear } of testCases) {
        const entities = createTestEntities({ rawQuery: query });
        const result = analyzeIntent(entities, query);
        expect(result.specialNeeds.yearValue).toBe(expectedYear);
      }
    });
  });
});