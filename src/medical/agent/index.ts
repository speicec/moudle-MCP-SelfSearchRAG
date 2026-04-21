/**
 * Medical Agent Module - 医学 Agent 模块
 */

export {
  MedicalReasoner,
  createMedicalReasoner,
  type ReasoningState,
  type ReasoningDecision,
  type MedicalReasonerConfig,
  DEFAULT_REASONER_CONFIG,
} from './MedicalReasoner.js';

export {
  THINK_PROMPT,
  DECIDE_PROMPT,
  ANSWER_PROMPT,
  QUALITY_PROMPT,
  ENTITY_PROMPT,
  EXPAND_PROMPT,
} from './AgentPrompts.js';

export {
  // Types
  type AgentState,
  type AgentStatus,
  type AgentAction,
  type AgentActionType,
  type Observation,
  type AgentDecision,
  type AgentConfig,
  type AgentResult,
  type AgentContext,
  type ReasoningStep,
  type MedicalEntities,
  type MedicalAnswer,
  type SourceCitation,
  DEFAULT_AGENT_CONFIG,
} from './types.js';

// State management functions
export {
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
} from './AgentState.js';

export {
  AgentExecutor,
  createAgentExecutor,
} from './AgentExecutor.js';

export {
  MedicalAgent,
  createMedicalAgent,
} from './MedicalAgent.js';

// Logger
export {
  AgentLogger,
  createAgentLogger,
  type LogLevel,
  type LogEntry,
  type AgentExecutionLog,
} from './AgentLogger.js';

// Cache
export {
  AgentCache,
  createAgentCache,
  getGlobalCache,
  setGlobalCache,
  DEFAULT_CACHE_CONFIG,
  type CacheConfig,
} from './AgentCache.js';