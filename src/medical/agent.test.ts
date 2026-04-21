/**
 * Agent Module Tests - Agent 模块单元测试
 */

import { describe, it, expect } from 'vitest';
import {
  createInitialState,
  updateState,
  setStatus,
  incrementIteration,
  addReasoningStep,
  updateRetrievalResults,
  markSatisfied,
  setAnswer,
  setError,
  isMaxIterationsReached,
  canContinue,
  serializeState,
  getStateSummary,
  cloneState,
} from './agent/AgentState.js';
import type {
  AgentState,
  AgentAction,
  Observation,
  MedicalEntities,
  MedicalAnswer,
} from './agent/types.js';
import {
  THINK_PROMPT,
  DECIDE_PROMPT,
  ANSWER_PROMPT,
  QUALITY_PROMPT,
} from './agent/AgentPrompts.js';

// ==================== AgentState Tests ====================

describe('AgentState', () => {
  const mockEntities: MedicalEntities = {
    diseases: [{ id: 'disease_diabetes', canonicalName: '糖尿病', matchedTerm: '糖尿病', aliases: ['T2DM'] }],
    drugs: [{ id: 'drug_metformin', canonicalName: '二甲双胍', matchedTerm: '二甲双胍', aliases: ['Metformin'], classification: { category: '降糖药', subcategory: '胰岛素增敏剂' } }],
    indicators: [],
    relations: [],
    rawQuery: '二甲双胍禁忌症',
    confidence: 0.85,
  };

  describe('createInitialState', () => {
    it('should create initial state with correct values', () => {
      const state = createInitialState('二甲双胍禁忌症', mockEntities, 5);

      expect(state.query).toBe('二甲双胍禁忌症');
      expect(state.iteration).toBe(0);
      expect(state.maxIterations).toBe(5);
      expect(state.entities).toEqual(mockEntities);
      expect(state.reasoningTrace).toEqual([]);
      expect(state.status).toBe('initialized');
      expect(state.satisfied).toBe(false);
    });

    it('should use default maxIterations', () => {
      const state = createInitialState('测试', mockEntities);
      expect(state.maxIterations).toBe(5);
    });
  });

  describe('updateState', () => {
    it('should update state with new values', () => {
      const state = createInitialState('测试', mockEntities);
      const updated = updateState(state, { iteration: 1, satisfied: true });

      expect(updated.iteration).toBe(1);
      expect(updated.satisfied).toBe(true);
      expect(updated.query).toBe('测试'); // preserved
    });
  });

  describe('setStatus', () => {
    it('should change status', () => {
      const state = createInitialState('测试', mockEntities);
      const updated = setStatus(state, 'thinking');

      expect(updated.status).toBe('thinking');
    });
  });

  describe('incrementIteration', () => {
    it('should increment iteration by 1', () => {
      const state = createInitialState('测试', mockEntities);
      const updated = incrementIteration(state);

      expect(updated.iteration).toBe(1);
    });
  });

  describe('addReasoningStep', () => {
    it('should add reasoning step to trace', () => {
      const state = createInitialState('测试', mockEntities);
      const action: AgentAction = { type: 'retrieve', reason: '首次检索' };
      const updated = addReasoningStep(state, action);

      expect(updated.reasoningTrace.length).toBe(1);
      expect(updated.reasoningTrace[0].action).toEqual(action);
      expect(updated.reasoningTrace[0].iteration).toBe(0);
    });

    it('should add step with observation and decision', () => {
      const state = createInitialState('测试', mockEntities);
      const action: AgentAction = { type: 'retrieve', reason: '检索' };
      const observation: Observation = { type: 'retrieval', data: [], success: true };
      const updated = addReasoningStep(state, action, observation);

      expect(updated.reasoningTrace[0].observation).toEqual(observation);
    });
  });

  describe('updateRetrievalResults', () => {
    it('should add new retrieval results', () => {
      const state = createInitialState('测试', mockEntities);
      const results = [
        { content: 'ADA指南建议...', source: { documentName: 'ADA 2024' } },
      ];
      const updated = updateRetrievalResults(state, results);

      expect(updated.retrievalResults?.length).toBe(1);
    });

    it('should merge results without duplicates', () => {
      const state = createInitialState('测试', mockEntities);
      const results1 = [
        { content: 'ADA指南建议...', source: { documentName: 'ADA 2024' } },
      ];
      const state2 = updateRetrievalResults(state, results1);
      const results2 = [
        { content: 'ADA指南建议...', source: { documentName: 'ADA 2024' } }, // duplicate
        { content: 'KDIGO指南...', source: { documentName: 'KDIGO' } },
      ];
      const updated = updateRetrievalResults(state2, results2);

      expect(updated.retrievalResults?.length).toBe(2); // deduped
    });
  });

  describe('markSatisfied', () => {
    it('should mark satisfied', () => {
      const state = createInitialState('测试', mockEntities);
      const updated = markSatisfied(state, true);

      expect(updated.satisfied).toBe(true);
    });
  });

  describe('setAnswer', () => {
    it('should set answer', () => {
      const state = createInitialState('测试', mockEntities);
      const answer: MedicalAnswer = {
        conclusion: { text: '测试结论', confidence: 'high' },
        details: { points: [] },
        evidenceGrade: { grade: 'B', sourceType: 'guideline' },
        sources: [],
        warnings: ['仅供参考'],
      };
      const updated = setAnswer(state, answer);

      expect(updated.answer).toEqual(answer);
    });
  });

  describe('setError', () => {
    it('should set error and status', () => {
      const state = createInitialState('测试', mockEntities);
      const updated = setError(state, '测试错误');

      expect(updated.error).toBe('测试错误');
      expect(updated.status).toBe('failed');
    });
  });

  describe('isMaxIterationsReached', () => {
    it('should return false when below max', () => {
      const state = createInitialState('测试', mockEntities, 5);
      expect(isMaxIterationsReached(state)).toBe(false);
    });

    it('should return true when at max', () => {
      const state = createInitialState('测试', mockEntities, 3);
      const updated = incrementIteration(incrementIteration(incrementIteration(state)));
      expect(isMaxIterationsReached(updated)).toBe(true);
    });
  });

  describe('canContinue', () => {
    it('should return true when conditions allow', () => {
      const state = createInitialState('测试', mockEntities);
      expect(canContinue(state)).toBe(true);
    });

    it('should return false when status is completed', () => {
      const state = setStatus(createInitialState('测试', mockEntities), 'completed');
      expect(canContinue(state)).toBe(false);
    });

    it('should return false when max iterations reached', () => {
      const state = createInitialState('测试', mockEntities, 1);
      const updated = incrementIteration(state);
      expect(canContinue(updated)).toBe(false);
    });
  });

  describe('serializeState', () => {
    it('should serialize state to JSON', () => {
      const state = createInitialState('测试', mockEntities);
      const serialized = serializeState(state);

      expect(serialized).toContain('"iteration": 0');
      expect(serialized).toContain('"status": "initialized"');
    });
  });

  describe('getStateSummary', () => {
    it('should return summary with key info', () => {
      const state = createInitialState('二甲双胍禁忌', mockEntities);
      const summary = getStateSummary(state);

      expect(summary.iteration).toBe(0);
      expect(summary.status).toBe('initialized');
      expect(summary.entities).toContain('糖尿病');
      expect(summary.entities).toContain('二甲双胍');
      expect(summary.satisfied).toBe(false);
      expect(summary.hasAnswer).toBe(false);
    });
  });

  describe('cloneState', () => {
    it('should create independent copy', () => {
      const state = createInitialState('测试', mockEntities);
      const cloned = cloneState(state);

      expect(cloned).not.toBe(state);
      expect(cloned.entities).not.toBe(state.entities);
      expect(cloned.entities.diseases).not.toBe(state.entities.diseases);
    });
  });
});

