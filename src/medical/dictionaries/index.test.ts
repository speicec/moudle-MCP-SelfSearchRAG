/**
 * Dictionary Tests - 词典测试
 */

import { describe, it, expect } from 'vitest';
import {
  ALL_DISEASES,
  getDiseaseById,
  getDiseaseByName,
} from './diseases.js';
import {
  ALL_ANTIDIABETIC_DRUGS,
  getAntidiabeticById,
  getAntidiabeticByName,
} from './drugs/antidiabetic.js';
import {
  ALL_ANTIHYPERTENSIVE_DRUGS,
  getAntihypertensiveById,
  getAntihypertensiveByName,
} from './drugs/antihypertensive.js';
import {
  ALL_INDICATORS,
  getIndicatorById,
  getIndicatorByName,
} from './indicators.js';
import {
  ALL_CONTRAINDICATIONS,
  getContraindicationsByDrug,
} from './relations.js';
import {
  findByAlias,
  getAllAliases,
} from './aliases.js';

describe('Disease Dictionary', () => {
  it('should contain diabetes diseases', () => {
    const diabetesDiseases = ALL_DISEASES.filter(d => d.id.includes('diabetes'));
    expect(diabetesDiseases.length).toBeGreaterThan(0);
  });

  it('should find disease by ID', () => {
    const disease = getDiseaseById('disease_diabetes_type2');
    expect(disease).toBeDefined();
    expect(disease?.canonicalName).toBe('2型糖尿病');
  });

  it('should find disease by name', () => {
    const disease = getDiseaseByName('T2DM');
    expect(disease).toBeDefined();
    expect(disease?.canonicalName).toBe('2型糖尿病');
  });

  it('should find disease by Chinese alias', () => {
    const disease = getDiseaseByName('糖尿病');
    expect(disease).toBeDefined();
  });

  it('should have proper aliases for diseases', () => {
    const disease = getDiseaseById('disease_diabetes_type2');
    expect(disease?.aliases).toContain('T2DM');
    expect(disease?.aliases).toContain('NIDDM');
    expect(disease?.aliases).toContain('2型DM');
  });
});

describe('Antidiabetic Drug Dictionary', () => {
  it('should contain metformin', () => {
    const metformin = getAntidiabeticById('drug_metformin');
    expect(metformin).toBeDefined();
    expect(metformin?.canonicalName).toBe('二甲双胍');
  });

  it('should find metformin by alias', () => {
    const metformin = getAntidiabeticByName('Metformin');
    expect(metformin).toBeDefined();
    expect(metformin?.canonicalName).toBe('二甲双胍');
  });

  it('should find metformin by brand name', () => {
    const metformin = getAntidiabeticByName('格华止');
    expect(metformin).toBeDefined();
  });

  it('should contain GLP-1 drugs', () => {
    const glp1Drugs = ALL_ANTIDIABETIC_DRUGS.filter(
      d => d.classification.subcategory === 'GLP-1受体激动剂'
    );
    expect(glp1Drugs.length).toBeGreaterThan(0);
  });

  it('should contain SGLT2 drugs', () => {
    const sglt2Drugs = ALL_ANTIDIABETIC_DRUGS.filter(
      d => d.classification.subcategory === 'SGLT2抑制剂'
    );
    expect(sglt2Drugs.length).toBeGreaterThan(0);
  });

  it('should have proper aliases for semaglutide', () => {
    const semaglutide = getAntidiabeticById('drug_semaglutide');
    expect(semaglutide?.aliases).toContain('司美格鲁肽');
    expect(semaglutide?.aliases).toContain('Ozempic');
    expect(semaglutide?.aliases).toContain('诺和泰');
  });
});

