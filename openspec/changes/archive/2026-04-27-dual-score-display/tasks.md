## 1. Frontend Type Definitions

- [x] 1.1 Add `semanticScore?: number` field to RetrievalResult interface in `src/frontend/store/index.ts`
- [x] 1.2 Add `semanticScore?: number` field to RetrievalResult interface in `src/frontend/store/retrievalStore.ts`
- [x] 1.3 Verify TypeScript compilation passes after type changes

## 2. EvidenceCard Score Display

- [x] 2.1 Refactor EvidenceCard to separate semantic score display section (left-aligned, primary visual priority)
- [x] 2.2 Add RRF ranking display section (middle position, showing "排名 #N" + "RRF X.X%")
- [x] 2.3 Update `getDisplayScore` function to return both semantic and RRF scores
- [x] 2.4 Add `getRRFRanking` function to calculate ranking position from RRF score

## 3. EvidenceCard Fallback Logic

- [x] 3.1 Update fallback display: when semanticScore undefined, show "关键词匹配" label in primary section
- [x] 3.2 Ensure RRF ranking still displayed when semanticScore undefined
- [x] 3.3 Update quality grade calculation: prefer semanticScore, fallback to similarityScore (RRF)

## 4. Tooltip Enhancement

- [x] 4.1 Add tooltip for semantic score section explaining "语义相似度：基于向量匹配"
- [x] 4.2 Add tooltip for RRF ranking section explaining "RRF 融合排名得分"
- [x] 4.3 Add tooltip for "关键词匹配" label explaining "仅通过 BM25 关键词搜索匹配"

## 5. EvidencePanel Statistics

- [x] 5.1 Update statistics display to show average semantic score when available
- [x] 5.2 Update statistics fallback to show RRF-based average when no semantic scores
- [x] 5.3 Ensure grade distribution calculation uses semanticScore when available

## 6. Testing

- [x] 6.1 Write frontend tests for dual score display with semanticScore
- [x] 6.2 Write frontend tests for fallback display without semanticScore
- [x] 6.3 Write frontend tests for tooltip content verification
- [x] 6.4 Verify existing EvidencePanel tests pass after changes
- [x] 6.5 Manual testing: verify frontend shows meaningful dual scores (requires running app)