## Context

The RAG system uses local embedding models (bge-m3 for hybrid mode, multilingual-e5 for local mode) loaded via @huggingface/transformers. Currently, models are loaded lazily on first request, causing:

1. **First request delay**: Users wait 2-5 minutes when models need to be downloaded
2. **No feedback**: No indication of what's happening during model loading
3. **User confusion**: Error messages like "No embeddings generated" appear before models finish loading

The existing WebSocket infrastructure already supports real-time events for document processing (pipeline stages). This change extends that infrastructure for startup progress.

## Goals / Non-Goals

**Goals:**
- Preload models at server startup to eliminate first-request delay
- Provide real-time startup progress via WebSocket events
- Add `npm run setup` for pre-downloading models before deployment
- Support incremental model downloads (skip cached models)

**Non-Goals:**
- Parallel model loading (models load sequentially by design)
- Offline-only mode (models still need network for initial download)
- OCR model preloading (OCR is a separate Python service)
- GPU-based model loading optimization

## Decisions

### Decision 1: Preload after HTTP server starts

**Choice**: Preload models after HTTP server is listening, not before.

**Rationale**: 
- Server can respond to health checks immediately (Docker/K8s readiness probes)
- WebSocket can broadcast progress while models load
- Alternatives considered:
  - Preload before server start → Server appears dead during load, readiness probes fail
  - Parallel preload → Race conditions with first requests

### Decision 2: Use existing WebSocket infrastructure

**Choice**: Extend existing PipelineEvent types with startup events rather than creating a separate channel.

**Rationale**:
- Reuses existing WebSocket handler and client connection logic
- Consistent event format for frontend
- Minimal code changes
- Alternatives considered:
  - Separate SSE endpoint → Additional infrastructure, harder to integrate with existing frontend
  - HTTP polling → Not real-time, wasted requests when ready

### Decision 3: Model cache detection via filesystem

**Choice**: Check for `model.onnx_data` file existence and minimum size to determine if model is cached.

**Rationale**:
- Transformers.js doesn't expose a "is model cached" API
- File existence check is fast and reliable
- Size threshold (100MB for large models) catches incomplete downloads
- Alternatives considered:
  - Hash verification → Too slow for startup
  - Try loading and check time → Unclear threshold, varies by machine

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Model download fails during startup | Broadcast `startup:error` event, frontend shows retry button, server continues running |
| Large model download (>2GB) takes long time | Show progress percentage, allow user to run `npm run setup` separately before deployment |
| Cache corruption detected late | Size threshold check catches most incomplete downloads, re-download triggers automatically |
| Memory pressure during preload | Models loaded sequentially, not parallel; preload only text model by default |

## Architecture

```
Startup Flow:
                                          
  npm run setup                            npm run start:server
       │                                        │
       ▼                                        ▼
  [download-models.ts]                    [http-server.ts]
       │                                        │
       ├── Check EMBEDDING_MODE                ├── Start Fastify server
       ├── Detect cached models                ├── Initialize stores
       ├── Download missing models             ├── Create WebSocket handler
       └── Progress bar output                 │
       │                                        ▼
       ▼                                    [preloadModels()]
  Models cached ✓                              │
                                               ├── Broadcast startup:progress
                                               ├── Load hybrid/local model
                                               ├── Broadcast startup:ready
                                               │
                                               ▼
                                           Server ready ✓
```