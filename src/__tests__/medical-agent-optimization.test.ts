/**
 * Unit tests for Medical Agent Optimization
 * - Task 1.7: decideByRules() tests
 * - Task 2.5-2.6: Early termination tests
 * - Task 4.5, 5.4, 6.4, 7.5: Enhanced evidence evaluation tests
 */

import { describe, it, expect } from 'vitest';
import {
  decideByRules,
  DEFAULT_RULE_THRESHOLDS,
  calculateEntityCoverage,
  generateAnswerFromSafety,
  type RuleThresholds,
  type RuleHitType,
  type RuleHitRecord,
} from '../medical/agent/AgentExecutor.js';
import type { AgentState, MedicalEntities, SourceCitation, DrugInteractionRelation } from '../medical/types.js';
import type { SafetyAssessment, ContraindicationMatch } from '../medical/safety-layer.js';
import {
  evaluateSourceAuthority,
  calculateTimeWeight,
  checkConsistency,
  calculateEnhancedCompositeScore,
  sortEvidenceByQuality,
  GUIDELINE_AUTHORITY_MAPPING,
} from '../medical/evidence-evaluator.js';
import type { EvidenceEvaluation, SourceAuthorityLevel, GradeLevel, Contraindication } from '../medical/types.js';

// ========================================
// Task 1.7: decideByRules() Tests
// ========================================

describe('decideByRules', () => {
  // Helper to create minimal AgentState
  const createMockState = (overrides: Partial<AgentState> = {}): AgentState => {
    const defaultEntities: MedicalEntities = {
      diseases: [],
      drugs: [],
      indicators: [],
      confidence: 0.8,
    };
    return {
      iteration: 1,
      entities: defaultEntities,
      history: [],
      reasoningTrace: [],
      status: 'running',
      satisfied: false,
      ...overrides,
    };
  };

  const createMockRetrievalResults = (count: number, similarity: number = 0.75) => {
    return Array(count).fill(null).map((_, i) => ({
      content: `Document ${i} about diabetes and metformin`,
      source: {
        documentName: `Test Doc ${i}`,
        year: 2024,
      },
      similarityScore: similarity,
    }));
  };

  it('should return satisfied when retrieval count meets threshold', () => {
    const state = createMockState({
      retrievalResults: createMockRetrievalResults(DEFAULT_RULE_THRESHOLDS.minRetrievalCount),
    });

    const result = decideByRules(state);

    expect(result.ruleType).toBe('retrieval_count');
    expect(result.actualValue).toBe(DEFAULT_RULE_THRESHOLDS.minRetrievalCount);
  });

  it('should return high_similarity rule when high similarity detected', () => {
    const state = createMockState({
      retrievalResults: createMockRetrievalResults(1, DEFAULT_RULE_THRESHOLDS.minSimilarityScore + 0.05),
    });

    const result = decideByRules(state);

    expect(result.ruleType).toBe('high_similarity');
    expect(result.actualValue).toBeGreaterThan(DEFAULT_RULE_THRESHOLDS.minSimilarityScore);
  });

  it('should return entity_coverage rule when coverage meets threshold', () => {
    const entities: MedicalEntities = {
      diseases: [{ matchedTerm: '糖尿病', canonicalName: '糖尿病', synonyms: [] }],
      drugs: [{ matchedTerm: '二甲双胍', canonicalName: '二甲双胍', synonyms: [] }],
      indicators: [],
      confidence: 0.9,
    };

    // Results that contain entity terms
    const retrievalResults = [
      { content: '糖尿病治疗指南二甲双胍...', source: { documentName: 'ADA 2024' }, similarityScore: 0.6 },
      { content: '二甲双胍用药说明...', source: { documentName: 'CDS 2024' }, similarityScore: 0.55 },
    ];

    const state = createMockState({
      entities,
      retrievalResults,
    });

    const result = decideByRules(state);

    // With 2 entities found in content, coverage = 1.0 >= 0.8 threshold
    // But retrieval_count (2) < 3, high_similarity (0.6) < 0.7
    // So entity_coverage should hit
    expect(result.ruleType).toBe('entity_coverage');
  });

  it('should return none when no rules hit', () => {
    // Use entities that won't match the content
    const entities: MedicalEntities = {
      diseases: [{ matchedTerm: '罕见病XYZ', canonicalName: '罕见病XYZ', synonyms: [] }],
      drugs: [{ matchedTerm: '特殊药物ABC', canonicalName: '特殊药物ABC', synonyms: [] }],
      indicators: [],
      confidence: 0.9,
    };

    const state = createMockState({
      entities,
      retrievalResults: createMockRetrievalResults(1, 0.5), // Below thresholds
    });

    const result = decideByRules(state);

    expect(result.ruleType).toBe('none');
  });

  it('should use custom thresholds when provided', () => {
    const customThresholds: RuleThresholds = {
      minRetrievalCount: 5, // Higher threshold
      minSimilarityScore: 0.9,
      minEntityCoverage: 0.9,
    };

    // Use entities that won't be found in results to avoid entity_coverage hit
    const entities: MedicalEntities = {
      diseases: [{ matchedTerm: '罕见病XYZ', canonicalName: '罕见病XYZ', synonyms: [] }],
      drugs: [],
      indicators: [],
      confidence: 0.9,
    };

    const state = createMockState({
      entities,
      retrievalResults: createMockRetrievalResults(3), // Below custom threshold
    });

    const result = decideByRules(state, customThresholds);

    expect(result.ruleType).toBe('none'); // Should not satisfy with custom threshold
  });

  it('should prioritize rules by order: retrieval_count > high_similarity > entity_coverage', () => {
    // This test verifies priority when multiple rules could hit
    const state = createMockState({
      retrievalResults: createMockRetrievalResults(5, 0.95),
    });

    const result = decideByRules(state);

    // Should hit retrieval_count first (higher priority)
    expect(result.ruleType).toBe('retrieval_count');
  });
});

