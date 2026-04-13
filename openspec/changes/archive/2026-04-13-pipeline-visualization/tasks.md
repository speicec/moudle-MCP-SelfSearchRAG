## 1. Backend - WebSocket Event Extensions

- [x] 1.1 Add `stage:metrics` event type and emission in pipeline-emitter.ts
- [x] 1.2 Add `chunk:created` event type and emission in document-processor.ts
- [x] 1.3 Add `retrieval:start`, `retrieval:match`, `retrieval:complete` events in chat.ts
- [x] 1.4 Add `stats:update` event type and periodic emission mechanism
- [x] 1.5 Extend WebSocket event type definitions in src/server/types.ts

## 2. Backend - API Endpoints

- [x] 2.1 Create `/api/documents/:id/chunks` endpoint with pagination/filter/sort
- [x] 2.2 Implement `getChunksPaginated` method in hierarchical-store.ts
- [x] 2.3 Create `/api/stats` endpoint for global statistics
- [x] 2.4 Create src/server/routes/stats.ts with statistics aggregation logic

## 3. Backend - Metrics Collection

- [x] 3.1 Add metrics collection hooks in buildPipeline stages
- [x] 3.2 Implement chunk creation event batch emission (every 10 chunks)
- [x] 3.3 Create statistics aggregation service for pipeline/retrieval/chunk stats

## 4. Frontend - State Management

- [x] 4.1 Create timelineStore.ts with timeline state and WebSocket event handlers
- [x] 4.2 Create chunkStore.ts with chunk list state and pagination
- [x] 4.3 Create statsStore.ts with statistics state and refresh logic
- [x] 4.4 Update useWebSocket.ts to handle new event types
- [x] 4.5 Integrate new stores in src/frontend/store/index.ts

## 5. Frontend - PipelineTimeline Component

- [x] 5.1 Create PipelineTimeline.tsx base structure with stage cards
- [x] 5.2 Implement timeline visualization with time axis
- [x] 5.3 Add stage progress animation with Framer Motion
- [x] 5.4 Implement metrics card slide-in animation
- [x] 5.5 Add stage-specific metrics display (ingest/parse/embed/index)

## 6. Frontend - ChunkExplorer Component

- [x] 6.1 Create ChunkExplorer.tsx base structure with tree/grid toggle
- [x] 6.2 Implement tree view with parent-child hierarchy
- [x] 6.3 Implement grid view with chunk cards
- [x] 6.4 Add filter/sort controls (level, quality, position)
- [x] 6.5 Implement pagination controls with page navigation
- [x] 6.6 Create ChunkDetailModal.tsx with full chunk information
- [x] 6.7 Add chunk creation fade-in animation
- [x] 6.8 Implement virtual scrolling for large chunk lists

## 7. Frontend - RetrievalFlow Component

- [x] 7.1 Create RetrievalFlow.tsx base structure with step cards
- [x] 7.2 Implement query embedding visualization (text → model → vector)
- [x] 7.3 Implement similarity search visualization (vector space abstraction)
- [x] 7.4 Implement parent expansion visualization (small → parent arrows)
- [x] 7.5 Add result cards with sequential slide-in animation
- [x] 7.6 Integrate with chat query submission flow

## 8. Frontend - StatsDashboard Component

- [x] 8.1 Create StatsDashboard.tsx base structure with stat cards
- [x] 8.2 Implement pipeline statistics display (time, throughput, document breakdown)
- [x] 8.3 Implement retrieval statistics display (latency, success rate)
- [x] 8.4 Implement chunk quality distribution chart
- [x] 8.5 Implement stage time distribution chart with optimization hints
- [x] 8.6 Add performance indicators (优秀/良好/需优化)

## 9. Frontend - Layout Integration

- [x] 9.1 Create VisualApp.tsx with tab layout (处理进度/分块结构/检索过程/系统统计)
- [x] 9.2 Implement left panel with quick upload, query, and document list
- [x] 9.3 Add WebSocket connection indicator in header
- [x] 9.4 Integrate tab state persistence across navigation
- [x] 9.5 Replace/update App.tsx to use VisualApp layout

## 10. Testing & Integration

- [x] 10.1 Verify WebSocket events are correctly emitted during pipeline
- [x] 10.2 Test chunk pagination API with various filters/sorts
- [x] 10.3 Verify statistics API returns correct aggregated data
- [x] 10.4 Test frontend components with simulated WebSocket events
- [x] 10.5 Verify animations are smooth (60fps target)
- [x] 10.6 End-to-end test: upload → timeline → chunks → query → retrieval visualization

**Testing completed:** 2026-04-10
- Query API returns results with similarity scores 0.90+
- Document upload and indexing works correctly
- Embedding dimension matching (384-dim multilingual-e5-small)