describe('Antihypertensive Drug Dictionary', () => {
  it('should contain ACEI drugs', () => {
    const aceiDrugs = ALL_ANTIHYPERTENSIVE_DRUGS.filter(
      d => d.classification.subcategory === 'ACEI'
    );
    expect(aceiDrugs.length).toBeGreaterThan(0);
  });

  it('should contain ARB drugs', () => {
    const arbDrugs = ALL_ANTIHYPERTENSIVE_DRUGS.filter(
      d => d.classification.subcategory === 'ARB'
    );
    expect(arbDrugs.length).toBeGreaterThan(0);
  });

  it('should find valsartan by name', () => {
    const valsartan = getAntihypertensiveByName('缬沙坦');
    expect(valsartan).toBeDefined();
    expect(valsartan?.canonicalName).toBe('缬沙坦');
  });

  it('should find amlodipine by brand', () => {
    const amlodipine = getAntihypertensiveByName('络活喜');
    expect(amlodipine).toBeDefined();
    expect(amlodipine?.canonicalName).toBe('氨氯地平');
  });
});

describe('Indicator Dictionary', () => {
  it('should contain eGFR indicator', () => {
    const egfr = getIndicatorById('indicator_egfr');
    expect(egfr).toBeDefined();
    expect(egfr?.canonicalName).toBe('肾小球滤过率');
    expect(egfr?.aliases).toContain('eGFR');
  });

  it('should contain HbA1c indicator', () => {
    const hba1c = getIndicatorById('indicator_hba1c');
    expect(hba1c).toBeDefined();
    expect(hba1c?.aliases).toContain('HbA1c');
    expect(hba1c?.aliases).toContain('A1C');
  });

  it('should have clinical thresholds for eGFR', () => {
    const egfr = getIndicatorById('indicator_egfr');
    expect(egfr?.clinicalThresholds).toBeDefined();
    expect(egfr?.clinicalThresholds.normal).toBeDefined();
    expect(egfr?.clinicalThresholds.critical).toBeDefined();
  });

  it('should find indicator by alias', () => {
    const indicator = getIndicatorByName('糖化');
    expect(indicator).toBeDefined();
    expect(indicator?.canonicalName).toBe('糖化血红蛋白');
  });
});

describe('Relation Dictionary', () => {
  it('should contain metformin-eGFR contraindications', () => {
    const contras = getContraindicationsByDrug('drug_metformin');
    expect(contras.length).toBeGreaterThan(0);

    const egfr30Contra = contras.find(c => c.id === 'contra_metformin_egfr_30');
    expect(egfr30Contra).toBeDefined();
    expect(egfr30Contra?.threshold?.value).toBe(30);
    expect(egfr30Contra?.severity).toBe('absolute');
  });

  it('should have proper threshold conditions', () => {
    const contras = getContraindicationsByDrug('drug_metformin');
    const egfr45Contra = contras.find(c => c.id === 'contra_metformin_egfr_45');

    expect(egfr45Contra).toBeDefined();
    expect(egfr45Contra?.severity).toBe('relative'); // 慎用，不是禁用
  });

  it('should contain SGLT2 contraindications', () => {
    const empagliflozinContras = getContraindicationsByDrug('drug_empagliflozin');
    expect(empagliflozinContras.length).toBeGreaterThan(0);
  });
});

describe('Alias Mapping', () => {
  it('should find entity by alias', () => {
    const mapping = findByAlias('二甲双胍');
    expect(mapping).toBeDefined();
    expect(mapping?.standardId).toBe('drug_metformin');
  });

  it('should find entity by English alias', () => {
    const mapping = findByAlias('Metformin');
    expect(mapping).toBeDefined();
    expect(mapping?.entityType).toBe('drug');
  });

  it('should find entity by abbreviation', () => {
    const mapping = findByAlias('T2DM');
    expect(mapping).toBeDefined();
    expect(mapping?.entityType).toBe('disease');
  });

  it('should get all aliases for entity', () => {
    const aliases = getAllAliases('drug_metformin');
    expect(aliases).toContain('二甲双胍');
    expect(aliases).toContain('Metformin');
    expect(aliases).toContain('格华止');
  });

  it('should handle case-insensitive lookup', () => {
    const mapping1 = findByAlias('metformin');
    const mapping2 = findByAlias('METFORMIN');
    expect(mapping1?.standardId).toBe(mapping2?.standardId);
  });
});