/**
 * Agent State - Agent 状态管理
 *
 * 管理 Agent 的状态初始化、更新和序列化
 */

import type {
  AgentState,
  AgentStatus,
  AgentAction,
  Observation,
  AgentDecision,
  ReasoningStep,
  MedicalEntities,
  SourceCitation,
  MedicalAnswer,
} from './types.js';

/**
 * 创建初始 Agent 状态
 */
export function createInitialState(
  query: string,
  entities: MedicalEntities,
  maxIterations: number = 5,
): AgentState {
  const state: AgentState = {
    query,
    iteration: 0,
    maxIterations,
    entities,
    reasoningTrace: [],
    status: 'initialized',
    satisfied: false,
  };
  return state;
}

/**
 * 更新 Agent 状态
 */
export function updateState(
  state: AgentState,
  updates: Partial<AgentState>,
): AgentState {
  return {
    ...state,
    ...updates,
  };
}

/**
 * 设置状态状态
 */
export function setStatus(state: AgentState, status: AgentStatus): AgentState {
  return updateState(state, { status });
}

/**
 * 增加迭代次数
 */
export function incrementIteration(state: AgentState): AgentState {
  return updateState(state, {
    iteration: state.iteration + 1,
  });
}

/**
 * 添加推理步骤
 */
export function addReasoningStep(
  state: AgentState,
  action: AgentAction,
  observation?: Observation,
  decision?: AgentDecision,
): AgentState {
  const step: ReasoningStep = {
    iteration: state.iteration,
    timestamp: new Date().toISOString(),
    action,
  };
  if (observation !== undefined) {
    step.observation = observation;
  }
  if (decision !== undefined) {
    step.decision = decision;
  }

  return updateState(state, {
    reasoningTrace: [...state.reasoningTrace, step],
  });
}

/**
 * 更新检索结果
 */
export function updateRetrievalResults(
  state: AgentState,
  results: Array<{
    content: string;
    source: SourceCitation;
    similarityScore?: number;
  }>,
): AgentState {
  // 合并新旧结果（避免重复）
  const existingIds = new Set(
    state.retrievalResults?.map(r => r.content.slice(0, 50)) ?? []
  );

  const newResults = results.filter(r => !existingIds.has(r.content.slice(0, 50)));
  const mergedResults = [...(state.retrievalResults ?? []), ...newResults];

  return updateState(state, {
    retrievalResults: mergedResults,
  });
}

/**
 * 标记为满足
 */
export function markSatisfied(state: AgentState, satisfied: boolean): AgentState {
  return updateState(state, { satisfied });
}

/**
 * 设置回答
 */
export function setAnswer(state: AgentState, answer: MedicalAnswer): AgentState {
  const newState = { ...state };
  newState.answer = answer;
  return newState;
}

/**
 * 设置错误
 */
export function setError(state: AgentState, error: string): AgentState {
  return updateState(state, {
    error,
    status: 'failed',
  });
}

/**
 * 检查是否达到最大迭代
 */
export function isMaxIterationsReached(state: AgentState): boolean {
  return state.iteration >= state.maxIterations;
}

/**
 * 检查是否可以继续
 */
export function canContinue(state: AgentState): boolean {
  return (
    state.status !== 'completed' &&
    state.status !== 'failed' &&
    !isMaxIterationsReached(state) &&
    !state.satisfied &&
    !state.error
  );
}

/**
 * 序列化状态（用于日志）
 */
export function serializeState(state: AgentState): string {
  return JSON.stringify({
    iteration: state.iteration,
    status: state.status,
    satisfied: state.satisfied,
    entitiesCount: {
      diseases: state.entities.diseases.length,
      drugs: state.entities.drugs.length,
      indicators: state.entities.indicators.length,
    },
    retrievalCount: state.retrievalResults?.length ?? 0,
    traceLength: state.reasoningTrace.length,
    error: state.error,
  }, null, 2);
}

/**
 * 获取状态摘要（用于显示）
 */
export function getStateSummary(state: AgentState): {
  iteration: number;
  status: AgentStatus;
  entities: string[];
  retrievalCount: number;
  satisfied: boolean;
  hasAnswer: boolean;
  error?: string;
} {
  const summary: {
    iteration: number;
    status: AgentStatus;
    entities: string[];
    retrievalCount: number;
    satisfied: boolean;
    hasAnswer: boolean;
    error?: string;
  } = {
    iteration: state.iteration,
    status: state.status,
    entities: [
      ...state.entities.diseases.map(d => d.canonicalName),
      ...state.entities.drugs.map(d => d.canonicalName),
      ...state.entities.indicators.map(i => i.canonicalName),
    ],
    retrievalCount: state.retrievalResults?.length ?? 0,
    satisfied: state.satisfied,
    hasAnswer: state.answer !== undefined,
  };
  if (state.error !== undefined) {
    summary.error = state.error;
  }
  return summary;
}

/**
 * 克隆状态（用于分支探索）
 */
export function cloneState(state: AgentState): AgentState {
  const cloned: AgentState = {
    ...state,
    reasoningTrace: [...state.reasoningTrace],
    entities: {
      ...state.entities,
      diseases: [...state.entities.diseases],
      drugs: [...state.entities.drugs],
      indicators: [...state.entities.indicators],
      relations: [...state.entities.relations],
    },
  };
  if (state.retrievalResults !== undefined) {
    cloned.retrievalResults = state.retrievalResults.map(r => ({
      ...r,
      source: { ...r.source },
    }));
  }
  return cloned;
}

/**
 * 从历史恢复状态（用于调试）
 */
export function restoreFromHistory(
  history: ReasoningStep[],
  baseState: AgentState,
  targetIteration: number,
): AgentState {
  const relevantSteps = history.filter(s => s.iteration <= targetIteration);

  let state = baseState;

  for (const step of relevantSteps) {
    state = incrementIteration(state);
    state = addReasoningStep(state, step.action, step.observation, step.decision);
  }

  return state;
}