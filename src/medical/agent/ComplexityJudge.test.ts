/**
 * ComplexityJudge Unit Tests
 */

import { describe, it, expect } from 'vitest';
import {
  assessComplexity,
  detectStructuredPattern,
  generateQueryHash,
  createComplexityJudge,
} from './ComplexityJudge.js';
import type { MedicalEntities } from '../types.js';
import type { IntentAnalysis } from './ExecutionTypes.js';

describe('ComplexityJudge', () => {
  describe('assessComplexity', () => {
    it('should classify as simple for single entity', () => {
      const entities: MedicalEntities = {
        diseases: [{ id: 'disease_1', canonicalName: '糖尿病', matchedTerm: '糖尿病', aliases: [] }],
        drugs: [],
        indicators: [],
        relations: [],
        rawQuery: '什么是糖尿病',
        confidence: 0.9,
      };

      const result = assessComplexity(entities, '什么是糖尿病');
      expect(result.level).toBe('simple');
      expect(result.needsPlanning).toBe(false);
      expect(result.entityCount).toBe(1);
    });

    it('should classify as moderate for 2-3 entities', () => {
      const entities: MedicalEntities = {
        diseases: [{ id: 'disease_1', canonicalName: '糖尿病', matchedTerm: '糖尿病', aliases: [] }],
        drugs: [{ id: 'drug_1', canonicalName: '二甲双胍', matchedTerm: '二甲双胍', aliases: [], classification: { category: '降糖药', subcategory: '胰岛素增敏剂' } }],
        indicators: [],
        relations: [],
        rawQuery: '糖尿病二甲双胍用法',
        confidence: 0.9,
      };

      const result = assessComplexity(entities, '糖尿病二甲双胍用法');
      expect(result.level).toBe('moderate');
      expect(result.needsPlanning).toBe(true);
      expect(result.entityCount).toBe(2);
    });

    it('should classify as complex for comparison intent', () => {
      const entities: MedicalEntities = {
        diseases: [],
        drugs: [
          { id: 'drug_1', canonicalName: '二甲双胍', matchedTerm: '二甲双胍', aliases: [], classification: { category: '降糖药', subcategory: '胰岛素增敏剂' } },
          { id: 'drug_2', canonicalName: '利拉鲁肽', matchedTerm: '利拉鲁肽', aliases: [], classification: { category: '降糖药', subcategory: 'GLP-1受体激动剂' } },
        ],
        indicators: [],
        relations: [],
        rawQuery: '二甲双胍和利拉鲁肽哪个更适合肾功能不全患者',
        confidence: 0.9,
      };

      const result = assessComplexity(entities, '二甲双胍和利拉鲁肽哪个更适合肾功能不全患者');
      expect(result.level).toBe('complex');
      expect(result.needsPlanning).toBe(true);
      expect(result.hasComparison).toBe(true);
    });

    it('should classify as structured for year filter', () => {
      const entities: MedicalEntities = {
        diseases: [{ id: 'disease_1', canonicalName: '糖尿病', matchedTerm: '糖尿病', aliases: [] }],
        drugs: [],
        indicators: [],
        relations: [],
        rawQuery: '2024年ADA糖尿病指南',
        confidence: 0.9,
      };

      const result = assessComplexity(entities, '2024年ADA糖尿病指南');
      expect(result.level).toBe('structured');
      expect(result.needsPlanning).toBe(true);
    });

    it('should detect comparison patterns', () => {
      const entities: MedicalEntities = {
        diseases: [],
        drugs: [
          { id: 'drug_1', canonicalName: '二甲双胍', matchedTerm: '二甲双胍', aliases: [], classification: { category: '降糖药', subcategory: '胰岛素增敏剂' } },
          { id: 'drug_2', canonicalName: '利拉鲁肽', matchedTerm: '利拉鲁肽', aliases: [], classification: { category: '降糖药', subcategory: 'GLP-1受体激动剂' } },
        ],
        indicators: [],
        relations: [],
        rawQuery: '对比二甲双胍和利拉鲁肽',
        confidence: 0.9,
      };

      const result = assessComplexity(entities, '对比二甲双胍和利拉鲁肽');
      expect(result.hasComparison).toBe(true);
      expect(result.level).toBe('complex');
    });

    it('should detect entity count correctly', () => {
      const entities: MedicalEntities = {
        diseases: [{ id: 'disease_1', canonicalName: '糖尿病', matchedTerm: '糖尿病', aliases: [] }],
        drugs: [{ id: 'drug_1', canonicalName: '二甲双胍', matchedTerm: '二甲双胍', aliases: [], classification: { category: '降糖药', subcategory: '胰岛素增敏剂' } }],
        indicators: [{ id: 'indicator_1', canonicalName: 'eGFR', matchedTerm: 'eGFR', unit: 'mL/min/1.73m²', value: 35 }],
        relations: [],
        rawQuery: 'test',
        confidence: 0.9,
      };

      const result = assessComplexity(entities, 'test');
      expect(result.entityCount).toBe(3);
    });

    it('should detect interaction check for two drugs', () => {
      const entities: MedicalEntities = {
        diseases: [],
        drugs: [
          { id: 'drug_1', canonicalName: '二甲双胍', matchedTerm: '二甲双胍', aliases: [], classification: { category: '降糖药', subcategory: '胰岛素增敏剂' } },
          { id: 'drug_2', canonicalName: '胰岛素', matchedTerm: '胰岛素', aliases: [], classification: { category: '降糖药', subcategory: '胰岛素' } },
        ],
        indicators: [],
        relations: [],
        rawQuery: '二甲双胍和胰岛素合用',
        confidence: 0.9,
      };

      const result = assessComplexity(entities, '二甲双胍和胰岛素合用');
      expect(result.hasInteraction).toBe(true);
    });
  });

  describe('detectStructuredPattern', () => {
    const createIntentAnalysis = (overrides?: Partial<IntentAnalysis>): IntentAnalysis => ({
      queryTypes: ['information_query'],
      primaryFocusEntity: '',
      secondaryFocusEntities: [],
      retrievalNeeds: {},
      specialNeeds: {
        calculateIndicator: false,
        checkInteraction: false,
        checkContraindication: false,
        requireYearFilter: false,
      },
      expectedAnswerFormat: 'direct',
      ...overrides,
    });

    it('should match drug_contraindication pattern', () => {
      const entities: MedicalEntities = {
        diseases: [],
        drugs: [{ id: 'drug_1', canonicalName: '二甲双胍', matchedTerm: '二甲双胍', aliases: [], classification: { category: '降糖药', subcategory: '胰岛素增敏剂' } }],
        indicators: [],
        relations: [],
        rawQuery: '二甲双胍禁忌症',
        confidence: 0.9,
      };

      const intentAnalysis = createIntentAnalysis({
        specialNeeds: { checkContraindication: true },
      });

      const pattern = detectStructuredPattern(entities, intentAnalysis);
      expect(pattern).toBe('drug_contraindication');
    });

    it('should match indicator_drug_query pattern', () => {
      const entities: MedicalEntities = {
        diseases: [],
        drugs: [{ id: 'drug_1', canonicalName: '二甲双胍', matchedTerm: '二甲双胍', aliases: [], classification: { category: '降糖药', subcategory: '胰岛素增敏剂' } }],
        indicators: [{ id: 'indicator_1', canonicalName: 'eGFR', matchedTerm: 'eGFR', unit: 'mL/min/1.73m²', value: 35 }],
        relations: [],
        rawQuery: 'eGFR=35二甲双胍能否使用',
        confidence: 0.9,
      };

      const intentAnalysis = createIntentAnalysis({
        specialNeeds: { checkContraindication: true },
      });

      const pattern = detectStructuredPattern(entities, intentAnalysis);
      expect(pattern).toBe('indicator_drug_query');
    });

    it('should match drug_comparison pattern', () => {
      const entities: MedicalEntities = {
        diseases: [],
        drugs: [
          { id: 'drug_1', canonicalName: '二甲双胍', matchedTerm: '二甲双胍', aliases: [], classification: { category: '降糖药', subcategory: '胰岛素增敏剂' } },
          { id: 'drug_2', canonicalName: '利拉鲁肽', matchedTerm: '利拉鲁肽', aliases: [], classification: { category: '降糖药', subcategory: 'GLP-1受体激动剂' } },
        ],
        indicators: [],
        relations: [],
        rawQuery: '二甲双胍vs利拉鲁肽',
        confidence: 0.9,
      };

      const intentAnalysis = createIntentAnalysis({
        queryTypes: ['comparison'],
      });

      const pattern = detectStructuredPattern(entities, intentAnalysis);
      expect(pattern).toBe('drug_comparison');
    });

    it('should match guideline_year_filter pattern', () => {
      const entities: MedicalEntities = {
        diseases: [{ id: 'disease_1', canonicalName: '糖尿病', matchedTerm: '糖尿病', aliases: [] }],
        drugs: [],
        indicators: [],
        relations: [],
        rawQuery: '2024年ADA指南',
        confidence: 0.9,
      };

      const intentAnalysis = createIntentAnalysis({
        specialNeeds: { requireYearFilter: true, yearValue: 2024 },
      });

      const pattern = detectStructuredPattern(entities, intentAnalysis);
      expect(pattern).toBe('guideline_year_filter');
    });

    it('should return null for unmatched patterns', () => {
      const entities: MedicalEntities = {
        diseases: [{ id: 'disease_1', canonicalName: '糖尿病', matchedTerm: '糖尿病', aliases: [] }],
        drugs: [],
        indicators: [],
        relations: [],
        rawQuery: '糖尿病症状',
        confidence: 0.9,
      };

      const intentAnalysis = createIntentAnalysis();
      const pattern = detectStructuredPattern(entities, intentAnalysis);
      expect(pattern).toBeNull();
    });
  });

  describe('generateQueryHash', () => {
    it('should generate consistent hash for same query', () => {
      const entities: MedicalEntities = {
        diseases: [{ id: 'disease_1', canonicalName: '糖尿病', matchedTerm: '糖尿病', aliases: [] }],
        drugs: [],
        indicators: [],
        relations: [],
        rawQuery: 'test',
        confidence: 0.9,
      };

      const hash1 = generateQueryHash('test query', entities);
      const hash2 = generateQueryHash('test query', entities);
      expect(hash1).toBe(hash2);
    });

    it('should generate different hash for different queries', () => {
      const entities: MedicalEntities = {
        diseases: [{ id: 'disease_1', canonicalName: '糖尿病', matchedTerm: '糖尿病', aliases: [] }],
        drugs: [],
        indicators: [],
        relations: [],
        rawQuery: 'test',
        confidence: 0.9,
      };

      const hash1 = generateQueryHash('query 1', entities);
      const hash2 = generateQueryHash('query 2', entities);
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('createComplexityJudge', () => {
    it('should create judge with all functions', () => {
      const judge = createComplexityJudge();
      expect(judge.assess).toBeDefined();
      expect(judge.detectPattern).toBeDefined();
      expect(judge.cacheResult).toBeDefined();
      expect(judge.getCached).toBeDefined();
    });

    it('should cache and retrieve results', () => {
      const judge = createComplexityJudge();
      const entities: MedicalEntities = {
        diseases: [],
        drugs: [],
        indicators: [],
        relations: [],
        rawQuery: 'test',
        confidence: 0.9,
      };

      const result = assessComplexity(entities, 'test');
      judge.cacheResult('test_hash', result);

      const cached = judge.getCached('test_hash');
      expect(cached).toEqual(result);
    });
  });

  describe('edge cases', () => {
    it('should handle empty entities', () => {
      const entities: MedicalEntities = {
        diseases: [],
        drugs: [],
        indicators: [],
        relations: [],
        rawQuery: 'test',
        confidence: 0.5,
      };

      const result = assessComplexity(entities, 'test query');
      expect(result.level).toBe('simple');
      expect(result.entityCount).toBe(0);
    });

    it('should handle many entities', () => {
      const entities: MedicalEntities = {
        diseases: [
          { id: 'disease_1', canonicalName: '糖尿病', matchedTerm: '糖尿病', aliases: [] },
          { id: 'disease_2', canonicalName: '高血压', matchedTerm: '高血压', aliases: [] },
        ],
        drugs: [
          { id: 'drug_1', canonicalName: '二甲双胍', matchedTerm: '二甲双胍', aliases: [], classification: { category: '降糖药', subcategory: '胰岛素增敏剂' } },
          { id: 'drug_2', canonicalName: '利拉鲁肽', matchedTerm: '利拉鲁肽', aliases: [], classification: { category: '降糖药', subcategory: 'GLP-1受体激动剂' } },
          { id: 'drug_3', canonicalName: '胰岛素', matchedTerm: '胰岛素', aliases: [], classification: { category: '降糖药', subcategory: '胰岛素' } },
        ],
        indicators: [{ id: 'indicator_1', canonicalName: 'eGFR', matchedTerm: 'eGFR', unit: 'mL/min/1.73m²' }],
        relations: [],
        rawQuery: 'test',
        confidence: 0.9,
      };

      const result = assessComplexity(entities, 'test');
      expect(result.entityCount).toBe(6);
      expect(result.level).toBe('complex');
    });

    it('should detect comparison keywords', () => {
      const queries = [
        '哪个更适合',
        '哪个更好',
        '对比差异',
        '比较一下',
        '区别是什么',
        'versus',
        'vs',
        'which drug',
        'compare these',
      ];

      for (const query of queries) {
        const entities: MedicalEntities = {
          diseases: [],
          drugs: [
            { id: 'drug_1', canonicalName: '二甲双胍', matchedTerm: '二甲双胍', aliases: [], classification: { category: '降糖药', subcategory: '胰岛素增敏剂' } },
            { id: 'drug_2', canonicalName: '利拉鲁肽', matchedTerm: '利拉鲁肽', aliases: [], classification: { category: '降糖药', subcategory: 'GLP-1受体激动剂' } },
          ],
          indicators: [],
          relations: [],
          rawQuery: query,
          confidence: 0.9,
        };

        const result = assessComplexity(entities, query);
        expect(result.hasComparison).toBe(true);
      }
    });
  });
});