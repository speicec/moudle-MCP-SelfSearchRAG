## 1. Backend Type Extensions

- [x] 1.1 Extend RetrievalResultItem interface in `src/server/types.ts` to include optional `evidenceEvaluation` field matching `EvidenceEvaluation` type
- [x] 1.2 Extend AgentResult interface in `src/medical/agent/types.ts` to include `evidenceEvaluation` array and `overallEvidenceGrade` field
- [x] 1.3 Add TypeScript type guards for EvidenceEvaluation presence check

## 2. AgentExecutor Data Flow

- [x] 2.1 Modify `buildResult()` in `src/medical/agent/AgentExecutor.ts` to include `state.evidenceEvaluation` in returned AgentResult
- [x] 2.2 Add validation check: `evidenceEval.length === retrievalResults.length` before passing to result
- [x] 2.3 Calculate `overallEvidenceGrade` from sorted evidence using existing `calculateOverallGrade()` function
- [x] 2.4 Add evidence statistics calculation: gradeDistribution, averageCompositeScore, conflictDetected

## 3. WebSocket Event Extensions

- [x] 3.1 Extend `retrieval:complete` event structure in `src/server/routes/chat.ts` to include `evidenceEvaluation` per result
- [x] 3.2 Extend `generation:complete` event in `src/server/agent-emitter.ts` to include `overallEvidenceGrade` and `evidenceStatistics`
- [x] 3.3 Add new `evidence:evaluated` WebSocket event type for real-time GRADE display
- [x] 3.4 Update PipelineEvent type in `src/server/types.ts` to include new evidence fields

## 4. Frontend Type Extensions

- [x] 4.1 Extend RetrievalResult interface in `src/frontend/store/index.ts` to include optional `evidenceEvaluation`
- [x] 4.2 Create EvidenceEvaluation type in frontend matching backend structure
- [x] 4.3 Update useChatStore to handle results with evidenceEvaluation from WebSocket events

## 5. EvidenceCard Component Enhancement

- [x] 5.1 Add `getGradeFromEvaluation()` function in `src/frontend/components/EvidencePanel.tsx` to prioritize backend GRADE over similarityScore
- [x] 5.2 Modify EvidenceCard to display GRADE badge with grade letter and literature type label
- [x] 5.3 Add authority level indicator display (international/national/local icons)
- [x] 5.4 Add time decay warning display when timeWeight < 0.7 or expirationWarning exists
- [x] 5.5 Update expanded view to show full metadata: literatureType, sourceAuthority, compositeScore, timeWeight

## 6. EvidencePanel Statistics Enhancement

- [x] 6.1 Modify grade distribution calculation to use backend GRADE when available
- [x] 6.2 Add average compositeScore display in header statistics
- [x] 6.3 Handle mixed mode: some results with GRADE, some with fallback
- [x] 6.4 Update quality distribution bar chart to show GRADE A/B/C/D labels

## 7. AnswerCard Evidence Summary

- [x] 7.1 Add overall evidence grade display in AnswerCard footer
- [x] 7.2 Add conflict warning display when evidenceStatistics.conflictDetected is true
- [x] 7.3 Show source count per grade level in answer metadata

## 8. Integration Testing

- [x] 8.1 Add test for AgentExecutor.buildResult() including evidenceEvaluation
- [x] 8.2 Add test for WebSocket events containing GRADE data
- [x] 8.3 Add frontend test for EvidenceCard GRADE display
- [x] 8.4 Add frontend test for fallback behavior when no GRADE data
- [x] 8.5 Manual end-to-end test: query → retrieval → GRADE evaluation → frontend display