describe('calculateEntityCoverage', () => {
  it('should return 1.0 for empty entities', () => {
    const state: AgentState = {
      iteration: 1,
      entities: {
        diseases: [],
        drugs: [],
        indicators: [],
        confidence: 0.8,
      },
      history: [],
      reasoningTrace: [],
      status: 'running',
      satisfied: false,
      retrievalResults: [],
    };

    const coverage = calculateEntityCoverage(state);
    expect(coverage).toBe(1.0);
  });

  it('should calculate coverage based on entity matching in results', () => {
    const state: AgentState = {
      iteration: 1,
      entities: {
        diseases: [{ matchedTerm: '糖尿病', canonicalName: '糖尿病', synonyms: [] }],
        drugs: [{ matchedTerm: '二甲双胍', canonicalName: '二甲双胍', synonyms: [] }],
        indicators: [],
        confidence: 0.9,
      },
      history: [],
      reasoningTrace: [],
      status: 'running',
      satisfied: false,
      retrievalResults: [
        { content: '糖尿病治疗指南...', source: { documentName: 'ADA 2024' }, similarityScore: 0.8 },
        { content: '二甲双胍用药说明...', source: { documentName: 'CDS 2024' }, similarityScore: 0.7 },
      ],
    };

    const coverage = calculateEntityCoverage(state);
    expect(coverage).toBeGreaterThan(0);
    expect(coverage).toBeLessThanOrEqual(1.0);
  });

  it('should return low coverage when entities not found in results', () => {
    const state: AgentState = {
      iteration: 1,
      entities: {
        diseases: [{ matchedTerm: '糖尿病', canonicalName: '糖尿病', synonyms: [] }],
        drugs: [],
        indicators: [],
        confidence: 0.9,
      },
      history: [],
      reasoningTrace: [],
      status: 'running',
      satisfied: false,
      retrievalResults: [
        { content: '高血压治疗指南...', source: { documentName: 'Test' }, similarityScore: 0.8 },
      ],
    };

    const coverage = calculateEntityCoverage(state);
    expect(coverage).toBeLessThan(0.5);
  });
});

