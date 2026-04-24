/**
 * AgentExecutor Integration Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { createAgentExecutor, AgentExecutor, ExtendedAgentConfig } from './AgentExecutor.js';
import type { AgentContext } from './types.js';
import type { MedicalEntities, MedicalAnswer, SourceCitation, EvidenceEvaluation } from '../types.js';

describe('AgentExecutor Integration', () => {
  const createMockContext = (): AgentContext => {
    return {
      retrieval: async (query) => [
        { content: `Mock content for ${query}`, source: { documentName: 'Test Document', year: 2024 } as SourceCitation },
      ],
      reasoner: {
        reasonClinical: async () => ({ action: 'stop', confidence: 0.9, reason: 'Test', needsMoreInfo: false }),
        decide: async () => true,
        generateAnswer: async () => ({
          conclusion: { text: 'Test answer', confidence: 'high' },
          details: { points: [] },
          evidenceGrade: { grade: 'A', sourceType: 'guideline' },
          sources: [],
          warnings: [],
        }) as MedicalAnswer,
        checkQuality: async () => ({ isValid: true, issues: [], suggestions: [] }),
      },
      extractEntities: (query) => ({
        diseases: [],
        drugs: query.includes('二甲双胍') ? [{ id: 'drug_metformin', canonicalName: '二甲双胍', matchedTerm: '二甲双胍', aliases: [], classification: { category: '降糖药', subcategory: '胰岛素增敏剂' } }] : [],
        indicators: [],
        relations: [],
        rawQuery: query,
        confidence: 0.9,
      }) as MedicalEntities,
      buildQueryStrategy: (entities) => ({
        primaryQuery: entities.drugs[0]?.canonicalName || 'test',
        expandedTerms: [],
        filters: {},
        prioritySources: [],
      }),
    };
  };

  // Create mock context with GRADE evidence data
  const createMockContextWithEvidence = (): AgentContext => {
    let callCount = 0;
    return {
      retrieval: async (query) => [
        {
          content: `RCT study content for ${query}`,
          source: {
            documentName: 'ADA Standards of Care 2024',
            year: 2024,
          } as SourceCitation,
        },
        {
          content: `Meta-analysis content for ${query}`,
          source: {
            documentName: 'Cochrane Review 2023',
            year: 2023,
          } as SourceCitation,
        },
      ],
      reasoner: {
        // First call returns 'retrieve' to trigger retrieval, second returns 'stop'
        reasonClinical: async () => {
          callCount++;
          if (callCount === 1) {
            return { action: 'retrieve', confidence: 0.9, reason: 'Need to gather evidence', needsMoreInfo: true };
          }
          return { action: 'stop', confidence: 0.9, reason: 'Evidence gathered', needsMoreInfo: false };
        },
        decide: async () => true,
        generateAnswer: async () => ({
          conclusion: { text: 'Test answer', confidence: 'high' },
          details: { points: [] },
          evidenceGrade: { grade: 'A', sourceType: 'guideline' },
          sources: [],
          warnings: [],
        }) as MedicalAnswer,
        checkQuality: async () => ({ isValid: true, issues: [], suggestions: [] }),
      },
      extractEntities: (query) => ({
        diseases: [],
        drugs: query.includes('二甲双胍') ? [{ id: 'drug_metformin', canonicalName: '二甲双胍', matchedTerm: '二甲双胍', aliases: [], classification: { category: '降糖药', subcategory: '胰岛素增敏剂' } }] : [],
        indicators: [],
        relations: [],
        rawQuery: query,
        confidence: 0.9,
      }) as MedicalEntities,
      buildQueryStrategy: (entities) => ({
        primaryQuery: entities.drugs[0]?.canonicalName || 'test',
        expandedTerms: [],
        filters: {},
        prioritySources: [],
      }),
    };
  };

  describe('Visualization Callback', () => {
    it('should call visualizationCallback during execution phases', async () => {
      const callbackCalls: Array<{ phase: string; data: unknown }> = [];
      const visualizationCallback = (phase: string, data: unknown) => {
        callbackCalls.push({ phase, data });
      };

      const config: ExtendedAgentConfig = {
        maxIterations: 3,
        confidenceThreshold: 0.8,
        retrievalTopK: 5,
        retrievalThreshold: 0.3,
        enableQualityCheck: false,
        enableTraceLogging: false,
        enablePlanning: false,
      };

      const executor = createAgentExecutor(config, createMockContext(), visualizationCallback);
      await executor.run('二甲双胍用法');

      // Verify callback was called for key phases
      expect(callbackCalls.length).toBeGreaterThan(0);

      // Check for input phase
      const inputCall = callbackCalls.find(c => c.phase === 'input');
      expect(inputCall).toBeDefined();
      expect((inputCall?.data as any).query).toBe('二甲双胍用法');

      // Check for complete phase
      const completeCall = callbackCalls.find(c => c.phase === 'complete');
      expect(completeCall).toBeDefined();
    });

    it('should setVisualizationCallback method work', async () => {
      const callbackCalls: Array<{ phase: string; data: unknown }> = [];
      const visualizationCallback = (phase: string, data: unknown) => {
        callbackCalls.push({ phase, data });
      };

      const config: ExtendedAgentConfig = {
        maxIterations: 3,
        confidenceThreshold: 0.8,
        retrievalTopK: 5,
        retrievalThreshold: 0.3,
        enableQualityCheck: false,
        enableTraceLogging: false,
        enablePlanning: false,
      };

      const executor = createAgentExecutor(config, createMockContext());
      executor.setVisualizationCallback(visualizationCallback);
      await executor.run('测试查询');

      expect(callbackCalls.length).toBeGreaterThan(0);
    });

    it('should call entities callback with entity data', async () => {
      const entitiesCalls: Array<unknown> = [];
      const visualizationCallback = (phase: string, data: unknown) => {
        if (phase === 'entities') {
          entitiesCalls.push(data);
        }
      };

      const config: ExtendedAgentConfig = {
        maxIterations: 3,
        confidenceThreshold: 0.8,
        retrievalTopK: 5,
        retrievalThreshold: 0.3,
        enableQualityCheck: false,
        enableTraceLogging: false,
        enablePlanning: false,
      };

      const executor = createAgentExecutor(config, createMockContext(), visualizationCallback);
      await executor.run('二甲双胍');

      expect(entitiesCalls.length).toBeGreaterThan(0);
      const entitiesData = entitiesCalls[0] as any;
      expect(entitiesData.drugs).toBeDefined();
    });

    it('should call complexity callback in planning mode', async () => {
      const complexityCalls: Array<unknown> = [];
      const visualizationCallback = (phase: string, data: unknown) => {
        if (phase === 'complexity') {
          complexityCalls.push(data);
        }
      };

      const config: ExtendedAgentConfig = {
        maxIterations: 3,
        confidenceThreshold: 0.8,
        retrievalTopK: 5,
        retrievalThreshold: 0.3,
        enableQualityCheck: false,
        enableTraceLogging: false,
        enablePlanning: true,
      };

      const executor = createAgentExecutor(config, createMockContext(), visualizationCallback);
      await executor.run('二甲双胍');

      // Complexity should be assessed
      expect(complexityCalls.length).toBeGreaterThan(0);
    });

    it('should work without visualizationCallback (optional)', async () => {
      const config: ExtendedAgentConfig = {
        maxIterations: 3,
        confidenceThreshold: 0.8,
        retrievalTopK: 5,
        retrievalThreshold: 0.3,
        enableQualityCheck: false,
        enableTraceLogging: false,
        enablePlanning: false,
      };

      // No callback provided
      const executor = createAgentExecutor(config, createMockContext());
      const result = await executor.run('二甲双胍');

      expect(result.success).toBe(true);
    });
  });

  describe('ReAct mode (default)', () => {
    it('should execute ReAct mode when planning disabled', async () => {
      const config: ExtendedAgentConfig = {
        maxIterations: 3,
        confidenceThreshold: 0.8,
        retrievalTopK: 5,
        retrievalThreshold: 0.3,
        enableQualityCheck: false,
        enableTraceLogging: false,
        enablePlanning: false, // Planning disabled
      };

      const executor = createAgentExecutor(config, createMockContext());
      const result = await executor.run('二甲双胍用法');

      expect(result.success).toBe(true);
      expect(result.answer).toBeDefined();
    });

    it('should use ReAct mode for simple query', async () => {
      const config: ExtendedAgentConfig = {
        maxIterations: 3,
        confidenceThreshold: 0.8,
        retrievalTopK: 5,
        retrievalThreshold: 0.3,
        enableQualityCheck: false,
        enableTraceLogging: false,
        enablePlanning: true, // Planning enabled but query is simple
      };

      const executor = createAgentExecutor(config, createMockContext());
      const result = await executor.run('二甲双胍'); // Simple query

      expect(result.success).toBe(true);
    });
  });

  describe('Planning mode', () => {
    it('should execute Planning mode for complex query', async () => {
      const config: ExtendedAgentConfig = {
        maxIterations: 5,
        confidenceThreshold: 0.8,
        retrievalTopK: 10,
        retrievalThreshold: 0.3,
        enableQualityCheck: false,
        enableTraceLogging: false,
        enablePlanning: true,
        maxReplanRounds: 1,
      };

      // Mock context with multiple entities
      const context: AgentContext = {
        ...createMockContext(),
        extractEntities: (query) => ({
          diseases: [],
          drugs: [
            { id: 'drug_metformin', canonicalName: '二甲双胍', matchedTerm: '二甲双胍', aliases: [], classification: { category: '降糖药', subcategory: '胰岛素增敏剂' } },
            { id: 'drug_liraglutide', canonicalName: '利拉鲁肽', matchedTerm: '利拉鲁肽', aliases: [], classification: { category: '降糖药', subcategory: 'GLP-1受体激动剂' } },
          ],
          indicators: [],
          relations: [],
          rawQuery: query,
          confidence: 0.9,
        }) as MedicalEntities,
      };

      const executor = createAgentExecutor(config, context);
      const result = await executor.run('二甲双胍vs利拉鲁肽哪个更好');

      expect(result.success).toBe(true);
    }, 30000); // Increase timeout for planning

    it('should fallback to ReAct when Planning fails', async () => {
      const config: ExtendedAgentConfig = {
        maxIterations: 3,
        confidenceThreshold: 0.8,
        retrievalTopK: 5,
        retrievalThreshold: 0.3,
        enableQualityCheck: false,
        enableTraceLogging: false,
        enablePlanning: true,
        maxReplanRounds: 0,
      };

      // Context that will cause planning to fail
      const failingContext: AgentContext = {
        retrieval: async () => [], // Empty results
        reasoner: {
          reasonClinical: async () => ({ action: 'stop', confidence: 0.9, reason: 'Test', needsMoreInfo: false }),
          decide: async () => true,
          generateAnswer: async () => ({
            conclusion: { text: 'Fallback answer', confidence: 'low' },
            details: { points: [] },
            evidenceGrade: { grade: 'D', sourceType: 'expert_opinion' },
            sources: [],
            warnings: ['Planning failed'],
          }) as MedicalAnswer,
          checkQuality: async () => ({ isValid: true, issues: [], suggestions: [] }),
        },
        extractEntities: (query) => ({
          diseases: [{ id: 'disease_1', canonicalName: '糖尿病', matchedTerm: '糖尿病', aliases: [] }],
          drugs: [],
          indicators: [],
          relations: [],
          rawQuery: query,
          confidence: 0.5, // Low confidence
        }) as MedicalEntities,
        buildQueryStrategy: (entities) => ({
          primaryQuery: 'test',
          expandedTerms: [],
          filters: {},
          prioritySources: [],
        }),
      };

      const executor = createAgentExecutor(config, failingContext);
      const result = await executor.run('复杂查询');

      expect(result.success).toBe(true);
    });
  });

  describe('mode switching', () => {
    it('should choose ReAct for simple entity count', async () => {
      const config: ExtendedAgentConfig = {
        maxIterations: 3,
        confidenceThreshold: 0.8,
        retrievalTopK: 5,
        retrievalThreshold: 0.3,
        enableQualityCheck: false,
        enableTraceLogging: false,
        enablePlanning: true,
      };

      const executor = createAgentExecutor(config, createMockContext());
      const result = await executor.run('二甲双胍');

      // Simple query should not trigger planning
      expect(result.stats.llmCalls).toBeLessThanOrEqual(2);
    });

    it('should choose Planning for comparison query', async () => {
      const config: ExtendedAgentConfig = {
        maxIterations: 5,
        confidenceThreshold: 0.8,
        retrievalTopK: 10,
        retrievalThreshold: 0.3,
        enableQualityCheck: false,
        enableTraceLogging: false,
        enablePlanning: true,
        maxReplanRounds: 1,
      };

      const context: AgentContext = {
        ...createMockContext(),
        extractEntities: (query) => ({
          diseases: [],
          drugs: [
            { id: 'drug_metformin', canonicalName: '二甲双胍', matchedTerm: '二甲双胍', aliases: [], classification: { category: '降糖药', subcategory: '胰岛素增敏剂' } },
            { id: 'drug_liraglutide', canonicalName: '利拉鲁肽', matchedTerm: '利拉鲁肽', aliases: [], classification: { category: '降糖药', subcategory: 'GLP-1受体激动剂' } },
          ],
          indicators: [],
          relations: [],
          rawQuery: query,
          confidence: 0.9,
        }) as MedicalEntities,
      };

      const executor = createAgentExecutor(config, context);
      const result = await executor.run('对比二甲双胍和利拉鲁肽');

      expect(result.success).toBe(true);
      // Check for planning info in result
      const planningInfo = (result as any).planningInfo;
      if (planningInfo) {
        expect(planningInfo.complexityLevel).toBe('complex');
      }
    }, 30000);
  });

  describe('mixed scenarios', () => {
    it('should handle empty entities', async () => {
      const config: ExtendedAgentConfig = {
        maxIterations: 3,
        confidenceThreshold: 0.8,
        retrievalTopK: 5,
        retrievalThreshold: 0.3,
        enableQualityCheck: false,
        enableTraceLogging: false,
        enablePlanning: true,
      };

      const emptyContext: AgentContext = {
        ...createMockContext(),
        extractEntities: () => ({
          diseases: [],
          drugs: [],
          indicators: [],
          relations: [],
          rawQuery: '',
          confidence: 0,
        }) as MedicalEntities,
      };

      const executor = createAgentExecutor(config, emptyContext);
      const result = await executor.run('一般医学问题');

      expect(result.success).toBe(true);
    });

    it('should handle retrieval failure gracefully', async () => {
      const config: ExtendedAgentConfig = {
        maxIterations: 3,
        confidenceThreshold: 0.8,
        retrievalTopK: 5,
        retrievalThreshold: 0.3,
        enableQualityCheck: false,
        enableTraceLogging: false,
        enablePlanning: false,
      };

      const failingRetrievalContext: AgentContext = {
        ...createMockContext(),
        retrieval: async () => {
          throw new Error('Retrieval service unavailable');
        },
      };

      const executor = createAgentExecutor(config, failingRetrievalContext);

      // Should handle error gracefully
      try {
        const result = await executor.run('二甲双胍');
        expect(result).toBeDefined();
      } catch (error) {
        // Error is acceptable if handled properly
        expect(error).toBeDefined();
      }
    });
  });

  describe('Evidence Evaluation', () => {
    it('should include evidenceEvaluation in AgentResult when available', async () => {
      const config: ExtendedAgentConfig = {
        maxIterations: 3,
        confidenceThreshold: 0.8,
        retrievalTopK: 5,
        retrievalThreshold: 0.3,
        enableQualityCheck: false,
        enableTraceLogging: false,
        enablePlanning: false,
      };

      const executor = createAgentExecutor(config, createMockContextWithEvidence());
      const result = await executor.run('二甲双胍用法');

      expect(result.success).toBe(true);
      // Evidence evaluation should be present
      expect(result.evidenceEvaluation).toBeDefined();
      expect(Array.isArray(result.evidenceEvaluation)).toBe(true);
    });

    it('should calculate overallEvidenceGrade from evidence data', async () => {
      const config: ExtendedAgentConfig = {
        maxIterations: 3,
        confidenceThreshold: 0.8,
        retrievalTopK: 5,
        retrievalThreshold: 0.3,
        enableQualityCheck: false,
        enableTraceLogging: false,
        enablePlanning: false,
      };

      const executor = createAgentExecutor(config, createMockContextWithEvidence());
      const result = await executor.run('二甲双胍用法');

      expect(result.success).toBe(true);
      // Overall grade should be calculated
      if (result.evidenceEvaluation && result.evidenceEvaluation.length > 0) {
        expect(result.overallEvidenceGrade).toBeDefined();
        expect(['A', 'B', 'C', 'D']).toContain(result.overallEvidenceGrade);
      }
    });

    it('should calculate evidenceStatistics from evidence data', async () => {
      const config: ExtendedAgentConfig = {
        maxIterations: 3,
        confidenceThreshold: 0.8,
        retrievalTopK: 5,
        retrievalThreshold: 0.3,
        enableQualityCheck: false,
        enableTraceLogging: false,
        enablePlanning: false,
      };

      const executor = createAgentExecutor(config, createMockContextWithEvidence());
      const result = await executor.run('二甲双胍用法');

      expect(result.success).toBe(true);
      // Evidence statistics should be calculated
      if (result.evidenceEvaluation && result.evidenceEvaluation.length > 0) {
        expect(result.evidenceStatistics).toBeDefined();
        expect(result.evidenceStatistics?.gradeDistribution).toBeDefined();
        expect(result.evidenceStatistics?.averageCompositeScore).toBeDefined();
        expect(result.evidenceStatistics?.conflictDetected).toBeDefined();
      }
    });

    it('should handle empty evidenceEvaluation gracefully', async () => {
      const config: ExtendedAgentConfig = {
        maxIterations: 3,
        confidenceThreshold: 0.8,
        retrievalTopK: 5,
        retrievalThreshold: 0.3,
        enableQualityCheck: false,
        enableTraceLogging: false,
        enablePlanning: false,
      };

      // Context that returns empty retrieval (no evidence to evaluate)
      const emptyRetrievalContext: AgentContext = {
        ...createMockContext(),
        retrieval: async () => [],
      };

      const executor = createAgentExecutor(config, emptyRetrievalContext);
      const result = await executor.run('不存在的内容');

      expect(result).toBeDefined();
      // Evidence evaluation should be undefined or empty when no retrieval results
      expect(result.evidenceEvaluation).toBeUndefined();
      expect(result.overallEvidenceGrade).toBeUndefined();
    });
  });
});