/**
 * Agent Visualization Types - Frontend type definitions for Agent visualization
 *
 * Mirrors backend types for WebSocket event handling
 */

/**
 * Entity match from Agent entity recognition
 */
export interface EntityMatch {
  matchedTerm: string;
  canonicalName: string;
  entityType: 'disease' | 'drug' | 'indicator';
  confidence: number;
  value?: number;
  unit?: string;
}

/**
 * Keyword match for contraindications/precautions
 */
export interface KeywordMatch {
  keyword: string;
  type: 'contraindication' | 'precaution' | 'interaction' | 'indication';
  position: [number, number];
}

/**
 * Complexity assessment result
 */
export interface ComplexityAssessment {
  level: 'simple' | 'moderate' | 'complex';
  needsPlanning: boolean;
  entityCount: number;
  hasComparison: boolean;
  hasConditions: boolean;
  hasInteraction: boolean;
  reason: string;
}

/**
 * Query rewriting strategy
 */
export interface QueryRewriting {
  primaryQuery: string;
  expandedTerms: string[];
  filters?: {
    yearRange?: [number, number];
    sources?: string[];
  };
}

/**
 * Template attempt during matching
 */
export interface TemplateAttempt {
  templateId: string;
  templateName: string;
  matched: boolean;
  rejectionReason?: string;
}

/**
 * Task in DAG structure
 */
export interface DAGTask {
  id: string;
  type: string;
  params?: Record<string, unknown>;
  dependencies: string[];
  priority: number;
}

/**
 * DAG structure for Planning mode
 */
export interface TaskDAG {
  tasks: DAGTask[];
  entryTasks: string[];
  exitTasks: string[];
  parallelGroups: string[][];
}

/**
 * Executor state during execution
 */
export interface ExecutorState {
  status: 'pending' | 'running' | 'completed' | 'failed';
  currentRound: number;
  completedCount: number;
  failedCount: number;
  runningTasks: string[];
}

/**
 * Agent result summary
 */
export interface AgentResultSummary {
  satisfied: boolean;
  retrievalCount: number;
  totalTimeMs: number;
  iterations?: number;
  llmCallCount?: number;
}

/**
 * Agent phase names
 */
export type AgentPhase = 'input' | 'entities' | 'complexity' | 'mode' | 'query_rewrite' | 'template' | 'dag' | 'execution' | 'complete';

/**
 * Execution mode
 */
export type ExecutionMode = 'react' | 'planning';

/**
 * Complete Agent visualization state
 */
export interface AgentVisualization {
  // Input phase
  query?: string;

  // Entity recognition
  entityMatches?: EntityMatch[];
  keywordMatches?: KeywordMatch[];

  // Complexity assessment
  complexity?: ComplexityAssessment;

  // Mode selection
  executionMode?: ExecutionMode;
  executionReason?: string;
  matchedTemplate?: string;

  // Query rewriting
  queryRewriting?: QueryRewriting;

  // Template matching
  templateAttempts?: TemplateAttempt[];

  // DAG (Planning mode)
  dag?: TaskDAG;

  // Execution state
  executorState?: ExecutorState;

  // Result summary
  agentResult?: AgentResultSummary;
}

/**
 * Execution trace step
 */
export interface ExecutionTraceStep {
  phase: AgentPhase;
  timestamp: number;
  duration?: number;
  details?: Record<string, unknown>;
}

/**
 * Complete execution trace
 */
export interface ExecutionTrace {
  steps: ExecutionTraceStep[];
  totalTimeMs: number;
}