/**
 * Query Planner Tests - 查询规划测试
 */

import { describe, it, expect } from 'vitest';
import {
  buildQueryStrategy,
  buildFilters,
  prioritizeSources,
  expandTerms,
  getThresholdInfo,
} from './query-planner.js';
import { extractMedicalEntities } from './entity-recognizer.js';
import type { MedicalQueryInput } from './types.js';

describe('Query Strategy Building', () => {
  it('should build strategy for simple query', () => {
    const input: MedicalQueryInput = {
      query: '二甲双胍禁忌症',
    };
    const strategy = buildQueryStrategy(input);

    expect(strategy.primaryQuery).toContain('二甲双胍');
    expect(strategy.expandedTerms.length).toBeGreaterThan(0);
  });

  it('should build strategy for complex query', () => {
    const input: MedicalQueryInput = {
      query: '糖尿病患者合并肾功能不全，二甲双胍是否还能用',
    };
    const strategy = buildQueryStrategy(input);

    expect(strategy.primaryQuery).toContain('二甲双胍');
    expect(strategy.primaryQuery).toContain('糖尿病');
    expect(strategy.expandedTerms.length).toBeGreaterThan(3);
  });

  it('should include year range in filters', () => {
    const input: MedicalQueryInput = {
      query: '二甲双胍',
      year_range: [2020, 2024],
    };
    const strategy = buildQueryStrategy(input);

    expect(strategy.filters.yearRange).toBeDefined();
    expect(strategy.filters.yearRange).toEqual([2020, 2024]);
  });

  it('should include guideline sources for diabetes domain', () => {
    const input: MedicalQueryInput = {
      query: '二甲双胍',
      domain: 'diabetes',
    };
    const strategy = buildQueryStrategy(input);

    expect(strategy.filters.guidelineSources).toBeDefined();
    expect(strategy.filters.guidelineSources).toContain('ada');
  });
});

describe('Filter Building', () => {
  it('should build default filters', () => {
    const entities = extractMedicalEntities('二甲双胍');
    const input: MedicalQueryInput = { query: '二甲双胍' };
    const filters = buildFilters(entities, input);

    expect(filters.yearRange).toBeDefined();
    expect(filters.yearRange?.length).toBe(2);
  });

  it('should build filters for hypertension domain', () => {
    const entities = extractMedicalEntities('氨氯地平');
    const input: MedicalQueryInput = {
      query: '氨氯地平',
      domain: 'hypertension',
    };
    const filters = buildFilters(entities, input);

    expect(filters.guidelineSources).toContain('esc');
    expect(filters.guidelineSources).toContain('acc');
  });
});

describe('Source Prioritization', () => {
  it('should prioritize ADA for diabetes drugs', () => {
    const entities = extractMedicalEntities('二甲双胍');
    const sources = prioritizeSources(entities, [2020, 2024]);

    expect(sources.some(s => s.includes('ADA'))).toBe(true);
  });

  it('should prioritize ESC for hypertension drugs', () => {
    const entities = extractMedicalEntities('缬沙坦');
    const sources = prioritizeSources(entities, [2020, 2024]);

    expect(sources.some(s => s.includes('ESC'))).toBe(true);
  });

  it('should prioritize ATA for thyroid drugs', () => {
    const entities = extractMedicalEntities('左甲状腺素');
    const sources = prioritizeSources(entities, [2020, 2024]);

    expect(sources.some(s => s.includes('ATA'))).toBe(true);
  });

  it('should prioritize KDIGO for CKD', () => {
    const entities = extractMedicalEntities('慢性肾脏病');
    const sources = prioritizeSources(entities, [2020, 2024]);

    expect(sources.some(s => s.includes('KDIGO'))).toBe(true);
  });
});

describe('Term Expansion', () => {
  it('should expand terms with aliases', () => {
    const entities = extractMedicalEntities('二甲双胍');
    const expanded = expandTerms(entities);

    expect(expanded).toContain('Metformin');
    expect(expanded).toContain('格华止');
  });

  it('should expand terms with keywords', () => {
    const entities = extractMedicalEntities('二甲双胍');
    const expanded = expandTerms(entities);

    // 二甲双胍词典包含关键词
    expect(expanded.length).toBeGreaterThan(5);
  });

  it('should expand terms for multiple entities', () => {
    const entities = extractMedicalEntities('糖尿病二甲双胍');
    const expanded = expandTerms(entities);

    expect(expanded.length).toBeGreaterThan(10);
  });
});

describe('Threshold Info', () => {
  it('should get threshold info for metformin', () => {
    const entities = extractMedicalEntities('二甲双胍');
    const thresholdInfo = getThresholdInfo(entities);

    expect(thresholdInfo.length).toBeGreaterThan(0);
    expect(thresholdInfo.some(t => t.includes('30'))).toBe(true);
    expect(thresholdInfo.some(t => t.includes('45'))).toBe(true);
  });

  it('should return empty array for drugs without thresholds', () => {
    const entities = extractMedicalEntities('阿卡波糖');
    const thresholdInfo = getThresholdInfo(entities);

    // 阿卡波糖没有明确的eGFR阈值限制
    expect(thresholdInfo.length).toBe(0);
  });
});