## Why

Currently, embedding models are loaded lazily on first request, causing users to wait several minutes when uploading their first document after server startup. This creates a poor user experience and gives the impression that the system is broken. Additionally, there is no feedback mechanism to inform users about model download/loading progress during startup.

## What Changes

- **Model Preloading**: Models are now loaded at server startup instead of on first request
- **Setup Script**: New `npm run setup` command for pre-downloading models before first run
- **Incremental Download**: Smart cache detection skips already downloaded models
- **WebSocket Progress Events**: Real-time startup progress broadcast via WebSocket
- **Frontend Progress Display**: New `StartupProgress` component showing model loading status
- **Progress Callback**: `preloadModels()` method now accepts progress callback parameter

## Capabilities

### New Capabilities

- `startup-progress`: Model preloading and startup status reporting via WebSocket events

### Modified Capabilities

- `websocket-protocol`: Extended with new event types `startup:progress`, `startup:ready`, `startup:error`

## Impact

- **Files Modified**:
  - `scripts/download-models.ts` - Enhanced with mode detection and progress display
  - `src/embedding/embedding-factory.ts` - Added `PreloadProgress` type and progress callback
  - `src/server/http-server.ts` - Added model preloading after server start
  - `src/server/types.ts` - Added startup event types
  - `src/frontend/store/timelineStore.ts` - Added startup state handling
  - `package.json` - Added `setup` script

- **Files Added**:
  - `src/frontend/components/StartupProgress.tsx` - Startup progress UI component

- **Dependencies**: None - uses existing WebSocket infrastructure

- **User Experience**: Users now see clear progress during startup, and first document upload is instant