// ========================================
// Task 2.5-2.6: Early Termination Tests
// ========================================

describe('generateAnswerFromSafety', () => {
  it('should generate answer from absolute contraindication', () => {
    const query = '糖尿病患者可以使用SGLT2抑制剂吗？';
    const safetyAssessment: SafetyAssessment = {
      severity: 'absolute',
      contraindicationMatches: [{
        contraindication: {
          id: 'contra_sglt2_egfr',
          drug: 'SGLT2抑制剂',
          condition: 'eGFR',
          severity: 'absolute',
          source: 'ADA',
          year: 2024,
          description: '严重肾功能不全患者禁用SGLT2抑制剂',
        },
        matchedThreshold: {
          indicator: 'eGFR',
          indicatorName: 'eGFR',
          operator: '<',
          value: 30,
          unit: 'ml/min/1.73m²',
          isValidUnit: true,
          sourceText: 'eGFR<30',
        },
        severity: 'absolute',
      }],
      interactions: [],
      recommendation: '禁用：严重肾功能不全患者不应使用SGLT2抑制剂',
      sourceGlossary: ['ADA 2024'],
    };

    const answer = generateAnswerFromSafety(query, safetyAssessment);

    expect(answer).toBeDefined();
    expect(answer.conclusion.text).toContain('禁用');
    expect(answer.warnings.length).toBeGreaterThan(0);
  });

  it('should handle relative contraindication scenario', () => {
    const query = '老年糖尿病患者使用二甲双胍';
    const safetyAssessment: SafetyAssessment = {
      severity: 'relative',
      contraindicationMatches: [{
        contraindication: {
          id: 'contra_metformin_age',
          drug: '二甲双胍',
          condition: 'age',
          severity: 'relative',
          source: 'CDS',
          year: 2024,
          description: '80岁以上老年患者慎用二甲双胍',
        },
        matchedThreshold: {
          indicator: 'age',
          indicatorName: '年龄',
          operator: '>',
          value: 80,
          unit: '岁',
          isValidUnit: true,
          sourceText: '年龄>80',
        },
        severity: 'relative',
      }],
      interactions: [],
      recommendation: '慎用：需评估肾功能后决定',
      sourceGlossary: ['CDS 2024'],
    };

    const answer = generateAnswerFromSafety(query, safetyAssessment);

    expect(answer).toBeDefined();
    expect(answer.conclusion.text).toContain('慎用');
  });

  it('should handle drug interaction scenario', () => {
    const query = '二甲双胍与西咪替丁合用';
    const safetyAssessment: SafetyAssessment = {
      severity: 'interaction',
      contraindicationMatches: [],
      interactions: [{
        id: 'interaction-1',
        drug1: '二甲双胍',
        drug2: '西咪替丁',
        type: 'moderate',
        description: '西咪替丁可增加二甲双胍血药浓度',
        recommendation: '监测血糖，必要时调整剂量',
        source: '临床指南',
        year: 2024,
      }],
      recommendation: '注意药物相互作用',
      sourceGlossary: [],
    };

    const answer = generateAnswerFromSafety(query, safetyAssessment);

    expect(answer).toBeDefined();
    expect(answer.conclusion.text).toContain('相互作用');
  });

  it('should always include medical disclaimer warnings', () => {
    const safetyAssessment: SafetyAssessment = {
      severity: 'absolute',
      contraindicationMatches: [],
      interactions: [],
      recommendation: '禁用',
      sourceGlossary: [],
    };

    const answer = generateAnswerFromSafety('test query', safetyAssessment);

    expect(answer.warnings.some(w => w.includes('仅供参考') || w.includes('医疗建议'))).toBe(true);
  });
});

// ========================================
// Task 4.5: Authority Classification Tests
// ========================================

