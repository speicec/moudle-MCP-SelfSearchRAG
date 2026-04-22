/**
 * TemplateMatcher Unit Tests
 */

import { describe, it, expect } from 'vitest';
import {
  matchTemplate,
  createTemplateMatcher,
  STRUCTURED_TEMPLATES,
} from './TemplateMatcher.js';
import type { MedicalEntities } from '../types.js';
import type { IntentAnalysis } from './ExecutionTypes.js';

describe('TemplateMatcher', () => {
  const createTestEntities = (overrides?: Partial<MedicalEntities>): MedicalEntities => ({
    diseases: [],
    drugs: [],
    indicators: [],
    relations: [],
    rawQuery: 'test',
    confidence: 0.9,
    ...overrides,
  });

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

  describe('matchTemplate', () => {
    describe('guideline_year_filter template', () => {
      it('should match guideline year filter template', () => {
        const entities = createTestEntities({
          diseases: [{ id: 'disease_1', canonicalName: '糖尿病', matchedTerm: '糖尿病', aliases: [] }],
          rawQuery: '2024年ADA糖尿病指南',
        });

        const intentAnalysis = createIntentAnalysis({
          specialNeeds: { requireYearFilter: true, yearValue: 2024 },
        });

        const result = matchTemplate(entities, intentAnalysis, '2024年ADA糖尿病指南');
        expect(result.matched).toBe(true);
        expect(result.templateId).toBe('guideline_year_filter');
        expect(result.dag).toBeDefined();
        expect(result.dag?.tasks.length).toBe(3);
      });

      it('should generate correct DAG for year filter', () => {
        const entities = createTestEntities({
          diseases: [{ id: 'disease_1', canonicalName: '糖尿病', matchedTerm: '糖尿病', aliases: [] }],
        });

        const intentAnalysis = createIntentAnalysis({
          specialNeeds: { requireYearFilter: true, yearValue: 2024 },
        });

        const result = matchTemplate(entities, intentAnalysis, 'test');
        const dag = result.dag!;

        expect(dag.tasks[0].type).toBe('retrieve');
        expect(dag.tasks[0].params.filters?.year).toBe(2024);
        expect(dag.tasks[1].type).toBe('evaluate');
        expect(dag.tasks[2].type).toBe('generate_answer');
      });
    });

    describe('drug_contraindication template', () => {
      it('should match drug contraindication template', () => {
        const entities = createTestEntities({
          drugs: [{ id: 'drug_1', canonicalName: '二甲双胍', matchedTerm: '二甲双胍', aliases: [], classification: { category: '降糖药', subcategory: '胰岛素增敏剂' } }],
          rawQuery: '二甲双胍禁忌症',
        });

        const intentAnalysis = createIntentAnalysis({
          specialNeeds: { checkContraindication: true },
        });

        const result = matchTemplate(entities, intentAnalysis, '二甲双胍禁忌症');
        expect(result.matched).toBe(true);
        expect(result.templateId).toBe('drug_contraindication');
      });

      it('should NOT match when multiple drugs', () => {
        const entities = createTestEntities({
          drugs: [
            { id: 'drug_1', canonicalName: '二甲双胍', matchedTerm: '二甲双胍', aliases: [], classification: { category: '降糖药', subcategory: '胰岛素增敏剂' } },
            { id: 'drug_2', canonicalName: '利拉鲁肽', matchedTerm: '利拉鲁肽', aliases: [], classification: { category: '降糖药', subcategory: 'GLP-1受体激动剂' } },
          ],
        });

        const intentAnalysis = createIntentAnalysis({
          specialNeeds: { checkContraindication: true },
        });

        const result = matchTemplate(entities, intentAnalysis, 'test');
        expect(result.matched).toBe(false);
      });

      it('should NOT match when indicator present', () => {
        const entities = createTestEntities({
          drugs: [{ id: 'drug_1', canonicalName: '二甲双胍', matchedTerm: '二甲双胍', aliases: [], classification: { category: '降糖药', subcategory: '胰岛素增敏剂' } }],
          indicators: [{ id: 'indicator_1', canonicalName: 'eGFR', matchedTerm: 'eGFR', unit: 'mL/min/1.73m²' }],
        });

        const intentAnalysis = createIntentAnalysis({
          specialNeeds: { checkContraindication: true },
        });

        const result = matchTemplate(entities, intentAnalysis, 'test');
        expect(result.matched).toBe(false);
      });

      it('should generate correct DAG with check_contraindication task', () => {
        const entities = createTestEntities({
          drugs: [{ id: 'drug_metformin', canonicalName: '二甲双胍', matchedTerm: '二甲双胍', aliases: [], classification: { category: '降糖药', subcategory: '胰岛素增敏剂' } }],
        });

        const intentAnalysis = createIntentAnalysis({
          specialNeeds: { checkContraindication: true },
        });

        const result = matchTemplate(entities, intentAnalysis, 'test');
        const dag = result.dag!;

        expect(dag.tasks.find(t => t.type === 'check_contraindication')).toBeDefined();
        expect(dag.tasks.find(t => t.type === 'check_contraindication')?.params.drug).toBe('drug_metformin');
      });
    });

    describe('drug_comparison template', () => {
      it('should match drug comparison template', () => {
        const entities = createTestEntities({
          drugs: [
            { id: 'drug_1', canonicalName: '二甲双胍', matchedTerm: '二甲双胍', aliases: [], classification: { category: '降糖药', subcategory: '胰岛素增敏剂' } },
            { id: 'drug_2', canonicalName: '利拉鲁肽', matchedTerm: '利拉鲁肽', aliases: [], classification: { category: '降糖药', subcategory: 'GLP-1受体激动剂' } },
          ],
        });

        const intentAnalysis = createIntentAnalysis({
          queryTypes: ['comparison'],
        });

        const result = matchTemplate(entities, intentAnalysis, '二甲双胍vs利拉鲁肽');
        expect(result.matched).toBe(true);
        expect(result.templateId).toBe('drug_comparison');
      });

      it('should generate DAG with parallel retrieval group', () => {
        const entities = createTestEntities({
          drugs: [
            { id: 'drug_1', canonicalName: '二甲双胍', matchedTerm: '二甲双胍', aliases: [], classification: { category: '降糖药', subcategory: '胰岛素增敏剂' } },
            { id: 'drug_2', canonicalName: '利拉鲁肽', matchedTerm: '利拉鲁肽', aliases: [], classification: { category: '降糖药', subcategory: 'GLP-1受体激动剂' } },
          ],
        });

        const intentAnalysis = createIntentAnalysis({
          queryTypes: ['comparison'],
        });

        const result = matchTemplate(entities, intentAnalysis, 'test');
        const dag = result.dag!;

        expect(dag.parallelGroups.length).toBe(1);
        expect(dag.tasks.filter(t => t.parallelGroup).length).toBe(2);
        expect(dag.tasks.find(t => t.id === 'compare_drugs')).toBeDefined();
      });

      it('should have correct dependencies for comparison', () => {
        const entities = createTestEntities({
          drugs: [
            { id: 'drug_1', canonicalName: '二甲双胍', matchedTerm: '二甲双胍', aliases: [], classification: { category: '降糖药', subcategory: '胰岛素增敏剂' } },
            { id: 'drug_2', canonicalName: '利拉鲁肽', matchedTerm: '利拉鲁肽', aliases: [], classification: { category: '降糖药', subcategory: 'GLP-1受体激动剂' } },
          ],
        });

        const intentAnalysis = createIntentAnalysis({
          queryTypes: ['comparison'],
        });

        const result = matchTemplate(entities, intentAnalysis, 'test');
        const dag = result.dag!;

        const compareTask = dag.tasks.find(t => t.id === 'compare_drugs')!;
        expect(compareTask.dependencies).toContain('retrieve_drug_1');
        expect(compareTask.dependencies).toContain('retrieve_drug_2');
      });
    });

    describe('indicator_drug_query template', () => {
      it('should match indicator drug query template', () => {
        const entities = createTestEntities({
          drugs: [{ id: 'drug_1', canonicalName: '二甲双胍', matchedTerm: '二甲双胍', aliases: [], classification: { category: '降糖药', subcategory: '胰岛素增敏剂' } }],
          indicators: [{ id: 'indicator_1', canonicalName: 'eGFR', matchedTerm: 'eGFR', unit: 'mL/min/1.73m²', value: 35 }],
        });

        const intentAnalysis = createIntentAnalysis({
          specialNeeds: { checkContraindication: true },
        });

        const result = matchTemplate(entities, intentAnalysis, 'eGFR=35能否使用二甲双胍');
        expect(result.matched).toBe(true);
        expect(result.templateId).toBe('indicator_drug_query');
      });

      it('should generate DAG with calculate_indicator task', () => {
        const entities = createTestEntities({
          drugs: [{ id: 'drug_metformin', canonicalName: '二甲双胍', matchedTerm: '二甲双胍', aliases: [], classification: { category: '降糖药', subcategory: '胰岛素增敏剂' } }],
          indicators: [{ id: 'indicator_egfr', canonicalName: 'eGFR', matchedTerm: 'eGFR', unit: 'mL/min/1.73m²', value: 35 }],
        });

        const intentAnalysis = createIntentAnalysis({
          specialNeeds: { checkContraindication: true },
        });

        const result = matchTemplate(entities, intentAnalysis, 'test');
        const dag = result.dag!;

        const calcTask = dag.tasks.find(t => t.type === 'calculate_indicator');
        expect(calcTask).toBeDefined();
        expect(calcTask?.params.indicator).toBe('indicator_egfr');
        expect(calcTask?.params.value).toBe(35);
      });

      it('should generate DAG with parallel retrieval', () => {
        const entities = createTestEntities({
          drugs: [{ id: 'drug_1', canonicalName: '二甲双胍', matchedTerm: '二甲双胍', aliases: [], classification: { category: '降糖药', subcategory: '胰岛素增敏剂' } }],
          indicators: [{ id: 'indicator_1', canonicalName: 'eGFR', matchedTerm: 'eGFR', unit: 'mL/min/1.73m²', value: 35 }],
        });

        const intentAnalysis = createIntentAnalysis({
          specialNeeds: { checkContraindication: true },
        });

        const result = matchTemplate(entities, intentAnalysis, 'test');
        const dag = result.dag!;

        expect(dag.parallelGroups.length).toBe(1);
        expect(dag.tasks.filter(t => t.type === 'retrieve').length).toBe(2);
      });
    });

    describe('no-match fallback', () => {
      it('should return no match for unmatched patterns', () => {
        const entities = createTestEntities({
          diseases: [{ id: 'disease_1', canonicalName: '糖尿病', matchedTerm: '糖尿病', aliases: [] }],
        });

        const intentAnalysis = createIntentAnalysis();

        const result = matchTemplate(entities, intentAnalysis, '糖尿病症状');
        expect(result.matched).toBe(false);
        expect(result.templateId).toBeUndefined();
        expect(result.dag).toBeUndefined();
      });

      it('should not match simple information query', () => {
        const entities = createTestEntities({
          drugs: [{ id: 'drug_1', canonicalName: '二甲双胍', matchedTerm: '二甲双胍', aliases: [], classification: { category: '降糖药', subcategory: '胰岛素增敏剂' } }],
        });

        const intentAnalysis = createIntentAnalysis({
          queryTypes: ['information_query'],
        });

        const result = matchTemplate(entities, intentAnalysis, '二甲双胍的作用机制');
        expect(result.matched).toBe(false);
      });
    });
  });

  describe('STRUCTURED_TEMPLATES', () => {
    it('should have 4 base templates', () => {
      expect(STRUCTURED_TEMPLATES.length).toBe(4);
    });

    it('should have correct template IDs', () => {
      const ids = STRUCTURED_TEMPLATES.map(t => t.id);
      expect(ids).toContain('guideline_year_filter');
      expect(ids).toContain('drug_contraindication');
      expect(ids).toContain('drug_comparison');
      expect(ids).toContain('indicator_drug_query');
    });

    it('should have matchCriteria and generateDAG for each template', () => {
      for (const template of STRUCTURED_TEMPLATES) {
        expect(template.matchCriteria).toBeDefined();
        expect(template.generateDAG).toBeDefined();
      }
    });
  });

  describe('createTemplateMatcher', () => {
    it('should create matcher with match function', () => {
      const matcher = createTemplateMatcher();
      expect(matcher.match).toBeDefined();
      expect(matcher.getTemplates).toBeDefined();
    });

    it('should return templates via getTemplates', () => {
      const matcher = createTemplateMatcher();
      const templates = matcher.getTemplates();
      expect(templates.length).toBe(4);
    });
  });

  describe('template DAG structure', () => {
    it('should generate DAG with valid task structure', () => {
      const entities = createTestEntities({
        drugs: [
          { id: 'drug_1', canonicalName: '二甲双胍', matchedTerm: '二甲双胍', aliases: [], classification: { category: '降糖药', subcategory: '胰岛素增敏剂' } },
          { id: 'drug_2', canonicalName: '利拉鲁肽', matchedTerm: '利拉鲁肽', aliases: [], classification: { category: '降糖药', subcategory: 'GLP-1受体激动剂' } },
        ],
      });

      const intentAnalysis = createIntentAnalysis({
        queryTypes: ['comparison'],
      });

      const result = matchTemplate(entities, intentAnalysis, 'test');
      const dag = result.dag!;

      // Check task structure
      for (const task of dag.tasks) {
        expect(task.id).toBeDefined();
        expect(task.type).toBeDefined();
        expect(task.params).toBeDefined();
        expect(task.priority).toBeGreaterThanOrEqual(1);
        expect(task.priority).toBeLessThanOrEqual(7);
      }

      // Check DAG metadata
      expect(dag.entryTasks).toBeDefined();
      expect(dag.exitTasks).toBeDefined();
      expect(dag.parallelGroups).toBeDefined();
    });

    it('should have correct task counts', () => {
      // 指南年份过滤: 3 tasks
      const entities1 = createTestEntities({
        diseases: [{ id: 'disease_1', canonicalName: '糖尿病', matchedTerm: '糖尿病', aliases: [] }],
      });
      const intentAnalysis1 = createIntentAnalysis({
        specialNeeds: { requireYearFilter: true, yearValue: 2024 },
      });
      const result1 = matchTemplate(entities1, intentAnalysis1, 'test');
      expect(result1.dag?.tasks.length).toBe(3);

      // 药物对比: 5 tasks (2 retrieve + compare + answer)
      const entities2 = createTestEntities({
        drugs: [
          { id: 'drug_1', canonicalName: '二甲双胍', matchedTerm: '二甲双胍', aliases: [], classification: { category: '降糖药', subcategory: '胰岛素增敏剂' } },
          { id: 'drug_2', canonicalName: '利拉鲁肽', matchedTerm: '利拉鲁肽', aliases: [], classification: { category: '降糖药', subcategory: 'GLP-1受体激动剂' } },
        ],
      });
      const intentAnalysis2 = createIntentAnalysis({
        queryTypes: ['comparison'],
      });
      const result2 = matchTemplate(entities2, intentAnalysis2, 'test');
      expect(result2.dag?.tasks.length).toBe(5);

      // 指标药物查询: 5 tasks (2 retrieve + calculate + check + answer)
      const entities3 = createTestEntities({
        drugs: [{ id: 'drug_1', canonicalName: '二甲双胍', matchedTerm: '二甲双胍', aliases: [], classification: { category: '降糖药', subcategory: '胰岛素增敏剂' } }],
        indicators: [{ id: 'indicator_1', canonicalName: 'eGFR', matchedTerm: 'eGFR', unit: 'mL/min/1.73m²', value: 35 }],
      });
      const intentAnalysis3 = createIntentAnalysis({
        specialNeeds: { checkContraindication: true },
      });
      const result3 = matchTemplate(entities3, intentAnalysis3, 'test');
      expect(result3.dag?.tasks.length).toBe(5);
    });
  });
});