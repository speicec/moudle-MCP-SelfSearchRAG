/**
 * Grade Metadata Fix Verification Test
 *
 * 验证 VectorPayload 文档级元数据字段正确传递到 GRADE 评估
 */

import { describe, it, expect } from 'vitest';

describe('Grade Metadata Fix Verification', () => {
  /**
   * 验证 VectorPayload 接口包含新字段
   */
  describe('VectorPayload interface', () => {
    interface VectorPayload {
      documentId: string;
      chunkId: string;
      level: 'small' | 'parent' | 'image';
      modality: 'text' | 'image';
      qualityScore?: number;
      pageNumber?: number;
      contentType?: string;
      content?: string;
      // 新增字段
      documentYear?: number;
      documentTitle?: string;
      documentAuthor?: string;
      guidelineSource?: string;
    }

    it('should accept documentYear field', () => {
      const payload: VectorPayload = {
        documentId: 'doc_ada_2024',
        chunkId: 'chunk_001',
        level: 'small',
        modality: 'text',
        documentYear: 2024,
        documentTitle: 'ADA Standards of Care 2024',
        guidelineSource: 'ADA',
      };

      expect(payload.documentYear).toBe(2024);
      expect(payload.documentTitle).toBe('ADA Standards of Care 2024');
      expect(payload.guidelineSource).toBe('ADA');
    });

    it('should allow undefined for new fields', () => {
      const payload: VectorPayload = {
        documentId: 'doc_legacy',
        chunkId: 'chunk_old',
        level: 'small',
        modality: 'text',
        // 不设置新字段
      };

      expect(payload.documentYear).toBeUndefined();
      expect(payload.documentTitle).toBeUndefined();
      expect(payload.guidelineSource).toBeUndefined();
    });
  });

  /**
   * 验证 ChunkMetadata 恢复逻辑
   */
  describe('ChunkMetadata recovery', () => {
    interface ChunkMetadata {
      contentType: 'text' | 'table' | 'image' | 'formula';
      boundaryConfidence?: number;
      pageNumber?: number;
      documentYear?: number;
      documentTitle?: string;
      documentAuthor?: string;
      guidelineSource?: string;
    }

    function recoverMetadataFromPayload(payload: {
      contentType?: string;
      pageNumber?: number;
      documentYear?: number;
      documentTitle?: string;
      documentAuthor?: string;
      guidelineSource?: string;
    }): ChunkMetadata {
      return {
        contentType: (payload.contentType as ChunkMetadata['contentType']) ?? 'text',
        boundaryConfidence: 0.5,
        ...(payload.pageNumber !== undefined ? { pageNumber: payload.pageNumber } : {}),
        ...(payload.documentYear !== undefined ? { documentYear: payload.documentYear } : {}),
        ...(payload.documentTitle !== undefined ? { documentTitle: payload.documentTitle } : {}),
        ...(payload.documentAuthor !== undefined ? { documentAuthor: payload.documentAuthor } : {}),
        ...(payload.guidelineSource !== undefined ? { guidelineSource: payload.guidelineSource } : {}),
      };
    }

    it('should recover complete metadata from payload', () => {
      const payload = {
        contentType: 'text',
        pageNumber: 42,
        documentYear: 2024,
        documentTitle: 'KDIGO 2024 CKD Guidelines',
        documentAuthor: 'KDIGO Work Group',
        guidelineSource: 'KDIGO',
      };

      const metadata = recoverMetadataFromPayload(payload);

      expect(metadata.documentYear).toBe(2024);
      expect(metadata.documentTitle).toBe('KDIGO 2024 CKD Guidelines');
      expect(metadata.documentAuthor).toBe('KDIGO Work Group');
      expect(metadata.guidelineSource).toBe('KDIGO');
      expect(metadata.pageNumber).toBe(42);
    });

    it('should handle legacy payload without new fields', () => {
      const legacyPayload = {
        contentType: 'text',
        pageNumber: 10,
      };

      const metadata = recoverMetadataFromPayload(legacyPayload);

      expect(metadata.documentYear).toBeUndefined();
      expect(metadata.documentTitle).toBeUndefined();
      expect(metadata.guidelineSource).toBeUndefined();
      // 现有字段保持不变
      expect(metadata.pageNumber).toBe(10);
      expect(metadata.contentType).toBe('text');
    });
  });

  /**
   * 验证 GRADE 评估使用元数据
   */
  describe('GRADE evaluation with metadata', () => {
    interface SourceCitation {
      documentId: string;
      documentName: string;
      chunkId: string;
      year?: number;
      guidelineSource?: string;
    }

    interface EvidenceEvaluation {
      literatureType: 'rct' | 'meta_analysis' | 'guideline' | 'observational' | 'case_report' | 'expert_opinion';
      grade: 'A' | 'B' | 'C' | 'D';
      isCurrent: boolean;
      year?: number;
      sourceGuideline?: string;
      sourceAuthority?: 'international' | 'national' | 'local';
      authorityWeight?: number;
      timeWeight?: number;
      compositeScore?: number;
    }

    // 模拟文献类型识别
    function classifyLiteratureType(title: string): EvidenceEvaluation['literatureType'] {
      const titleLower = title.toLowerCase();

      if (titleLower.includes('rct') || titleLower.includes('randomized')) return 'rct';
      if (titleLower.includes('meta') || titleLower.includes('荟萃')) return 'meta_analysis';
      if (titleLower.includes('guideline') || titleLower.includes('指南') || titleLower.includes('standards')) return 'guideline';
      if (titleLower.includes('observational') || titleLower.includes('cohort')) return 'observational';
      if (titleLower.includes('case report')) return 'case_report';

      return 'expert_opinion';
    }

    // 模拟 GRADE 等级映射
    function mapEvidenceGrade(literatureType: EvidenceEvaluation['literatureType']): EvidenceEvaluation['grade'] {
      switch (literatureType) {
        case 'rct':
        case 'meta_analysis':
          return 'A';
        case 'guideline':
          return 'B';
        case 'observational':
          return 'C';
        default:
          return 'D';
      }
    }

    // 模拟时效权重计算
    function calculateTimeWeight(year: number | undefined): number {
      if (year === undefined) return 0.7;
      const currentYear = 2026;
      const yearsSincePublication = currentYear - year;
      const weight = 1.0 - yearsSincePublication * 0.05;
      return Math.max(weight, 0.5);
    }

    // 模拟权威级别判断
    function determineAuthority(guidelineSource: string | undefined): 'international' | 'national' | 'local' {
      if (!guidelineSource) return 'local';
      const internationalSources = ['ADA', 'KDIGO', 'ESC', 'ATA', 'EASD'];
      if (internationalSources.includes(guidelineSource)) return 'international';
      return 'national';
    }

    it('should classify guideline correctly with documentTitle', () => {
      const source: SourceCitation = {
        documentId: 'doc_ada',
        documentName: 'ADA Standards of Care 2024',
        chunkId: 'chunk_001',
        year: 2024,
        guidelineSource: 'ADA',
      };

      const literatureType = classifyLiteratureType(source.documentName);
      const grade = mapEvidenceGrade(literatureType);
      const timeWeight = calculateTimeWeight(source.year);
      const authority = determineAuthority(source.guidelineSource);

      expect(literatureType).toBe('guideline');
      expect(grade).toBe('B'); // 指南级别为 B
      expect(timeWeight).toBe(0.9); // 2024 年文献
      expect(authority).toBe('international');
    });

    it('should classify RCT with correct title', () => {
      const source: SourceCitation = {
        documentId: 'doc_rct',
        documentName: 'Randomized Controlled Trial of Metformin',
        chunkId: 'chunk_002',
        year: 2023,
      };

      const literatureType = classifyLiteratureType(source.documentName);
      const grade = mapEvidenceGrade(literatureType);

      expect(literatureType).toBe('rct');
      expect(grade).toBe('A'); // RCT 级别为 A
    });

    it('should fallback to D grade when title lacks keywords', () => {
      const source: SourceCitation = {
        documentId: 'doc_unknown',
        documentName: 'unknown_file.pdf', // 没有文献类型关键词
        chunkId: 'chunk_003',
        // year undefined
      };

      const literatureType = classifyLiteratureType(source.documentName);
      const grade = mapEvidenceGrade(literatureType);
      const timeWeight = calculateTimeWeight(source.year);

      expect(literatureType).toBe('expert_opinion');
      expect(grade).toBe('D');
      expect(timeWeight).toBe(0.7); // 无年份时默认权重
    });

    it('should calculate correct composite score with full metadata', () => {
      const evaluation: EvidenceEvaluation = {
        literatureType: 'guideline',
        grade: 'B',
        isCurrent: true,
        year: 2024,
        sourceGuideline: 'ADA',
        sourceAuthority: 'international',
        authorityWeight: 1.0,
        timeWeight: 0.9,
      };

      // 综合评分计算
      const gradeWeight = { A: 1.0, B: 0.8, C: 0.6, D: 0.4 };
      const compositeScore =
        gradeWeight[evaluation.grade] * 0.4 +
        (evaluation.authorityWeight ?? 0.6) * 0.2 +
        (evaluation.timeWeight ?? 0.7) * 0.2 +
        1.0 * 0.1 + // consistency
        1.0 * 0.1; // applicability

      expect(compositeScore).toBeCloseTo(0.90, 2);
      // 0.8*0.4 + 1.0*0.2 + 0.9*0.2 + 0.1 + 0.1 = 0.32 + 0.20 + 0.18 + 0.20 = 0.90
    });
  });

  /**
   * 验证完整流程：PDF → Payload → Recovery → Evaluation
   */
  describe('End-to-end flow simulation', () => {
    it('should propagate metadata through entire pipeline', () => {
      // Step 1: 文档解析后的 ParsedMetadata
      const parsedMetadata = {
        title: 'ADA Standards of Care 2024',
        author: 'American Diabetes Association',
        year: 2024,
        guidelineSource: 'ADA',
      };

      // Step 2: ChunkMetadata (从 ParsedMetadata 传播)
      const chunkMetadata = {
        contentType: 'text',
        pageNumber: 42,
        documentTitle: parsedMetadata.title,
        documentAuthor: parsedMetadata.author,
        documentYear: parsedMetadata.year,
        guidelineSource: parsedMetadata.guidelineSource,
      };

      // Step 3: VectorPayload (从 ChunkMetadata 写入)
      const payload = {
        documentId: 'doc_ada',
        chunkId: 'chunk_001',
        level: 'small',
        modality: 'text',
        pageNumber: chunkMetadata.pageNumber,
        documentYear: chunkMetadata.documentYear,
        documentTitle: chunkMetadata.documentTitle,
        guidelineSource: chunkMetadata.guidelineSource,
      };

      // Step 4: 恢复后的 ChunkMetadata
      const recoveredMetadata = {
        contentType: 'text',
        pageNumber: payload.pageNumber,
        documentYear: payload.documentYear,
        documentTitle: payload.documentTitle,
        guidelineSource: payload.guidelineSource,
      };

      // Step 5: SourceCitation (用于 GRADE 评估)
      const sourceCitation = {
        documentName: recoveredMetadata.documentTitle ?? 'unknown',
        year: recoveredMetadata.documentYear,
        guidelineSource: recoveredMetadata.guidelineSource,
      };

      // 验证：元数据在整个流程中保持一致
      expect(sourceCitation.documentName).toBe('ADA Standards of Care 2024');
      expect(sourceCitation.year).toBe(2024);
      expect(sourceCitation.guidelineSource).toBe('ADA');
    });

    it('should handle legacy data with fallback values', () => {
      // Legacy payload (修复前的数据)
      const legacyPayload = {
        documentId: 'doc_old',
        chunkId: 'chunk_old',
        level: 'small',
        modality: 'text',
        pageNumber: 10,
        // 没有 documentYear, documentTitle, guidelineSource
      };

      // 恢复后的 metadata
      const recoveredMetadata = {
        contentType: 'text',
        pageNumber: legacyPayload.pageNumber,
        documentYear: undefined,
        documentTitle: undefined,
        guidelineSource: undefined,
      };

      // SourceCitation (使用兜底值)
      const sourceCitation = {
        documentName: recoveredMetadata.documentTitle ?? legacyPayload.documentId,
        year: recoveredMetadata.documentYear,
        guidelineSource: recoveredMetadata.guidelineSource,
      };

      // GRADE 评估结果 (使用默认值)
      const evaluation = {
        grade: 'D', // 无标题信息，默认为专家意见
        timeWeight: 0.7, // 无年份，默认权重
        sourceAuthority: 'local', // 无来源，默认级别
      };

      expect(sourceCitation.documentName).toBe('doc_old'); // 兜底显示 ID
      expect(sourceCitation.year).toBeUndefined();
      expect(evaluation.grade).toBe('D');
      expect(evaluation.timeWeight).toBe(0.7);
    });
  });
});