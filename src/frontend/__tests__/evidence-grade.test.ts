/**
 * EvidencePanel GRADE Tests
 *
 * Tests for GRADE evaluation utility functions and fallback behavior
 */

import { describe, it, expect } from 'vitest';

/**
 * Literature types for GRADE evaluation
 */
type LiteratureType = 'rct' | 'meta_analysis' | 'guideline' | 'observational' | 'case_report' | 'expert_opinion';

type SourceAuthorityLevel = 'international' | 'national' | 'local';

type EvidenceQuality = 'A' | 'B' | 'C' | 'D';

interface EvidenceEvaluation {
  literatureType: LiteratureType;
  grade: EvidenceQuality;
  isCurrent: boolean;
  year?: number;
  sourceGuideline?: string;
  expirationWarning?: string;
  sourceAuthority?: SourceAuthorityLevel;
  authorityWeight?: number;
  timeWeight?: number;
  consistencyScore?: number;
  compositeScore?: number;
}

interface EvidenceResult {
  smallChunkId: string;
  parentChunkId?: string;
  parentChunkContent: string;
  similarityScore: number;
  sourceDocumentId?: string;
  evidenceEvaluation?: EvidenceEvaluation;
}

/**
 * Calculate evidence quality grade based on similarity (fallback)
 */
function getEvidenceQuality(score: number): EvidenceQuality {
  if (score >= 0.85) return 'A';
  if (score >= 0.70) return 'B';
  if (score >= 0.50) return 'C';
  return 'D';
}

/**
 * Get grade from backend GRADE evaluation, fallback to similarityScore
 */
function getGradeFromEvaluation(result: EvidenceResult): EvidenceQuality {
  if (result.evidenceEvaluation?.grade) {
    return result.evidenceEvaluation.grade;
  }
  return getEvidenceQuality(result.similarityScore);
}

/**
 * Check if result has GRADE evaluation data
 */
function hasGradeEvaluation(result: EvidenceResult): boolean {
  return result.evidenceEvaluation !== undefined;
}

/**
 * Check if result has time decay warning
 */
function hasTimeDecayWarning(result: EvidenceResult): boolean {
  const evaluation = result.evidenceEvaluation;
  if (!evaluation) return false;
  return (evaluation.timeWeight !== undefined && evaluation.timeWeight < 0.7) || evaluation.expirationWarning !== undefined;
}

/**
 * Literature type labels
 */
const LITERATURE_TYPE_LABELS: Record<LiteratureType, string> = {
  rct: 'RCT 研究',
  meta_analysis: 'Meta 分析',
  guideline: '临床指南',
  observational: '观察研究',
  case_report: '病例报告',
  expert_opinion: '专家意见',
};

