/**
 * MCP Tool Tests - MCP工具测试
 */

import { describe, it, expect } from 'vitest';
import {
  MEDICAL_QUERY_TOOL,
  validateMedicalQueryInput,
  processMedicalQuery,
  handleMedicalQuery,
} from './mcp-tool.js';

describe('Medical Query Tool Definition', () => {
  it('should have correct tool name', () => {
    expect(MEDICAL_QUERY_TOOL.name).toBe('medical_query');
  });

  it('should have correct tool description', () => {
    expect(MEDICAL_QUERY_TOOL.description).toContain('内分泌领域');
    expect(MEDICAL_QUERY_TOOL.description).toContain('医学知识检索');
  });

  it('should have required query parameter', () => {
    expect(MEDICAL_QUERY_TOOL.inputSchema.required).toContain('query');
  });

  it('should have optional domain parameter', () => {
    expect(MEDICAL_QUERY_TOOL.inputSchema.properties.domain).toBeDefined();
    expect(MEDICAL_QUERY_TOOL.inputSchema.properties.domain.enum).toContain('diabetes');
    expect(MEDICAL_QUERY_TOOL.inputSchema.properties.domain.enum).toContain('hypertension');
    expect(MEDICAL_QUERY_TOOL.inputSchema.properties.domain.enum).toContain('thyroid');
    expect(MEDICAL_QUERY_TOOL.inputSchema.properties.domain.enum).toContain('all');
  });
});

describe('Input Validation', () => {
  it('should validate valid input', () => {
    const input = {
      query: '二甲双胍禁忌症',
      domain: 'diabetes',
    };
    const result = validateMedicalQueryInput(input);

    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);
    expect(result.data?.query).toBe('二甲双胍禁忌症');
  });

  it('should reject input without query', () => {
    const input = {
      domain: 'diabetes',
    };
    const result = validateMedicalQueryInput(input);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should reject invalid domain', () => {
    const input = {
      query: '测试',
      domain: 'invalid_domain',
    };
    const result = validateMedicalQueryInput(input);

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('domain'))).toBe(true);
  });

  it('should reject invalid year_range', () => {
    const input = {
      query: '测试',
      year_range: [2025, 2020], // start > end
    };
    const result = validateMedicalQueryInput(input);

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('year_range'))).toBe(true);
  });

  it('should use default values for optional parameters', () => {
    const input = {
      query: '测试',
    };
    const result = validateMedicalQueryInput(input);

    expect(result.valid).toBe(true);
    expect(result.data?.domain).toBe('all');
    expect(result.data?.include_guidelines).toBe(true);
  });
});

describe('Medical Query Processing', () => {
  it('should process simple query', () => {
    const input = {
      query: '二甲双胍禁忌症',
    };
    const result = processMedicalQuery(input);

    expect(result.entities).toBeDefined();
    expect(result.entities.drugs.length).toBeGreaterThan(0);
    expect(result.strategy).toBeDefined();
    expect(result.answer).toBeDefined();
  });

  it('should extract entities correctly', () => {
    const input = {
      query: '糖尿病患者合并肾功能不全，二甲双胍是否还能用',
    };
    const result = processMedicalQuery(input);

    expect(result.entities.drugs.length).toBeGreaterThan(0);
    expect(result.entities.diseases.length).toBeGreaterThan(0);
  });

  it('should build strategy with expanded terms', () => {
    const input = {
      query: '二甲双胍',
    };
    const result = processMedicalQuery(input);

    expect(result.strategy.expandedTerms.length).toBeGreaterThan(0);
    expect(result.strategy.expandedTerms).toContain('Metformin');
  });

  it('should generate answer with warnings', () => {
    const input = {
      query: '二甲双胍',
    };
    const result = processMedicalQuery(input);

    expect(result.answer.warnings.length).toBeGreaterThan(0);
    expect(result.answer.warnings.some(w => w.includes('仅供参考'))).toBe(true);
  });

  it('should include domain-specific filters', () => {
    const input = {
      query: '二甲双胍',
      domain: 'diabetes',
    };
    const result = processMedicalQuery(input);

    expect(result.strategy.filters.guidelineSources).toContain('ada');
  });
});

describe('Handler', () => {
  it('should handle valid query', async () => {
    const result = await handleMedicalQuery({
      query: '二甲双胍禁忌症',
    });

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.markdown).toBeDefined();
  });

  it('should handle invalid query', async () => {
    const result = await handleMedicalQuery({
      domain: 'diabetes',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should return markdown formatted answer', async () => {
    const result = await handleMedicalQuery({
      query: '二甲双胍',
    });

    expect(result.markdown).toContain('## 结论');
    expect(result.markdown).toContain('## 注意事项');
  });
});