/**
 * QueryDSLBuilder Unit Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { QueryDSLBuilder, createQueryDSLBuilder } from './query-dsl-builder.js';
import type { QueryAnalysisResult, QueryDSL } from './types.js';

describe('QueryDSLBuilder', () => {
  let builder: QueryDSLBuilder;

  beforeEach(() => {
    builder = createQueryDSLBuilder();
  });

  describe('build', () => {
    it('should build DSL from simple analysis', () => {
      const analysis: QueryAnalysisResult = {
        complexity: 'simple',
        needsDecomposition: false,
        needsRewrite: false,
        analysisTimestamp: Date.now(),
      };

      const dsl = builder.build(analysis, '向量数据库');

      expect(dsl.textQuery).toBe('向量数据库');
      expect(dsl.filters).toHaveLength(0);
    });

    it('should build DSL with year filter', () => {
      const analysis: QueryAnalysisResult = {
        complexity: 'structured',
        needsDecomposition: false,
        needsRewrite: false,
        detectedFilters: { year: 2023 },
        analysisTimestamp: Date.now(),
      };

      const dsl = builder.build(analysis, '2023年报告');

      expect(dsl.filters).toHaveLength(1);
      expect(dsl.filters[0]?.field).toBe('metadata.year');
      expect(dsl.filters[0]?.value).toBe(2023);
    });

    it('should build DSL with multiple filters', () => {
      const analysis: QueryAnalysisResult = {
        complexity: 'structured',
        needsDecomposition: false,
        needsRewrite: false,
        detectedFilters: { year: 2023, category: '技术文档' },
        analysisTimestamp: Date.now(),
      };

      const dsl = builder.build(analysis, '技术文档');

      expect(dsl.filters).toHaveLength(2);
    });

    it('should add sort for structured queries', () => {
      const analysis: QueryAnalysisResult = {
        complexity: 'structured',
        needsDecomposition: false,
        needsRewrite: false,
        detectedFilters: { year: 2023 },
        analysisTimestamp: Date.now(),
      };

      const dsl = builder.build(analysis, '查询');

      expect(dsl.sortBy).toBeDefined();
      expect(dsl.sortBy?.field).toBe('qualityScore.composite');
      expect(dsl.sortBy?.order).toBe('desc');
    });

    it('should not add sort for simple queries', () => {
      const analysis: QueryAnalysisResult = {
        complexity: 'simple',
        needsDecomposition: false,
        needsRewrite: false,
        analysisTimestamp: Date.now(),
      };

      const dsl = builder.build(analysis, '简单查询');

      expect(dsl.sortBy).toBeUndefined();
    });
  });

  describe('buildRangeDSL', () => {
    it('should build range DSL', () => {
      const dsl = builder.buildRangeDSL(
        '2021-2023数据',
        'metadata.year',
        2021,
        2023
      );

      expect(dsl.textQuery).toBe('2021-2023数据');
      expect(dsl.filters).toHaveLength(2);
      expect(dsl.filters[0]?.operator).toBe('gte');
      expect(dsl.filters[1]?.operator).toBe('lte');
    });
  });

  describe('buildMultiValueDSL', () => {
    it('should build multi-value DSL', () => {
      const dsl = builder.buildMultiValueDSL(
        '查询多种类型',
        'metadata.category',
        ['技术', '产品', '用户']
      );

      expect(dsl.filters).toHaveLength(1);
      expect(dsl.filters[0]?.operator).toBe('in');
      expect(dsl.filters[0]?.value).toEqual(['技术', '产品', '用户']);
    });
  });

  describe('parseRange', () => {
    it('should parse year range with "to"', () => {
      const range = builder.parseRange('2021 to 2023数据');

      expect(range).toBeDefined();
      expect(range?.field).toBe('metadata.year');
      expect(range?.start).toBe(2021);
      expect(range?.end).toBe(2023);
    });

    it('should parse year range with "-"', () => {
      const range = builder.parseRange('2021-2023年报告');

      expect(range).toBeDefined();
      expect(range?.start).toBe(2021);
      expect(range?.end).toBe(2023);
    });

    it('should parse year range with "至"', () => {
      const range = builder.parseRange('2021至2023');

      expect(range).toBeDefined();
      expect(range?.start).toBe(2021);
      expect(range?.end).toBe(2023);
    });

    it('should return null for non-range queries', () => {
      const range = builder.parseRange('简单查询');

      expect(range).toBeNull();
    });
  });

  describe('describeDSL', () => {
    it('should describe simple DSL', () => {
      const dsl: QueryDSL = {
        textQuery: '向量数据库',
        filters: [],
      };

      const description = builder.describeDSL(dsl);

      expect(description).toContain('Query: "向量数据库"');
    });

    it('should describe DSL with filters', () => {
      const dsl: QueryDSL = {
        textQuery: '技术文档',
        filters: [
          { field: 'metadata.year', operator: 'eq', value: 2023 },
        ],
      };

      const description = builder.describeDSL(dsl);

      expect(description).toContain('Filters:');
      expect(description).toContain('metadata.year eq 2023');
    });

    it('should describe DSL with sort', () => {
      const dsl: QueryDSL = {
        textQuery: '查询',
        filters: [],
        sortBy: { field: 'qualityScore', order: 'desc' },
      };

      const description = builder.describeDSL(dsl);

      expect(description).toContain('Sort by:');
      expect(description).toContain('qualityScore');
    });
  });

  describe('mergeDSLs', () => {
    it('should return empty DSL for empty array', () => {
      const merged = builder.mergeDSLs([]);

      expect(merged.textQuery).toBe('');
      expect(merged.filters).toHaveLength(0);
    });

    it('should return single DSL unchanged', () => {
      const dsl: QueryDSL = {
        textQuery: '查询',
        filters: [{ field: 'f1', operator: 'eq', value: 'v1' }],
      };

      const merged = builder.mergeDSLs([dsl]);

      expect(merged.textQuery).toBe('查询');
      expect(merged.filters).toHaveLength(1);
    });

    it('should combine text queries with OR', () => {
      const dsl1: QueryDSL = { textQuery: '查询A', filters: [] };
      const dsl2: QueryDSL = { textQuery: '查询B', filters: [] };

      const merged = builder.mergeDSLs([dsl1, dsl2]);

      expect(merged.textQuery).toBe('查询A OR 查询B');
    });

    it('should combine filters and remove duplicates', () => {
      const dsl1: QueryDSL = {
        textQuery: 'A',
        filters: [{ field: 'f1', operator: 'eq', value: 'v1' }],
      };
      const dsl2: QueryDSL = {
        textQuery: 'B',
        filters: [{ field: 'f1', operator: 'eq', value: 'v1' }],
      };

      const merged = builder.mergeDSLs([dsl1, dsl2]);

      expect(merged.filters).toHaveLength(1); // Duplicate removed
    });
  });

  describe('validateDSL', () => {
    it('should validate correct DSL', () => {
      const dsl: QueryDSL = {
        textQuery: '查询',
        filters: [{ field: 'f', operator: 'eq', value: 'v' }],
      };

      const result = builder.validateDSL(dsl);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing textQuery and filters', () => {
      const dsl: QueryDSL = { textQuery: '', filters: [] };

      const result = builder.validateDSL(dsl);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should detect missing filter field', () => {
      const dsl: QueryDSL = {
        textQuery: '查询',
        filters: [{ field: '', operator: 'eq', value: 'v' }],
      };

      const result = builder.validateDSL(dsl);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('field'))).toBe(true);
    });

    it('should detect invalid operator', () => {
      const dsl: QueryDSL = {
        textQuery: '查询',
        filters: [{ field: 'f', operator: 'invalid' as any, value: 'v' }],
      };

      const result = builder.validateDSL(dsl);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid operator'))).toBe(true);
    });
  });

  describe('filter field mapping', () => {
    it('should map year to metadata.year', () => {
      const analysis: QueryAnalysisResult = {
        complexity: 'structured',
        needsDecomposition: false,
        needsRewrite: false,
        detectedFilters: { year: 2023 },
        analysisTimestamp: Date.now(),
      };

      const dsl = builder.build(analysis, '查询');

      expect(dsl.filters[0]?.field).toBe('metadata.year');
    });

    it('should map unknown fields to metadata prefix', () => {
      const analysis: QueryAnalysisResult = {
        complexity: 'structured',
        needsDecomposition: false,
        needsRewrite: false,
        detectedFilters: { customField: 'value' },
        analysisTimestamp: Date.now(),
      };

      const dsl = builder.build(analysis, '查询');

      expect(dsl.filters[0]?.field).toBe('metadata.customField');
    });
  });
});