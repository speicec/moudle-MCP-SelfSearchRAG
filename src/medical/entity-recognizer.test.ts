/**
 * Entity Recognizer Tests - 实体识别测试
 */

import { describe, it, expect } from 'vitest';
import {
  extractMedicalEntities,
  matchDiseases,
  matchDrugs,
  matchIndicators,
  matchRelations,
  expandEntityTerms,
} from './entity-recognizer.js';

describe('Entity Recognition', () => {
  describe('Single Entity Recognition', () => {
    it('should recognize single drug', () => {
      const result = extractMedicalEntities('二甲双胍禁忌症');
      expect(result.drugs.length).toBe(1);
      expect(result.drugs[0].canonicalName).toBe('二甲双胍');
    });

    it('should recognize single disease', () => {
      const result = extractMedicalEntities('糖尿病诊断标准');
      expect(result.diseases.length).toBe(1);
      expect(result.diseases[0].canonicalName).toBe('2型糖尿病');
    });

    it('should recognize single indicator', () => {
      const result = extractMedicalEntities('eGFR多少算正常');
      expect(result.indicators.length).toBe(1);
      expect(result.indicators[0].canonicalName).toBe('肾小球滤过率');
    });
  });

  describe('Alias Recognition', () => {
    it('should recognize drug by English alias', () => {
      const result = extractMedicalEntities('Metformin能不能用');
      expect(result.drugs.length).toBe(1);
      expect(result.drugs[0].canonicalName).toBe('二甲双胍');
    });

    it('should recognize drug by brand name', () => {
      const result = extractMedicalEntities('格华止禁忌');
      expect(result.drugs.length).toBe(1);
      expect(result.drugs[0].canonicalName).toBe('二甲双胍');
    });

    it('should recognize disease by abbreviation', () => {
      const result = extractMedicalEntities('T2DM患者用药');
      expect(result.diseases.length).toBe(1);
      expect(result.diseases[0].canonicalName).toBe('2型糖尿病');
    });

    it('should recognize indicator by abbreviation', () => {
      const result = extractMedicalEntities('HbA1c达标');
      expect(result.indicators.length).toBe(1);
      expect(result.indicators[0].canonicalName).toBe('糖化血红蛋白');
    });
  });

  describe('Multi-Entity Recognition', () => {
    it('should recognize drug and indicator', () => {
      const result = extractMedicalEntities('eGFR 30 二甲双胍');
      expect(result.drugs.length).toBe(1);
      expect(result.indicators.length).toBe(1);
      expect(result.drugs[0].canonicalName).toBe('二甲双胍');
      expect(result.indicators[0].canonicalName).toBe('肾小球滤过率');
    });

    it('should recognize multiple diseases', () => {
      const result = extractMedicalEntities('糖尿病高血压怎么选药');
      expect(result.diseases.length).toBeGreaterThanOrEqual(2);
    });

    it('should recognize complex query', () => {
      const result = extractMedicalEntities('糖尿病患者合并肾功能不全，二甲双胍是否还能用');
      expect(result.diseases.length).toBeGreaterThan(0);
      expect(result.drugs.length).toBeGreaterThan(0);
    });
  });

  describe('Relation Recognition', () => {
    it('should recognize contraindication relation', () => {
      const result = extractMedicalEntities('二甲双胍禁用');
      expect(result.relations.length).toBeGreaterThan(0);
      expect(result.relations[0].type).toBe('contraindication');
    });

    it('should recognize precaution relation', () => {
      const result = extractMedicalEntities('二甲双胍慎用');
      expect(result.relations.length).toBeGreaterThan(0);
      expect(result.relations[0].type).toBe('precaution');
    });

    it('should recognize indication relation', () => {
      const result = extractMedicalEntities('二甲双胍可以用');
      expect(result.relations.length).toBeGreaterThan(0);
      expect(result.relations[0].type).toBe('indication');
    });
  });

  describe('Confidence Calculation', () => {
    it('should have high confidence with multiple entities', () => {
      const result = extractMedicalEntities('糖尿病患者合并肾功能不全，二甲双胍是否还能用');
      expect(result.confidence).toBeGreaterThan(0.6);
    });

    it('should have lower confidence with single entity', () => {
      const result = extractMedicalEntities('二甲双胍');
      expect(result.confidence).toBeLessThan(0.8);
    });
  });
});

describe('Match Functions', () => {
  it('should match diseases correctly', () => {
    const matches = matchDiseases('糖尿病和高血压');
    expect(matches.length).toBeGreaterThan(0);
  });

  it('should match drugs correctly', () => {
    const matches = matchDrugs('二甲双胍和格华止');
    expect(matches.length).toBeGreaterThan(0);
  });

  it('should match indicators correctly', () => {
    const matches = matchIndicators('eGFR和HbA1c');
    expect(matches.length).toBeGreaterThan(0);
  });

  it('should match relations correctly', () => {
    const matches = matchRelations('禁用慎用');
    expect(matches.length).toBe(2);
  });
});

describe('Term Expansion', () => {
  it('should expand drug aliases', () => {
    const entities = extractMedicalEntities('二甲双胍');
    const expanded = expandEntityTerms(entities);
    expect(expanded).toContain('二甲双胍');
    expect(expanded).toContain('Metformin');
    expect(expanded).toContain('格华止');
  });

  it('should expand disease aliases', () => {
    const entities = extractMedicalEntities('T2DM');
    const expanded = expandEntityTerms(entities);
    expect(expanded).toContain('2型糖尿病');
    expect(expanded).toContain('糖尿病');
    expect(expanded).toContain('NIDDM');
  });

  it('should deduplicate expanded terms', () => {
    const entities = extractMedicalEntities('二甲双胍二甲双胍');
    const expanded = expandEntityTerms(entities);
    const metforminCount = expanded.filter(t => t === '二甲双胍').length;
    expect(metforminCount).toBe(1);
  });
});