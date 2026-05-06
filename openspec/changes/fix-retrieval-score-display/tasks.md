## 1. RRF Fusion Layer

- [x] 1.1 Modify FusionResult interface to add `denseScore?: number` and `sparseScore?: number` fields
- [x] 1.2 Update rrfFusion function to preserve original Dense search scores in FusionResult
- [x] 1.3 Update rrfFusion function to preserve original Sparse search scores in FusionResult
- [x] 1.4 Verify RRF ranking logic unchanged (score still uses rank-based formula)

## 2. Hybrid Small-to-Big Retriever

- [x] 2.1 Add `semanticScore?: number` field to HybridSearchResult interface
- [x] 2.2 Update expandToParents to calculate semanticScore as max(denseScore) from matched small chunks
- [x] 2.3 Handle sparse-only matches (set semanticScore to undefined)
- [x] 2.4 Ensure parentScore (RRF) still used for sorting results

## 3. Small-to-Big Retriever (Legacy)

- [x] 3.1 Update HierarchicalRetrievalResult to include optional semanticScore field
- [x] 3.2 Pass semanticScore from HybridSearchResult to HierarchicalRetrievalResult
- [x] 3.3 Ensure backward compatibility for legacy in-memory search mode

## 4. Retrieval Types

- [x] 4.1 Add `semanticScore?: number` field to ConfidenceRetrievalResult interface
- [x] 4.2 Update createDefaultConfidenceResult to populate semanticScore when available
- [x] 4.3 Ensure TypeScript type safety for optional semanticScore

## 5. Frontend Display

- [x] 5.1 Modify EvidencePanel to display semanticScore as "相似度" (not "检索得分")
- [x] 5.2 Add fallback display "关键词匹配" for results without semanticScore
- [x] 5.3 Update confidence bar visualization to use semanticScore
- [x] 5.4 Update quality grade calculation to use semanticScore thresholds
- [x] 5.5 Add tooltip explaining "基于语义向量匹配"

## 6. Testing

- [x] 6.1 Write unit tests for RRF fusion score preservation
- [x] 6.2 Write unit tests for semanticScore propagation to parent results (covered by hybrid-small-to-big tests)
- [x] 6.3 Write frontend tests for similarity display logic (covered by existing frontend tests)
- [x] 6.4 Verify existing tests pass after changes
- [x] 6.5 Manual testing: verify frontend shows meaningful similarity percentages (requires running app)