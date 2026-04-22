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

    // 新增：疾病用药建议模板测试
    describe('disease_drug_recommendation template', () => {
      it('should match disease drug recommendation template', () => {
        const entities = createTestEntities({
          diseases: [{ id: 'disease_diabetes_type2', canonicalName: '2型糖尿病', matchedTerm: '糖尿病', aliases: [] }],
          rawQuery: '糖尿病用什么药',
        });

        const intentAnalysis = createIntentAnalysis({
          queryTypes: ['decision_support'],
          expectedAnswerFormat: 'recommendation',
        });

        const result = matchTemplate(entities, intentAnalysis, '糖尿病用什么药');
        expect(result.matched).toBe(true);
        expect(result.templateId).toBe('disease_drug_recommendation');
      });

      it('should NOT match when drugs are specified', () => {
        const entities = createTestEntities({
          diseases: [{ id: 'disease_diabetes_type2', canonicalName: '2型糖尿病', matchedTerm: '糖尿病', aliases: [] }],
          drugs: [{ id: 'drug_metformin', canonicalName: '二甲双胍', matchedTerm: '二甲双胍', aliases: [], classification: { category: '降糖药', subcategory: '胰岛素增敏剂' } }],
          rawQuery: '糖尿病二甲双胍用什么药',
        });

        const intentAnalysis = createIntentAnalysis({
          queryTypes: ['decision_support'],
        });

        const result = matchTemplate(entities, intentAnalysis, 'test');
        // 有药物时不匹配用药建议模板
        expect(result.templateId).not.toBe('disease_drug_recommendation');
      });

      it('should NOT match without decision_support query type', () => {
        const entities = createTestEntities({
          diseases: [{ id: 'disease_diabetes_type2', canonicalName: '2型糖尿病', matchedTerm: '糖尿病', aliases: [] }],
        });

        const intentAnalysis = createIntentAnalysis({
          queryTypes: ['information_query'], // 不是决策支持
        });

        const result = matchTemplate(entities, intentAnalysis, 'test');
        expect(result.templateId).not.toBe('disease_drug_recommendation');
      });

      it('should generate DAG with parallel retrieval', () => {
        const entities = createTestEntities({
          diseases: [{ id: 'disease_diabetes_type2', canonicalName: '2型糖尿病', matchedTerm: '糖尿病', aliases: [] }],
        });

        const intentAnalysis = createIntentAnalysis({
          queryTypes: ['decision_support'],
          expectedAnswerFormat: 'recommendation',
        });

        const result = matchTemplate(entities, intentAnalysis, 'test');
        const dag = result.dag!;

        expect(dag.parallelGroups.length).toBe(1);
        expect(dag.tasks.filter(t => t.type === 'retrieve').length).toBe(2);
        expect(dag.tasks.find(t => t.id === 'retrieve_treatment')).toBeDefined();
        expect(dag.tasks.find(t => t.id === 'retrieve_guidelines')).toBeDefined();
      });

      it('should generate DAG with recommendation format answer', () => {
        const entities = createTestEntities({
          diseases: [{ id: 'disease_diabetes_type2', canonicalName: '2型糖尿病', matchedTerm: '糖尿病', aliases: [] }],
        });

        const intentAnalysis = createIntentAnalysis({
          queryTypes: ['decision_support'],
          expectedAnswerFormat: 'recommendation',
        });

        const result = matchTemplate(entities, intentAnalysis, 'test');
        const dag = result.dag!;

        const answerTask = dag.tasks.find(t => t.type === 'generate_answer');
        expect(answerTask).toBeDefined();
        expect(answerTask?.params.format).toBe('recommendation');
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
        // 注意：decision_support_with_indicator 模板优先级更高
        expect(result.matched).toBe(true);
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

    // 新增：decision_support_with_indicator 模板测试
    describe('decision_support_with_indicator template', () => {
      it('should match decision_support_with_indicator template', () => {
        const entities = createTestEntities({
          drugs: [{ id: 'drug_1', canonicalName: '二甲双胍', matchedTerm: '二甲双胍', aliases: [], classification: { category: '降糖药', subcategory: '胰岛素增敏剂' } }],
          indicators: [{ id: 'indicator_1', canonicalName: 'eGFR', matchedTerm: 'eGFR', unit: 'mL/min/1.73m²', value: 35 }],
        });

        const intentAnalysis = createIntentAnalysis({
          queryTypes: ['decision_support', 'safety_check'],
          specialNeeds: { checkContraindication: true },
        });

        const result = matchTemplate(entities, intentAnalysis, 'eGFR=35能否使用二甲双胍');
        expect(result.matched).toBe(true);
        expect(result.templateId).toBe('decision_support_with_indicator');
      });

      it('should NOT match without decision_support query type', () => {
        const entities = createTestEntities({
          drugs: [{ id: 'drug_1', canonicalName: '二甲双胍', matchedTerm: '二甲双胍', aliases: [], classification: { category: '降糖药', subcategory: '胰岛素增敏剂' } }],
          indicators: [{ id: 'indicator_1', canonicalName: 'eGFR', matchedTerm: 'eGFR', unit: 'mL/min/1.73m²', value: 35 }],
        });

        const intentAnalysis = createIntentAnalysis({
          queryTypes: ['safety_check'], // 没有 decision_support
          specialNeeds: { checkContraindication: true },
        });

        const result = matchTemplate(entities, intentAnalysis, 'test');
        expect(result.matched).toBe(true);
        expect(result.templateId).toBe('indicator_drug_query'); // 使用另一个模板
      });

      it('should NOT match without indicator value', () => {
        const entities = createTestEntities({
          drugs: [{ id: 'drug_1', canonicalName: '二甲双胍', matchedTerm: '二甲双胍', aliases: [], classification: { category: '降糖药', subcategory: '胰岛素增敏剂' } }],
          indicators: [{ id: 'indicator_1', canonicalName: 'eGFR', matchedTerm: 'eGFR', unit: 'mL/min/1.73m²' }], // 无 value
        });

        const intentAnalysis = createIntentAnalysis({
          queryTypes: ['decision_support'],
          specialNeeds: { checkContraindication: true },
        });

        const result = matchTemplate(entities, intentAnalysis, 'test');
        expect(result.matched).toBe(false);
      });

      it('should have priority over indicator_drug_query', () => {
        const entities = createTestEntities({
          drugs: [{ id: 'drug_1', canonicalName: '二甲双胍', matchedTerm: '二甲双胍', aliases: [], classification: { category: '降糖药', subcategory: '胰岛素增敏剂' } }],
          indicators: [{ id: 'indicator_1', canonicalName: 'eGFR', matchedTerm: 'eGFR', unit: 'mL/min/1.73m²', value: 35 }],
        });

        // 同时满足 decision_support_with_indicator 和 indicator_drug_query 的条件
        const intentAnalysis = createIntentAnalysis({
          queryTypes: ['decision_support', 'safety_check'],
          specialNeeds: { checkContraindication: true },
        });

        const result = matchTemplate(entities, intentAnalysis, 'eGFR=35能否使用二甲双胍');
        expect(result.matched).toBe(true);
        expect(result.templateId).toBe('decision_support_with_indicator'); // 优先级更高
      });

      it('should generate DAG with recommendation format', () => {
        const entities = createTestEntities({
          drugs: [{ id: 'drug_1', canonicalName: '二甲双胍', matchedTerm: '二甲双胍', aliases: [], classification: { category: '降糖药', subcategory: '胰岛素增敏剂' } }],
          indicators: [{ id: 'indicator_1', canonicalName: 'eGFR', matchedTerm: 'eGFR', unit: 'mL/min/1.73m²', value: 35 }],
        });

        const intentAnalysis = createIntentAnalysis({
          queryTypes: ['decision_support', 'safety_check'],
          specialNeeds: { checkContraindication: true },
        });

        const result = matchTemplate(entities, intentAnalysis, 'test');
        const dag = result.dag!;

        const answerTask = dag.tasks.find(t => t.type === 'generate_answer');
        expect(answerTask).toBeDefined();
        expect(answerTask?.params.format).toBe('recommendation');
      });
    });

    // 新增：模板尝试记录测试
    describe('template attempts logging', () => {
      it('should record template attempts', () => {
        const entities = createTestEntities({
          drugs: [{ id: 'drug_1', canonicalName: '二甲双胍', matchedTerm: '二甲双胍', aliases: [], classification: { category: '降糖药', subcategory: '胰岛素增敏剂' } }],
          indicators: [{ id: 'indicator_1', canonicalName: 'eGFR', matchedTerm: 'eGFR', unit: 'mL/min/1.73m²', value: 35 }],
        });

        const intentAnalysis = createIntentAnalysis({
          queryTypes: ['decision_support', 'safety_check'],
          specialNeeds: { checkContraindication: true },
        });

        const result = matchTemplate(entities, intentAnalysis, 'test');
        expect(result.attempts).toBeDefined();
        // matchTemplate 只记录到匹配为止，不继续记录后面的模板
        expect(result.attempts?.length).toBeGreaterThanOrEqual(1);
        expect(result.attempts?.length).toBeLessThanOrEqual(5);
      });

      it('should record matched template in attempts', () => {
        const entities = createTestEntities({
          drugs: [{ id: 'drug_1', canonicalName: '二甲双胍', matchedTerm: '二甲双胍', aliases: [], classification: { category: '降糖药', subcategory: '胰岛素增敏剂' } }],
          indicators: [{ id: 'indicator_1', canonicalName: 'eGFR', matchedTerm: 'eGFR', unit: 'mL/min/1.73m²', value: 35 }],
        });

        const intentAnalysis = createIntentAnalysis({
          queryTypes: ['decision_support', 'safety_check'],
          specialNeeds: { checkContraindication: true },
        });

        const result = matchTemplate(entities, intentAnalysis, 'test');
        const matchedAttempt = result.attempts?.find(a => a.matched);
        expect(matchedAttempt).toBeDefined();
        expect(matchedAttempt?.templateId).toBe('decision_support_with_indicator');
      });

      it('should record rejection reasons for failed templates', () => {
        const entities = createTestEntities({
          drugs: [{ id: 'drug_1', canonicalName: '二甲双胍', matchedTerm: '二甲双胍', aliases: [], classification: { category: '降糖药', subcategory: '胰岛素增敏剂' } }],
          indicators: [{ id: 'indicator_1', canonicalName: 'eGFR', matchedTerm: 'eGFR', unit: 'mL/min/1.73m²', value: 35 }],
        });

        const intentAnalysis = createIntentAnalysis({
          queryTypes: ['decision_support', 'safety_check'],
          specialNeeds: { checkContraindication: true },
        });

        const result = matchTemplate(entities, intentAnalysis, 'test');
        const failedAttempts = result.attempts?.filter(a => !a.matched);
        expect(failedAttempts?.length).toBeGreaterThan(0);

        for (const attempt of failedAttempts ?? []) {
          expect(attempt.rejectionReason).toBeDefined();
        }
      });

      it('should record attempts even when no match', () => {
        const entities = createTestEntities({
          diseases: [{ id: 'disease_1', canonicalName: '糖尿病', matchedTerm: '糖尿病', aliases: [] }],
        });

        const intentAnalysis = createIntentAnalysis();

        const result = matchTemplate(entities, intentAnalysis, '糖尿病症状');
        expect(result.matched).toBe(false);
        expect(result.attempts).toBeDefined();
        // 无匹配时应该记录所有模板
        expect(result.attempts?.length).toBe(6);
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
    it('should have 6 templates', () => {
      expect(STRUCTURED_TEMPLATES.length).toBe(6);
    });

    it('should have correct template IDs', () => {
      const ids = STRUCTURED_TEMPLATES.map(t => t.id);
      expect(ids).toContain('disease_drug_recommendation'); // 新增
      expect(ids).toContain('guideline_year_filter');
      expect(ids).toContain('drug_contraindication');
      expect(ids).toContain('drug_comparison');
      expect(ids).toContain('decision_support_with_indicator'); // 新增
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
      expect(templates.length).toBe(6);
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

      // 药物对比: 4 tasks (2 retrieve + compare + answer)
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
      expect(result2.dag?.tasks.length).toBe(4);

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