describe('evaluateSourceAuthority', () => {
  it('should classify international guidelines correctly', () => {
    const testCases = [
      { name: 'ADA Standards of Care 2024', expected: 'international' },
      { name: 'KDIGO Diabetes Management 2023', expected: 'international' },
      { name: 'ESC Guidelines on Diabetes', expected: 'international' },
      { name: 'ATA Thyroid Guidelines', expected: 'international' },
    ];

    for (const tc of testCases) {
      const result = evaluateSourceAuthority(tc.name);
      expect(result.level).toBe(tc.expected);
      expect(result.weight).toBe(GUIDELINE_AUTHORITY_MAPPING.international.weight);
    }
  });

  it('should classify national guidelines correctly', () => {
    const testCases = [
      { name: '中国糖尿病防治指南 2024', expected: 'national' },
      { name: 'CDS 糖尿病诊疗指南', expected: 'national' },
      { name: '中国高血压防治指南', expected: 'national' },
    ];

    for (const tc of testCases) {
      const result = evaluateSourceAuthority(tc.name);
      expect(result.level).toBe(tc.expected);
      expect(result.weight).toBe(GUIDELINE_AUTHORITY_MAPPING.national.weight);
    }
  });

  it('should classify unknown sources as local', () => {
    const result = evaluateSourceAuthority('某医院内部指南');
    expect(result.level).toBe('local');
    expect(result.weight).toBe(GUIDELINE_AUTHORITY_MAPPING.local.weight);
  });

  it('should return consistent weights', () => {
    expect(GUIDELINE_AUTHORITY_MAPPING.international.weight).toBe(1.0);
    expect(GUIDELINE_AUTHORITY_MAPPING.national.weight).toBe(0.8);
    expect(GUIDELINE_AUTHORITY_MAPPING.local.weight).toBe(0.6);
  });
});

// ========================================
// Task 5.4: Time Weight Tests
// ========================================

describe('calculateTimeWeight', () => {
  it('should return 1.0 for current year', () => {
    const currentYear = new Date().getFullYear();
    const weight = calculateTimeWeight(currentYear);
    expect(weight).toBe(1.0);
  });

  it('should apply linear decay for older years (0.05 per year)', () => {
    const currentYear = new Date().getFullYear();
    const weight3YearsOld = calculateTimeWeight(currentYear - 3);
    const weight5YearsOld = calculateTimeWeight(currentYear - 5);

    // Decay formula: 1.0 - (yearsOld * 0.05)
    // 3 years: 1.0 - 0.15 = 0.85
    // 5 years: 1.0 - 0.25 = 0.75
    expect(weight3YearsOld).toBeCloseTo(0.85, 1);
    expect(weight5YearsOld).toBeCloseTo(0.75, 1);
  });

  it('should respect minimum threshold of 0.5', () => {
    const weight10YearsOld = calculateTimeWeight(new Date().getFullYear() - 10);
    // 10 years: 1.0 - 0.5 = 0.5 (at minimum)
    expect(weight10YearsOld).toBe(0.5); // Clamped to minimum
  });

  it('should handle undefined year with default', () => {
    const weight = calculateTimeWeight(undefined);
    expect(weight).toBe(0.7); // Default for unknown year
  });
});

// ========================================
// Task 6.4: Consistency Check Tests
// ========================================

