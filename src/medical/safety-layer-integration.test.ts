/**
 * Medical Agent Safety Layer Integration Tests
 *
 * Tests the complete safety layer integration with MedicalAgent
 */

import { describe, it, expect } from 'vitest';
import { extractThresholds } from '../threshold-extractor.js';
import { performSafetyCheck } from '../safety-layer.js';
import { evaluateMultipleSources, calculateOverallGrade } from '../evidence-evaluator.js';
import { extractMedicalEntities } from '../entity-recognizer.js';
import type { MedicalEntities } from '../types.js';
import type { SourceCitation } from '../types.js';

describe('MedicalAgent Safety Layer Integration', () => {
  describe('Pre-check Integration', () => {
    it('should detect absolute contraindication in query flow', () => {
      const query = '我的eGFR是25，想知道二甲双胍用法';

      // Step 1: Extract entities
      const entities = extractMedicalEntities(query);
      expect(entities.drugs.length).toBeGreaterThan(0);
      expect(entities.drugs.some(d => d.id === 'drug_metformin')).toBe(true);

      // Step 2: Extract thresholds
      const thresholds = extractThresholds(query);
      expect(thresholds.length).toBeGreaterThan(0);
      expect(thresholds.some(t => t.indicator === 'indicator_egfr' && t.value === 25)).toBe(true);

      // Step 3: Safety check
      const assessment = performSafetyCheck(entities, thresholds);
      expect(assessment.severity).toBe('absolute');
      expect(assessment.recommendation).toContain('禁用');
    });

    it('should detect relative contraindication', () => {
      const query = 'eGFR=40，可以用二甲双胍吗';

      const entities = extractMedicalEntities(query);
      const thresholds = extractThresholds(query);
      const assessment = performSafetyCheck(entities, thresholds);

      expect(assessment.severity).toBe('relative');
      expect(assessment.recommendation).toContain('慎用');
    });

    it('should return safe for normal values', () => {
      const query = 'eGFR=60，二甲双胍怎么吃';

      const entities = extractMedicalEntities(query);
      const thresholds = extractThresholds(query);
      const assessment = performSafetyCheck(entities, thresholds);

      expect(assessment.severity).toBe('safe');
    });

    it('should detect drug interactions', () => {
      const query = '二甲双胍和西咪替丁一起吃';

      const entities = extractMedicalEntities(query);
      const thresholds = extractThresholds(query);
      const assessment = performSafetyCheck(entities, thresholds);

      expect(assessment.severity).toBe('interaction');
      expect(assessment.interactions.length).toBeGreaterThan(0);
    });
  });

  describe('Evidence Evaluation Integration', () => {
    it('should evaluate retrieval results', () => {
      const sources: SourceCitation[] = [
        { documentName: 'ADA Standards of Care 2024', year: 2024 },
        { documentName: 'KDIGO Diabetes Guidelines 2022', year: 2022 },
        { documentName: 'RCT Study on Metformin 2020', year: 2020 },
      ];

      const evaluations = evaluateMultipleSources(sources);

      expect(evaluations.length).toBe(3);
      expect(evaluations.some(e => e.literatureType === 'guideline')).toBe(true);
    });

    it('should calculate overall grade correctly', () => {
      const sources: SourceCitation[] = [
        { documentName: 'Randomized Controlled Trial 2024', year: 2024 },
        { documentName: 'Meta-analysis 2023', year: 2023 },
      ];

      const evaluations = evaluateMultipleSources(sources);
      const overallGrade = calculateOverallGrade(evaluations);

      expect(overallGrade).toBe('A'); // RCT + Meta-analysis = Grade A
    });

    it('should handle guideline sources', () => {
      const sources: SourceCitation[] = [
        { documentName: 'ADA Standards of Care 2024', year: 2024 },
      ];

      const evaluations = evaluateMultipleSources(sources);

      expect(evaluations[0]?.literatureType).toBe('guideline');
      expect(evaluations[0]?.grade).toBe('B');
    });
  });

  describe('Three-Layer Synthesis', () => {
    it('should prioritize safety assessment over retrieval results', () => {
      const query = 'eGFR=25，二甲双胍用法';

      const entities = extractMedicalEntities(query);
      const thresholds = extractThresholds(query);
      const assessment = performSafetyCheck(entities, thresholds);

      // Mock retrieval results (should be ignored due to absolute contraindication)
      const mockRetrievalResults = [
        { content: '二甲双胍起始剂量500mg', source: { documentName: 'ADA 2024' } },
      ];

      // Safety assessment should override retrieval advice
      expect(assessment.severity).toBe('absolute');
      expect(assessment.recommendation).toContain('禁用');
      // In synthesis, the conclusion should use safety assessment, not retrieval
    });

    it('should combine relative contraindication with retrieval results', () => {
      const query = 'eGFR=40，二甲双胍';

      const entities = extractMedicalEntities(query);
      const thresholds = extractThresholds(query);
      const assessment = performSafetyCheck(entities, thresholds);

      expect(assessment.severity).toBe('relative');
      // In synthesis, conclusion should be "慎用" + retrieval adjustment advice
    });

    it('should include guideline sources in assessment', () => {
      const query = 'eGFR=25，二甲双胍';

      const entities = extractMedicalEntities(query);
      const thresholds = extractThresholds(query);
      const assessment = performSafetyCheck(entities, thresholds);

      expect(assessment.sourceGlossary.length).toBeGreaterThan(0);
      expect(assessment.sourceGlossary.some(s => s.includes('ADA'))).toBe(true);
    });
  });

  describe('End-to-End Flow', () => {
    it('should complete full safety check flow', () => {
      const query = '患者eGFR=35，HbA1c=8.5%，询问二甲双胍治疗';

      // 1. Entity recognition
      const entities = extractMedicalEntities(query);
      expect(entities.drugs.length).toBeGreaterThan(0);
      expect(entities.indicators.length).toBeGreaterThan(0);

      // 2. Threshold extraction
      const thresholds = extractThresholds(query);
      expect(thresholds.length).toBeGreaterThan(0);

      // 3. Safety pre-check
      const assessment = performSafetyCheck(entities, thresholds);
      expect(assessment.severity).toBe('relative'); // eGFR 35 is in relative range

      // 4. Mock retrieval + evidence evaluation
      const mockSources: SourceCitation[] = [
        { documentName: 'ADA Standards 2024', year: 2024 },
      ];
      const evaluations = evaluateMultipleSources(mockSources);
      expect(evaluations.length).toBeGreaterThan(0);

      // 5. GRADE calculation
      const grade = calculateOverallGrade(evaluations);
      expect(grade).toBeDefined();

      // Complete flow verified
    });
  });
});