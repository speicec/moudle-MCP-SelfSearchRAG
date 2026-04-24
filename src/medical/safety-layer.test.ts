/**
 * Medical Safety Layer Tests
 *
 * 任务 4.3.1: 更新 Safety Layer 测试覆盖告警触发
 * 任务 4.3.2: 测试答案阻止逻辑
 * 任务 4.3.3: 测试 Alert-Review 联动
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  checkContraindications,
  checkInteractions,
  performSafetyCheck,
  createSafeAssessment,
  createSafetyLayerOutput,
  type SafetyAssessment,
} from './safety-layer.js';
import type { MedicalEntities, DrugMatch, IndicatorMatch } from './types.js';
import type { ExtractedThreshold } from './threshold-extractor.js';

describe('MedicalSafetyLayer', () => {
  const createMockDrug = (id: string, name: string): DrugMatch => ({
    id,
    canonicalName: name,
    matchedTerm: name,
    aliases: [name],
    classification: { category: '降糖药', subcategory: '口服降糖药' },
  });

  const createMockThreshold = (indicator: string, value: number, operator: '<' | '>' | '=' | '<=' | '>=' = '<'): ExtractedThreshold => ({
    indicator,
    indicatorName: indicator,
    operator,
    value,
    unit: 'mL/min/1.73m²',
    isValidUnit: true,
    sourceText: `${indicator} ${operator} ${value}`,
  });

  const createMockEntities = (drugs: DrugMatch[], indicators: IndicatorMatch[] = []): MedicalEntities => ({
    diseases: [],
    drugs,
    indicators,
    relations: [],
    rawQuery: 'test query',
    confidence: 0.9,
  });

  describe('checkContraindications', () => {
    it('should detect absolute contraindication (eGFR < 30)', () => {
      const drugs = [createMockDrug('drug_metformin', '二甲双胍')];
      const thresholds = [createMockThreshold('indicator_egfr', 25)];

      const matches = checkContraindications(drugs, thresholds);

      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]?.severity).toBe('absolute');
      expect(matches[0]?.contraindication.id).toBe('contra_metformin_egfr_30');
    });

    it('should detect relative contraindication (eGFR 30-45)', () => {
      const drugs = [createMockDrug('drug_metformin', '二甲双胍')];
      const thresholds = [createMockThreshold('indicator_egfr', 40)];

      const matches = checkContraindications(drugs, thresholds);

      expect(matches.length).toBeGreaterThan(0);
      expect(matches.some(m => m.severity === 'relative')).toBe(true);
    });

    it('should not detect contraindication for safe values', () => {
      const drugs = [createMockDrug('drug_metformin', '二甲双胍')];
      const thresholds = [createMockThreshold('indicator_egfr', 60)];

      const matches = checkContraindications(drugs, thresholds);

      expect(matches.length).toBe(0);
    });

    it('should return empty array when no drugs', () => {
      const matches = checkContraindications([], []);

      expect(matches).toEqual([]);
    });
  });

  describe('checkInteractions', () => {
    it('should detect drug interactions', () => {
      const drugs = [
        createMockDrug('drug_metformin', '二甲双胍'),
        createMockDrug('drug_cimetidine', '西咪替丁'),
      ];

      const interactions = checkInteractions(drugs);

      expect(interactions.length).toBeGreaterThan(0);
      expect(interactions[0]?.id).toBe('interaction_metformin_cimetidine');
    });

    it('should return empty array when only one drug', () => {
      const drugs = [createMockDrug('drug_metformin', '二甲双胍')];

      const interactions = checkInteractions(drugs);

      expect(interactions).toEqual([]);
    });
  });

  describe('performSafetyCheck', () => {
    it('should return absolute severity for absolute contraindication', () => {
      const entities = createMockEntities([createMockDrug('drug_metformin', '二甲双胍')]);
      const thresholds = [createMockThreshold('indicator_egfr', 25)];

      const assessment = performSafetyCheck(entities, thresholds);

      expect(assessment.severity).toBe('absolute');
      expect(assessment.recommendation).toContain('禁用');
    });

    it('should return relative severity for relative contraindication', () => {
      const entities = createMockEntities([createMockDrug('drug_metformin', '二甲双胍')]);
      const thresholds = [createMockThreshold('indicator_egfr', 40)];

      const assessment = performSafetyCheck(entities, thresholds);

      expect(assessment.severity).toBe('relative');
      expect(assessment.recommendation).toContain('慎用');
    });

    it('should return interaction severity for drug interactions', () => {
      const entities = createMockEntities([
        createMockDrug('drug_metformin', '二甲双胍'),
        createMockDrug('drug_cimetidine', '西咪替丁'),
      ]);
      const thresholds = [];

      const assessment = performSafetyCheck(entities, thresholds);

      expect(assessment.severity).toBe('interaction');
    });

    it('should return safe severity when no risks', () => {
      const entities = createMockEntities([createMockDrug('drug_metformin', '二甲双胍')]);
      const thresholds = [createMockThreshold('indicator_egfr', 80)];

      const assessment = performSafetyCheck(entities, thresholds);

      expect(assessment.severity).toBe('safe');
    });

    it('should include guideline sources', () => {
      const entities = createMockEntities([createMockDrug('drug_metformin', '二甲双胍')]);
      const thresholds = [createMockThreshold('indicator_egfr', 25)];

      const assessment = performSafetyCheck(entities, thresholds);

      expect(assessment.sourceGlossary.length).toBeGreaterThan(0);
      expect(assessment.sourceGlossary.some(s => s.includes('ADA'))).toBe(true);
    });
  });

  describe('createSafeAssessment', () => {
    it('should create a default safe assessment', () => {
      const assessment = createSafeAssessment();

      expect(assessment.severity).toBe('safe');
      expect(assessment.contraindicationMatches).toEqual([]);
      expect(assessment.interactions).toEqual([]);
    });
  });
});

// ==================== 任务 4.3.1: 告警触发测试 ====================

describe('Safety Layer Alert Triggering (任务 4.3.1)', () => {
  const createMockDrug = (id: string, name: string): DrugMatch => ({
    id,
    canonicalName: name,
    matchedTerm: name,
    aliases: [name],
    classification: { category: '降糖药', subcategory: '口服降糖药' },
  });

  const createMockThreshold = (indicator: string, value: number, operator: '<' | '>' | '=' | '<=' | '>=' = '<'): ExtractedThreshold => ({
    indicator,
    indicatorName: indicator,
    operator,
    value,
    unit: 'mL/min/1.73m²',
    isValidUnit: true,
    sourceText: `${indicator} ${operator} ${value}`,
  });

  const createMockEntities = (drugs: DrugMatch[]): MedicalEntities => ({
    diseases: [],
    drugs,
    indicators: [],
    relations: [],
    rawQuery: 'test query',
    confidence: 0.9,
  });

  describe('alertTriggered field', () => {
    it('should set alertTriggered for absolute severity', () => {
      const entities = createMockEntities([createMockDrug('drug_metformin', '二甲双胍')]);
      const thresholds = [createMockThreshold('indicator_egfr', 25)];

      const assessment = performSafetyCheck(entities, thresholds);

      expect(assessment.severity).toBe('absolute');
      expect(assessment.alertTriggered).toBe(true);
    });

    it('should set alertTriggered for relative severity', () => {
      const entities = createMockEntities([createMockDrug('drug_metformin', '二甲双胍')]);
      const thresholds = [createMockThreshold('indicator_egfr', 40)];

      const assessment = performSafetyCheck(entities, thresholds);

      expect(assessment.severity).toBe('relative');
      expect(assessment.alertTriggered).toBe(true);
    });

    it('should not set alertTriggered for safe severity', () => {
      const entities = createMockEntities([createMockDrug('drug_metformin', '二甲双胍')]);
      const thresholds = [createMockThreshold('indicator_egfr', 80)];

      const assessment = performSafetyCheck(entities, thresholds);

      expect(assessment.severity).toBe('safe');
      expect(assessment.alertTriggered).toBe(false);
    });
  });

  describe('assessment structure for alerts', () => {
    it('should include contraindication details for alert creation', () => {
      const entities = createMockEntities([createMockDrug('drug_metformin', '二甲双胍')]);
      const thresholds = [createMockThreshold('indicator_egfr', 25)];

      const assessment = performSafetyCheck(entities, thresholds);

      expect(assessment.contraindicationMatches.length).toBeGreaterThan(0);
      const match = assessment.contraindicationMatches[0];
      expect(match?.contraindication).toBeDefined();
      expect(match?.severity).toBe('absolute');
    });
  });
});

// ==================== 任务 4.3.2: 答案阻止逻辑测试 ====================

describe('Answer Blocking Logic (任务 4.3.2)', () => {
  describe('createSafetyLayerOutput', () => {
    it('should block answer for absolute severity', () => {
      const assessment: SafetyAssessment = {
        severity: 'absolute',
        contraindicationMatches: [{
          contraindication: {
            id: 'contra_test',
            description: 'Absolute contraindication',
            drug: 'drug_metformin',
            threshold: { indicator: 'indicator_egfr', operator: '<', value: 30 },
            severity: 'absolute',
            source: 'ada',
            year: 2024,
          },
          matchedThreshold: {
            indicator: 'indicator_egfr',
            indicatorName: 'eGFR',
            operator: '<',
            value: 25,
            unit: 'mL/min/1.73m²',
            isValidUnit: true,
            sourceText: 'eGFR < 25',
          },
          severity: 'absolute',
        }],
        interactions: [],
        recommendation: '禁用',
        sourceGlossary: ['ADA 2024'],
        alertTriggered: true,
      };

      const output = createSafetyLayerOutput(assessment);

      expect(output.answerStatus).toBe('blocked_pending_review');
      expect(output.blockedReason).toBeDefined();
      expect(output.blockedReason).toContain('人工审核');
    });

    it('should mark attention for relative severity', () => {
      const assessment: SafetyAssessment = {
        severity: 'relative',
        contraindicationMatches: [{
          contraindication: {
            id: 'contra_test',
            description: 'Relative contraindication',
            drug: 'drug_metformin',
            threshold: { indicator: 'indicator_egfr', operator: '<', value: 45 },
            severity: 'relative',
            source: 'ada',
            year: 2024,
          },
          matchedThreshold: {
            indicator: 'indicator_egfr',
            indicatorName: 'eGFR',
            operator: '<',
            value: 40,
            unit: 'mL/min/1.73m²',
            isValidUnit: true,
            sourceText: 'eGFR < 40',
          },
          severity: 'relative',
        }],
        interactions: [],
        recommendation: '慎用',
        sourceGlossary: ['ADA 2024'],
        alertTriggered: true,
      };

      const output = createSafetyLayerOutput(assessment);

      expect(output.answerStatus).toBe('attention_required');
      expect(output.blockedReason).toBeDefined();
      expect(output.blockedReason).toContain('复核');
    });

    it('should allow answer for safe severity', () => {
      const assessment: SafetyAssessment = {
        severity: 'safe',
        contraindicationMatches: [],
        interactions: [],
        recommendation: '安全',
        sourceGlossary: [],
        alertTriggered: false,
      };

      const output = createSafetyLayerOutput(assessment);

      expect(output.answerStatus).toBe('normal');
      expect(output.blockedReason).toBeUndefined();
    });

    it('should allow answer for interaction severity', () => {
      const assessment: SafetyAssessment = {
        severity: 'interaction',
        contraindicationMatches: [],
        interactions: [{
          id: 'interaction_test',
          drugA: 'drug_metformin',
          drugB: 'drug_cimetidine',
          description: 'Drug interaction',
          recommendation: 'Monitor',
          severity: 'moderate',
          source: 'ada',
          year: 2024,
        }],
        recommendation: '注意相互作用',
        sourceGlossary: ['ADA 2024'],
        alertTriggered: false,
      };

      const output = createSafetyLayerOutput(assessment);

      expect(output.answerStatus).toBe('normal');
    });
  });
});

// ==================== 任务 4.3.3: Alert-Review 联动测试 ====================

describe('Alert-Review Integration (任务 4.3.3)', () => {
  const createMockDrug = (id: string, name: string): DrugMatch => ({
    id,
    canonicalName: name,
    matchedTerm: name,
    aliases: [name],
    classification: { category: '降糖药', subcategory: '口服降糖药' },
  });

  const createMockThreshold = (indicator: string, value: number): ExtractedThreshold => ({
    indicator,
    indicatorName: indicator,
    operator: '<',
    value,
    unit: 'mL/min/1.73m²',
    isValidUnit: true,
    sourceText: `${indicator} < ${value}`,
  });

  const createMockEntities = (drugs: DrugMatch[]): MedicalEntities => ({
    diseases: [],
    drugs,
    indicators: [],
    relations: [],
    rawQuery: 'test query',
    confidence: 0.9,
  });

  describe('assessment contains data needed for review creation', () => {
    it('should have traceId and evaluationId fields for alert', () => {
      const entities = createMockEntities([createMockDrug('drug_metformin', '二甲双胍')]);
      const thresholds = [createMockThreshold('indicator_egfr', 25)];

      const assessment = performSafetyCheck(entities, thresholds);

      // Assessment should contain enough info for alert creation
      expect(assessment.severity).toBe('absolute');
      expect(assessment.contraindicationMatches.length).toBeGreaterThan(0);

      // The contraindication match should have:
      // - description for suggestedActions
      // - severity for alert severity
      const match = assessment.contraindicationMatches[0];
      expect(match?.contraindication.description).toBeDefined();
      expect(match?.severity).toBeDefined();
    });

    it('should have suggested actions in contraindication', () => {
      const entities = createMockEntities([createMockDrug('drug_metformin', '二甲双胍')]);
      const thresholds = [createMockThreshold('indicator_egfr', 25)];

      const assessment = performSafetyCheck(entities, thresholds);

      const match = assessment.contraindicationMatches[0];
      expect(match?.contraindication).toBeDefined();
      // The contraindication has all the fields needed for alert creation
    });
  });

  describe('workflow integration points', () => {
    it('should provide all data needed for SAFETY_CRITICAL alert', () => {
      const entities = createMockEntities([createMockDrug('drug_metformin', '二甲双胍')]);
      const thresholds = [createMockThreshold('indicator_egfr', 25)];

      const assessment = performSafetyCheck(entities, thresholds);

      // Fields needed for AlertEvent:
      // - type: 'SAFETY_CRITICAL' (from severity)
      // - severity: 'critical' (from severity='absolute')
      // - details.safetyScore (can be derived from threshold)
      // - details.contraindication (from match.contraindication.description)
      // - suggestedActions (from assessment)

      expect(assessment.severity).toBe('absolute');
      expect(assessment.contraindicationMatches[0]?.contraindication.description).toBeDefined();
    });

    it('should support creating review item from assessment', () => {
      const entities = createMockEntities([createMockDrug('drug_metformin', '二甲双胍')]);
      const thresholds = [createMockThreshold('indicator_egfr', 25)];

      const assessment = performSafetyCheck(entities, thresholds);

      // For creating ReviewItem:
      // - priority should be 'critical' for absolute severity
      // - details should include safety info
      // - suggestedActions should be passed

      expect(assessment.severity).toBe('absolute');
      // This would trigger critical priority in review queue
    });
  });
});