describe('checkConsistency', () => {
  it('should return 1.0 for single source', () => {
    const sources = [
      { documentName: 'ADA 2024', content: '推荐使用二甲双胍' },
    ];

    const consistency = checkConsistency(sources);
    expect(consistency).toBe(1.0);
  });

  it('should return high consistency for agreeing sources', () => {
    const sources = [
      { documentName: 'ADA 2024', content: '推荐二甲双胍作为一线用药' },
      { documentName: 'CDS 2024', content: '建议首选二甲双胍治疗' },
    ];

    const consistency = checkConsistency(sources);
    expect(consistency).toBeGreaterThan(0.8);
  });

  it('should detect conflict keywords and reduce consistency', () => {
    // "推荐" is positive keyword, "禁用" is negative keyword
    const sources = [
      { documentName: 'ADA 2024', content: '推荐使用二甲双胍' },
      { documentName: 'Old Guide', content: '禁用二甲双胍用于所有患者' },
    ];

    const consistency = checkConsistency(sources);
    // Conflict ratio: min(1, 1) / 2 = 0.5
    // Consistency = 1.0 - 0.5 * 0.5 = 0.75
    expect(consistency).toBeLessThan(1.0);
  });

  it('should detect conflict keywords', () => {
    // Test that conflict detection works
    const sources = [
      { documentName: 'A', content: '可以使用' },
      { documentName: 'B', content: '禁用' },
    ];

    const consistency = checkConsistency(sources);
    expect(consistency).toBeLessThan(1.0);
  });

  it('should return 1.0 for empty sources', () => {
    const consistency = checkConsistency([]);
    expect(consistency).toBe(1.0);
  });
});

// ========================================
// Task 7.5: Composite Score Tests
// ========================================

describe('calculateEnhancedCompositeScore', () => {
  it('should calculate weighted composite score', () => {
    const score = calculateEnhancedCompositeScore(
      'A',    // GRADE A
      1.0,    // Authority weight (international)
      1.0,    // Time weight (current)
      1.0,    // Consistency
      0.8     // Applicability
    );

    // Expected: GRADE(0.4)*4 + AUTH(0.2)*1 + TIME(0.2)*1 + CONS(0.1)*1 + APPL(0.1)*0.8
    // = 1.6 + 0.2 + 0.2 + 0.1 + 0.08 = 2.18 / max(2.18) = ~1.0 (normalized)
    expect(score).toBeGreaterThan(0.8);
    expect(score).toBeLessThanOrEqual(1.0);
  });

  it('should handle lower quality evidence', () => {
    const score = calculateEnhancedCompositeScore(
      'D',    // GRADE D
      0.6,    // Authority weight (local)
      0.5,    // Time weight (old)
      0.5,    // Consistency (conflicting)
      0.5     // Applicability
    );

    expect(score).toBeLessThan(0.5);
  });

  it('should weight GRADE as highest factor (40%)', () => {
    const scoreHighGrade = calculateEnhancedCompositeScore('A', 0.6, 0.5, 0.5, 0.5);
    const scoreLowGrade = calculateEnhancedCompositeScore('D', 1.0, 1.0, 1.0, 1.0);

    // High grade with low other factors should still be reasonably high
    expect(scoreHighGrade).toBeGreaterThan(scoreLowGrade * 0.5);
  });
});

describe('sortEvidenceByQuality', () => {
  it('should sort by composite score descending', () => {
    const evidences: EvidenceEvaluation[] = [
      {
        literatureType: 'guideline',
        grade: 'D',
        isCurrent: false,
        year: 2015,
        compositeScore: 0.3,
      },
      {
        literatureType: 'guideline',
        grade: 'A',
        isCurrent: true,
        year: 2024,
        compositeScore: 0.9,
      },
      {
        literatureType: 'meta_analysis',
        grade: 'B',
        isCurrent: true,
        year: 2023,
        compositeScore: 0.7,
      },
    ];

    const sorted = sortEvidenceByQuality(evidences);

    expect(sorted[0].compositeScore).toBe(0.9);
    expect(sorted[1].compositeScore).toBe(0.7);
    expect(sorted[2].compositeScore).toBe(0.3);
  });

  it('should handle empty array', () => {
    const sorted = sortEvidenceByQuality([]);
    expect(sorted).toEqual([]);
  });

  it('should handle undefined compositeScore with fallback', () => {
    const evidences: EvidenceEvaluation[] = [
      {
        literatureType: 'guideline',
        grade: 'B',
        isCurrent: true,
        year: 2024,
        // compositeScore undefined - should use fallback
      },
    ];

    const sorted = sortEvidenceByQuality(evidences);
    expect(sorted.length).toBe(1);
  });
});