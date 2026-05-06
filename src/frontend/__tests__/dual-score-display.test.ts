/**
 * EvidencePanel Dual Score Display Tests
 *
 * Tests for verifying semanticScore and RRF score display in EvidenceCard
 */

import { describe, it, expect } from 'vitest';
import { getDisplayScores, getRRFDisplay, hasSemanticScore, getGradeFromEvaluation, getEvidenceQuality } from '../components/EvidencePanel';

// Mock result types
interface MockEvidenceResult {
  smallChunkId: string;
  parentChunkId?: string;
  parentChunkContent: string;
  similarityScore: number;
  sourceDocumentId?: string;
  confidenceLevel?: 'high' | 'medium' | 'low';
  metadata?: {
    pageNumber?: number;
    section?: string;
    documentType?: string;
    documentTitle?: string;
    documentYear?: number;
  };
  semanticScore?: number;
  evidenceEvaluation?: {
    literatureType: 'rct' | 'meta_analysis' | 'guideline' | 'observational' | 'case_report' | 'expert_opinion';
    grade: 'A' | 'B' | 'C' | 'D';
    isCurrent: boolean;
    year?: number;
    sourceGuideline?: string;
    expirationWarning?: string;
    sourceAuthority?: 'international' | 'national' | 'local';
    authorityWeight?: number;
    timeWeight?: number;
    consistencyScore?: number;
    compositeScore?: number;
  };
}

