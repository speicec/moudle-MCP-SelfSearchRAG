## 1. Configuration

- [x] 1.1 Add `lowConfidenceThreshold?: number` to `ExtendedAgentConfig` interface in `src/medical/agent/types.ts`
- [x] 1.2 Set default value 0.3 in `AgentExecutor` constructor or config handling

## 2. Core Implementation

- [x] 2.1 Create `executeDirectRetrieval(query: string, entities: MedicalEntities)` method in `AgentExecutor.ts`
- [x] 2.2 Implement retrieval call using `this.context.retrieval(query, { topK, threshold })`
- [x] 2.3 Implement answer generation using `this.context.reasoner.generateAnswer(entities, results, safetyAssessment, [])`
- [x] 2.4 Build and return `AgentResult` with proper stats (iterations: 0, retrievalCalls: 1)

## 3. Entry Point Logic

- [x] 3.1 Add confidence check before `chooseExecutionMode()` call in `run()` method
- [x] 3.2 Emit `agent:mode` event with `mode: 'direct_retrieval'` and reason string
- [x] 3.3 Ensure visualization events flow is preserved (agent:input, agent:entities, agent:mode, agent:complete)

## 4. Visualization Support

- [x] 4.1 Verify `agent:mode` event format includes `{ mode: 'direct_retrieval', reason: '...' }`
- [x] 4.2 Ensure `agent:complete` event includes AgentResult from direct retrieval

## 5. Testing

- [x] 5.1 Add unit test for zero-entity query triggering direct retrieval
- [x] 5.2 Add unit test for single-entity query entering normal Agent flow
- [x] 5.3 Add unit test for custom threshold configuration
- [x] 5.4 Add unit test for direct retrieval returning correct results
- [x] 5.5 Verify existing Agent tests still pass (no regression)