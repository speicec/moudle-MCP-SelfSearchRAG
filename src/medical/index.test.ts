/**
 * End-to-End Tests - 端到端测试
 *
 * 测试完整医学查询流程
 */

import { describe, it, expect } from 'vitest';
import { extractMedicalEntities } from './entity-recognizer.js';
import { buildQueryStrategy } from './query-planner.js';
import { evaluateEvidence, calculateOverallGrade } from './evidence-evaluator.js';
import { generateMedicalAnswer, formatAnswerAsMarkdown } from './answer-generator.js';
import { processMedicalQuery } from './mcp-tool.js';
import type { MedicalQueryInput, SourceCitation } from './types.js';

describe('End-to-End Medical Query Flow', () => {
  describe('Scenario: Metformin eGFR Threshold Query', () => {
    it('should correctly process "二甲双胍肾功能阈值" query', () => {
      const input: MedicalQueryInput = {
        query: '二甲双胍肾功能不全时能不能用',
        domain: 'diabetes',
      };

      // Step 1: Process query
      const result = processMedicalQuery(input);

      // Step 2: Verify entities
      expect(result.entities.drugs.length).toBe(1);
      expect(result.entities.drugs[0].canonicalName).toBe('二甲双胍');

      // Step 3: Verify strategy
      expect(result.strategy.primaryQuery).toContain('二甲双胍');
      expect(result.strategy.filters.guidelineSources).toContain('ada');

      // Step 4: Verify answer structure
      expect(result.answer.conclusion).toBeDefined();
      expect(result.answer.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('Scenario: Diabetes + Hypertension Drug Selection', () => {
    it('should correctly process multi-disease query', () => {
      const input: MedicalQueryInput = {
        query: '糖尿病合并高血压怎么选药',
      };

      const result = processMedicalQuery(input);

      // Should recognize multiple diseases
      expect(result.entities.diseases.length).toBeGreaterThanOrEqual(2);

      // Should have expanded terms covering both conditions
      expect(result.strategy.expandedTerms.length).toBeGreaterThan(10);
    });
  });

  describe('Scenario: GLP-1 Drug Alias Recognition', () => {
    it('should recognize Ozempic as semaglutide', () => {
      const input: MedicalQueryInput = {
        query: 'Ozempic用法',
        domain: 'diabetes',
      };

      const result = processMedicalQuery(input);

      expect(result.entities.drugs.length).toBe(1);
      expect(result.entities.drugs[0].canonicalName).toBe('司美格鲁肽');
    });

    it('should recognize 诺和泰 as semaglutide', () => {
      const input: MedicalQueryInput = {
        query: '诺和泰注射',
      };

      const result = processMedicalQuery(input);

      expect(result.entities.drugs.length).toBe(1);
      expect(result.entities.drugs[0].canonicalName).toBe('司美格鲁肽');
    });
  });

  describe('Scenario: Thyroid Drug Query', () => {
    it('should process thyroid drug query correctly', () => {
      const input: MedicalQueryInput = {
        query: '甲亢患者甲巯咪唑用法',
        domain: 'thyroid',
      };

      const result = processMedicalQuery(input);

      // Should recognize disease
      expect(result.entities.diseases.some(d => d.id.includes('hyperthyroidism'))).toBe(true);

      // Should recognize drug
      expect(result.entities.drugs.length).toBe(1);
      expect(result.entities.drugs[0].canonicalName).toBe('甲巯咪唑');

      // Should prioritize ATA guideline
      expect(result.strategy.prioritySources.some(s => s.includes('ATA'))).toBe(true);
    });
  });

  describe('Scenario: Evidence Evaluation', () => {
    it('should evaluate ADA guideline as Grade B', () => {
      const source: SourceCitation = {
        documentName: 'ADA Standards of Care 2024',
        year: 2024,
        section: 'Section 9',
      };

      const evaluation = evaluateEvidence(source);

      expect(evaluation.literatureType).toBe('guideline');
      expect(evaluation.grade).toBe('B');
      expect(evaluation.isCurrent).toBe(true);
    });

    it('should evaluate outdated guideline with warning', () => {
      const source: SourceCitation = {
        documentName: 'ADA Standards of Care 2018',
        year: 2018,
      };

      const evaluation = evaluateEvidence(source);

      expect(evaluation.expirationWarning).toBeDefined();
    });

    it('should calculate overall grade correctly', () => {
      const evaluations = [
        evaluateEvidence({ documentName: 'RCT Study', year: 2023 }),
        evaluateEvidence({ documentName: 'Guideline', year: 2024 }),
      ];

      const overallGrade = calculateOverallGrade(evaluations);

      // Should take highest grade (A from RCT)
      expect(overallGrade).toBe('A');
    });
  });

  describe('Scenario: Answer Generation', () => {
    it('should generate structured answer with mock retrieval results', () => {
      const entities = extractMedicalEntities('二甲双胍禁忌症');

      const mockResults = [
        {
          content: '二甲双胍在eGFR<30时禁用，eGFR 30-45时慎用',
          source: {
            documentName: 'ADA Standards 2024',
            year: 2024,
            section: 'Section 9',
          } as SourceCitation,
        },
      ];

      const answer = generateMedicalAnswer(entities, mockResults);

      // Should have conclusion
      expect(answer.conclusion.text).toBeDefined();

      // Should have detail points
      expect(answer.details.points.length).toBeGreaterThan(0);

      // Should have evidence grade
      expect(answer.evidenceGrade.grade).toBeDefined();

      // Should have sources
      expect(answer.sources.length).toBe(1);

      // Should have warnings
      expect(answer.warnings.some(w => w.includes('仅供参考'))).toBe(true);
    });

    it('should format answer as markdown', () => {
      const entities = extractMedicalEntities('二甲双胍');
      const answer = generateMedicalAnswer(entities);
      const markdown = formatAnswerAsMarkdown(answer);

      expect(markdown).toContain('## 结论');
      expect(markdown).toContain('## 证据等级');
      expect(markdown).toContain('## 注意事项');
    });
  });

  describe('Scenario: No Entity Recognition', () => {
    it('should handle query with no recognized entities', () => {
      const input: MedicalQueryInput = {
        query: '今天天气怎么样',
      };

      const result = processMedicalQuery(input);

      // Should still return valid result
      expect(result.entities.diseases.length).toBe(0);
      expect(result.entities.drugs.length).toBe(0);

      // Answer should indicate no entities
      expect(result.answer.conclusion.text).toContain('未识别');
    });
  });

  describe('Scenario: Complex Clinical Query', () => {
    it('should process comprehensive clinical query', () => {
      const input: MedicalQueryInput = {
        query: '2型糖尿病合并高血压和慢性肾脏病3期，血压145/90，eGFR 35，HbA1c 7.5%，如何选择降压药和降糖药',
        domain: 'all',
        year_range: [2022, 2024],
        include_guidelines: true,
      };

      const result = processMedicalQuery(input);

      // Should recognize multiple diseases
      expect(result.entities.diseases.length).toBeGreaterThanOrEqual(3);

      // Should recognize multiple indicators
      expect(result.entities.indicators.length).toBeGreaterThanOrEqual(3);

      // Should have confidence
      expect(result.confidence).toBeGreaterThan(0);

      // Should use specified year range
      expect(result.strategy.filters.yearRange).toEqual([2022, 2024]);

      // Should include all guideline sources
      expect(result.strategy.filters.guidelineSources?.length).toBeGreaterThan(3);
    });
  });
});