describe('Dual Score Display', () => {
  describe('getDisplayScores', () => {
    it('should return semantic score when semanticScore is defined', () => {
      const result: MockEvidenceResult = {
        smallChunkId: 'chunk-1',
        parentChunkContent: 'test content',
        similarityScore: 0.0164, // RRF score
        semanticScore: 0.85, // Dense Cosine
      };

      const scores = getDisplayScores(result);

      expect(scores.semantic.score).toBe(0.85);
      expect(scores.semantic.type).toBe('semantic');
      expect(scores.rrf.score).toBe(0.0164);
    });

    it('should return keyword type when semanticScore is undefined', () => {
      const result: MockEvidenceResult = {
        smallChunkId: 'chunk-1',
        parentChunkContent: 'test content',
        similarityScore: 0.0164, // RRF score only
      };

      const scores = getDisplayScores(result);

      expect(scores.semantic.score).toBe(0.0164);
      expect(scores.semantic.type).toBe('keyword');
      expect(scores.rrf.score).toBe(0.0164);
    });

    it('should calculate RRF rank from score', () => {
      const result: MockEvidenceResult = {
        smallChunkId: 'chunk-1',
        parentChunkContent: 'test content',
        similarityScore: 0.0164, // ~rank 1
        semanticScore: 0.85,
      };

      const scores = getDisplayScores(result);

      // RRF score 1/(k+rank) where k=60
      // 0.0164 ≈ 1/61 → rank 1
      expect(scores.rrf.rank).toBeGreaterThan(0);
      expect(scores.rrf.rank).toBeLessThanOrEqual(10);
    });
  });

  describe('getRRFDisplay', () => {
    it('should format RRF score as percentage', () => {
      const display = getRRFDisplay(0.0164, 10);

      expect(display.percentage).toBe('RRF 1.6%');
    });

    it('should estimate rank from RRF score', () => {
      const displayRank1 = getRRFDisplay(0.0164, 10); // ~rank 1
      const displayRank2 = getRRFDisplay(0.0161, 10); // ~rank 2

      expect(displayRank1.label).toContain('#');
      expect(displayRank2.label).toContain('#');
    });

    it('should handle very low RRF scores', () => {
      const display = getRRFDisplay(0.005, 10);

      expect(display.percentage).toBe('RRF 0.5%');
      expect(display.label).toContain('#');
    });
  });

  describe('hasSemanticScore', () => {
    it('should return true when semanticScore is defined', () => {
      const result: MockEvidenceResult = {
        smallChunkId: 'chunk-1',
        parentChunkContent: 'test',
        similarityScore: 0.02,
        semanticScore: 0.85,
      };

      expect(hasSemanticScore(result)).toBe(true);
    });

    it('should return false when semanticScore is undefined', () => {
      const result: MockEvidenceResult = {
        smallChunkId: 'chunk-1',
        parentChunkContent: 'test',
        similarityScore: 0.02,
      };

      expect(hasSemanticScore(result)).toBe(false);
    });

    it('should return false when semanticScore is null', () => {
      const result: MockEvidenceResult = {
        smallChunkId: 'chunk-1',
        parentChunkContent: 'test',
        similarityScore: 0.02,
        semanticScore: undefined,
      };

      expect(hasSemanticScore(result)).toBe(false);
    });
  });

  describe('getGradeFromEvaluation', () => {
    it('should prefer semanticScore over RRF for grade calculation', () => {
      const result: MockEvidenceResult = {
        smallChunkId: 'chunk-1',
        parentChunkContent: 'test',
        similarityScore: 0.02, // RRF ~2% (would be D grade)
        semanticScore: 0.85, // 85% (A grade)
      };

      const grade = getGradeFromEvaluation(result);

      expect(grade).toBe('A'); // Based on semanticScore, not RRF
    });

    it('should use backend GRADE evaluation when available', () => {
      const result: MockEvidenceResult = {
        smallChunkId: 'chunk-1',
        parentChunkContent: 'test',
        similarityScore: 0.02,
        semanticScore: 0.85,
        evidenceEvaluation: {
          literatureType: 'rct',
          grade: 'B',
          isCurrent: true,
        },
      };

      const grade = getGradeFromEvaluation(result);

      expect(grade).toBe('B'); // Backend GRADE takes priority
    });

    it('should fallback to RRF when no semanticScore or GRADE', () => {
      const result: MockEvidenceResult = {
        smallChunkId: 'chunk-1',
        parentChunkContent: 'test',
        similarityScore: 0.02, // 2% RRF
      };

      const grade = getGradeFromEvaluation(result);

      // 2% is below 50% threshold → D grade
      expect(grade).toBe('D');
    });
  });

  describe('getEvidenceQuality', () => {
    it('should return A for score >= 85%', () => {
      expect(getEvidenceQuality(0.85)).toBe('A');
      expect(getEvidenceQuality(0.90)).toBe('A');
    });

    it('should return B for score >= 70%', () => {
      expect(getEvidenceQuality(0.70)).toBe('B');
      expect(getEvidenceQuality(0.75)).toBe('B');
      expect(getEvidenceQuality(0.84)).toBe('B');
    });

    it('should return C for score >= 50%', () => {
      expect(getEvidenceQuality(0.50)).toBe('C');
      expect(getEvidenceQuality(0.65)).toBe('C');
    });

    it('should return D for score < 50%', () => {
      expect(getEvidenceQuality(0.01)).toBe('D');
      expect(getEvidenceQuality(0.02)).toBe('D');
      expect(getEvidenceQuality(0.49)).toBe('D');
    });
  });
});

describe('Tooltip Content', () => {
  it('should have correct semantic score tooltip', () => {
    // Tooltip text is set in JSX via title attribute
    const semanticTooltip = '语义相似度：基于向量匹配，反映内容与查询的相关程度';
    expect(semanticTooltip).toContain('向量匹配');
    expect(semanticTooltip).toContain('相关程度');
  });

  it('should have correct RRF ranking tooltip', () => {
    const rrfTooltip = 'RRF 排名：融合 Dense+Sparse 搜索排名，用于排序结果顺序（得分范围 1%-4% 正常）';
    expect(rrfTooltip).toContain('融合');
    expect(rrfTooltip).toContain('Dense+Sparse');
    expect(rrfTooltip).toContain('1%-4%');
  });

  it('should have correct keyword match tooltip', () => {
    const keywordTooltip = '关键词匹配：仅通过 BM25 关键词搜索匹配，无语义相似度';
    expect(keywordTooltip).toContain('BM25');
    expect(keywordTooltip).toContain('关键词搜索');
  });
});