// ==================== AgentPrompts Tests ====================

describe('AgentPrompts', () => {
  const mockEntities: MedicalEntities = {
    diseases: [{ id: 'disease_diabetes', canonicalName: '糖尿病', matchedTerm: '糖尿病', aliases: ['T2DM'] }],
    drugs: [],
    indicators: [],
    relations: [],
    rawQuery: '糖尿病治疗方案',
    confidence: 0.8,
  };

  describe('THINK_PROMPT', () => {
    it('should generate think prompt with entities', () => {
      const prompt = THINK_PROMPT({
        entities: mockEntities,
        iteration: 1,
        reasoningTrace: [],
      });

      expect(prompt).toContain('迭代次数: 1');
      expect(prompt).toContain('疾病: 糖尿病');
      expect(prompt).toContain('ACTION:');
    });

    it('should include retrieval results', () => {
      const prompt = THINK_PROMPT({
        entities: mockEntities,
        iteration: 1,
        retrievalResults: [{ content: 'ADA指南', source: { documentName: 'ADA' } }],
        reasoningTrace: [],
      });

      expect(prompt).toContain('ADA指南');
    });
  });

  describe('DECIDE_PROMPT', () => {
    it('should generate decide prompt', () => {
      const prompt = DECIDE_PROMPT({
        entities: mockEntities,
        iteration: 1,
      });

      expect(prompt).toContain('判断是否满足');
      expect(prompt).toContain('SATISFIED');
    });
  });

  describe('ANSWER_PROMPT', () => {
    it('should generate answer prompt with entities', () => {
      const prompt = ANSWER_PROMPT({
        entities: mockEntities,
      });

      expect(prompt).toContain('糖尿病治疗方案');
      expect(prompt).toContain('## 结论');
      expect(prompt).toContain('## 详细说明');
    });

    it('should include retrieval results', () => {
      const prompt = ANSWER_PROMPT({
        entities: mockEntities,
        retrievalResults: [{ content: 'ADA 2024建议', source: { documentName: 'ADA Standards', year: 2024 } }],
      });

      expect(prompt).toContain('ADA 2024建议');
      expect(prompt).toContain('ADA Standards');
    });
  });

  describe('QUALITY_PROMPT', () => {
    it('should generate quality check prompt', () => {
      const answer: MedicalAnswer = {
        conclusion: { text: '结论', confidence: 'high' },
        details: { points: [{ text: '要点', sources: [] }] },
        evidenceGrade: { grade: 'B', sourceType: 'guideline' },
        sources: [{ documentName: 'ADA' }],
        warnings: ['警告'],
      };
      const prompt = QUALITY_PROMPT({ answer });

      expect(prompt).toContain('质量检查');
      expect(prompt).toContain('VALID|INVALID');
    });
  });
});