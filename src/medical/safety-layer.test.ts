/**
 * Medical Safety Layer Tests
 */

import { describe, it, expect } from 'vitest';
import {
  checkContraindications,
  checkInteractions,
  performSafetyCheck,
  createSafeAssessment,
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