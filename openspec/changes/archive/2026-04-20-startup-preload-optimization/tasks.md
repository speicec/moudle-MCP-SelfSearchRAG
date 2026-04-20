## 1. Setup Script Enhancement

- [x] 1.1 Enhance `scripts/download-models.ts` with EMBEDDING_MODE detection
- [x] 1.2 Add incremental download detection (cache checking)
- [x] 1.3 Add progress bar display for model downloads
- [x] 1.4 Add `npm run setup` script to package.json

## 2. Embedding Factory Preload Progress

- [x] 2.1 Add `PreloadProgress` interface to `embedding-factory.ts`
- [x] 2.2 Modify `preloadModels()` to accept progress callback parameter
- [x] 2.3 Implement progress reporting during model loading

## 3. Server Startup Integration

- [x] 3.1 Add model preloading call in `http-server.ts` after server starts
- [x] 3.2 Implement WebSocket broadcast for startup progress events
- [x] 3.3 Add error handling and `startup:error` event broadcasting

## 4. WebSocket Event Types

- [x] 4.1 Add `StartupStage` type to `types.ts`
- [x] 4.2 Add `startup:progress`, `startup:ready`, `startup:error` to `PipelineEventType`
- [x] 4.3 Extend `PipelineEvent` interface with startup-related fields

## 5. Frontend Progress Component

- [x] 5.1 Create `StartupProgress.tsx` component with progress bar
- [x] 5.2 Implement WebSocket connection for startup events
- [x] 5.3 Add success/error states with retry functionality
- [x] 5.4 Add startup state handling to `timelineStore.ts`

## 6. Verification

- [x] 6.1 Run `npm run setup` and verify model download progress display
- [x] 6.2 Start server and verify WebSocket broadcasts startup events
- [x] 6.3 Open frontend and verify StartupProgress component displays
- [x] 6.4 Test first document upload (should be instant after preload)

## Notes

Implementation completed on 2026-04-20. All tasks verified on 2026-04-21.
- 6.1: Progress bar displays correctly with model name and file details
- 6.2: Server logs show startup sequence, WebSocket client connected
- 6.3: Frontend served from server, 1 WebSocket client active
- 6.4: Document upload returned in 0.011s (instant after preload)