describe('EvidencePanel GRADE Functions', () => {
  describe('getEvidenceQuality (fallback)', () => {
    it('should return A for scores >= 0.85', () => {
      expect(getEvidenceQuality(0.85)).toBe('A');
      expect(getEvidenceQuality(0.90)).toBe('A');
      expect(getEvidenceQuality(1.0)).toBe('A');
    });

    it('should return B for scores >= 0.70 and < 0.85', () => {
      expect(getEvidenceQuality(0.70)).toBe('B');
      expect(getEvidenceQuality(0.75)).toBe('B');
      expect(getEvidenceQuality(0.84)).toBe('B');
    });

    it('should return C for scores >= 0.50 and < 0.70', () => {
      expect(getEvidenceQuality(0.50)).toBe('C');
      expect(getEvidenceQuality(0.60)).toBe('C');
      expect(getEvidenceQuality(0.69)).toBe('C');
    });

    it('should return D for scores < 0.50', () => {
      expect(getEvidenceQuality(0.0)).toBe('D');
      expect(getEvidenceQuality(0.25)).toBe('D');
      expect(getEvidenceQuality(0.49)).toBe('D');
    });
  });

  describe('getGradeFromEvaluation', () => {
    it('should use backend GRADE when available', () => {
      const result: EvidenceResult = {
        smallChunkId: 'test-1',
        parentChunkContent: 'Test content',
        similarityScore: 0.50, // Would be C by fallback
        evidenceEvaluation: {
          literatureType: 'rct',
          grade: 'A', // Backend says A
          isCurrent: true,
          year: 2024,
        },
      };

      expect(getGradeFromEvaluation(result)).toBe('A');
    });

    it('should fallback to similarityScore when no GRADE data', () => {
      const result: EvidenceResult = {
        smallChunkId: 'test-1',
        parentChunkContent: 'Test content',
        similarityScore: 0.85, // Would be A by fallback
      };

      expect(getGradeFromEvaluation(result)).toBe('A');
    });

    it('should fallback when evidenceEvaluation is undefined', () => {
      const result: EvidenceResult = {
        smallChunkId: 'test-1',
        parentChunkContent: 'Test content',
        similarityScore: 0.60, // Would be C by fallback
        evidenceEvaluation: undefined,
      };

      expect(getGradeFromEvaluation(result)).toBe('C');
    });

    it('should use backend grade B over fallback C', () => {
      const result: EvidenceResult = {
        smallChunkId: 'test-1',
        parentChunkContent: 'Test content',
        similarityScore: 0.55, // Would be C by fallback
        evidenceEvaluation: {
          literatureType: 'observational',
          grade: 'B', // Backend says B
          isCurrent: true,
          year: 2022,
        },
      };

      expect(getGradeFromEvaluation(result)).toBe('B');
    });
  });

  describe('hasGradeEvaluation', () => {
    it('should return true when evidenceEvaluation is present', () => {
      const result: EvidenceResult = {
        smallChunkId: 'test-1',
        parentChunkContent: 'Test content',
        similarityScore: 0.90,
        evidenceEvaluation: {
          literatureType: 'guideline',
          grade: 'A',
          isCurrent: true,
        },
      };

      expect(hasGradeEvaluation(result)).toBe(true);
    });

    it('should return false when evidenceEvaluation is undefined', () => {
      const result: EvidenceResult = {
        smallChunkId: 'test-1',
        parentChunkContent: 'Test content',
        similarityScore: 0.90,
      };

      expect(hasGradeEvaluation(result)).toBe(false);
    });
  });

  describe('hasTimeDecayWarning', () => {
    it('should return true when timeWeight < 0.7', () => {
      const result: EvidenceResult = {
        smallChunkId: 'test-1',
        parentChunkContent: 'Test content',
        similarityScore: 0.90,
        evidenceEvaluation: {
          literatureType: 'guideline',
          grade: 'A',
          isCurrent: false,
          timeWeight: 0.65, // Below threshold
        },
      };

      expect(hasTimeDecayWarning(result)).toBe(true);
    });

    it('should return true when expirationWarning exists', () => {
      const result: EvidenceResult = {
        smallChunkId: 'test-1',
        parentChunkContent: 'Test content',
        similarityScore: 0.90,
        evidenceEvaluation: {
          literatureType: 'guideline',
          grade: 'A',
          isCurrent: false,
          expirationWarning: 'This guideline may be outdated',
        },
      };

      expect(hasTimeDecayWarning(result)).toBe(true);
    });

    it('should return false when timeWeight >= 0.7', () => {
      const result: EvidenceResult = {
        smallChunkId: 'test-1',
        parentChunkContent: 'Test content',
        similarityScore: 0.90,
        evidenceEvaluation: {
          literatureType: 'guideline',
          grade: 'A',
          isCurrent: true,
          timeWeight: 0.85, // Above threshold
        },
      };

      expect(hasTimeDecayWarning(result)).toBe(false);
    });

    it('should return false when no evidenceEvaluation', () => {
      const result: EvidenceResult = {
        smallChunkId: 'test-1',
        parentChunkContent: 'Test content',
        similarityScore: 0.90,
      };

      expect(hasTimeDecayWarning(result)).toBe(false);
    });
  });

  describe('LITERATURE_TYPE_LABELS', () => {
    it('should have correct labels for all types', () => {
      expect(LITERATURE_TYPE_LABELS.rct).toBe('RCT 研究');
      expect(LITERATURE_TYPE_LABELS.meta_analysis).toBe('Meta 分析');
      expect(LITERATURE_TYPE_LABELS.guideline).toBe('临床指南');
      expect(LITERATURE_TYPE_LABELS.observational).toBe('观察研究');
      expect(LITERATURE_TYPE_LABELS.case_report).toBe('病例报告');
      expect(LITERATURE_TYPE_LABELS.expert_opinion).toBe('专家意见');
    });
  });

  describe('Mixed Mode Handling', () => {
    it('should handle results with mixed GRADE and fallback data', () => {
      const results: EvidenceResult[] = [
        {
          smallChunkId: 'test-1',
          parentChunkContent: 'RCT content',
          similarityScore: 0.50, // Fallback would be C
          evidenceEvaluation: {
            literatureType: 'rct',
            grade: 'A', // Backend says A
            isCurrent: true,
          },
        },
        {
          smallChunkId: 'test-2',
          parentChunkContent: 'No GRADE content',
          similarityScore: 0.75, // Fallback is B
          // No evidenceEvaluation
        },
        {
          smallChunkId: 'test-3',
          parentChunkContent: 'Observational content',
          similarityScore: 0.80, // Fallback would be B
          evidenceEvaluation: {
            literatureType: 'observational',
            grade: 'C', // Backend says C
            isCurrent: true,
          },
        },
      ];

      const grades = results.map(r => getGradeFromEvaluation(r));
      expect(grades).toEqual(['A', 'B', 'C']);
    });

    it('should correctly count GRADE vs fallback results', () => {
      const results: EvidenceResult[] = [
        {
          smallChunkId: 'test-1',
          parentChunkContent: 'With GRADE',
          similarityScore: 0.90,
          evidenceEvaluation: { literatureType: 'rct', grade: 'A', isCurrent: true },
        },
        {
          smallChunkId: 'test-2',
          parentChunkContent: 'No GRADE',
          similarityScore: 0.90,
        },
        {
          smallChunkId: 'test-3',
          parentChunkContent: 'With GRADE',
          similarityScore: 0.90,
          evidenceEvaluation: { literatureType: 'guideline', grade: 'B', isCurrent: true },
        },
      ];

      const gradeCount = results.filter(r => hasGradeEvaluation(r)).length;
      const fallbackCount = results.filter(r => !hasGradeEvaluation(r)).length;

      expect(gradeCount).toBe(2);
      expect(fallbackCount).toBe(1);
    });
  });
});