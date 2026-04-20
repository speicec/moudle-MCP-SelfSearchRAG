## Context

**Current State**:
- Dockerfile uses `node:18-alpine` for both builder and runtime stages
- pdfjs-dist@5.6.205 bundled with @napi-rs/canvas@0.1.97
- @napi-rs/canvas uses `process.getBuiltinModule` (Node 20.6.0+ API)
- Container crashes at startup with `DOMMatrix is not defined`

**Root Cause Chain**:
```
Node 18 lacks process.getBuiltinModule
    ↓
@napi-rs/canvas polyfill detection fails
    ↓
createCanvas returns incompatible object
    ↓
DOMMatrix polyfill breaks
    ↓
pdfjs-dist legacy module crashes: new DOMMatrix() → ReferenceError
```

## Goals / Non-Goals

**Goals:**
- Fix Docker container startup crash caused by Node 18/pdfjs-dist incompatibility
- Maintain backward compatibility with existing code (no source changes needed)
- Keep Alpine-based image for minimal size

**Non-Goals:**
- Changing pdfjs-dist version (5.x is correct, provides better PDF rendering)
- Changing canvas implementation approach (DOM polyfill in main-server.ts is valid)
- Adding new features or modifying existing behavior

## Decisions

### Decision 1: Node.js Version Choice

**Selected**: `node:22-alpine`

**Alternatives Considered**:
| Version | Status | LTS End | Trade-off |
|---------|--------|---------|-----------|
| 20-alpine | Active LTS | Apr 2026 | Works, but LTS window shorter |
| 22-alpine | Current LTS | Apr 2027 | Latest LTS, longest support window |
| 24-alpine | Current release | Not LTS | Too new, not production-stable |

**Rationale**: Node 22 is the current LTS (since Oct 2024), providing longest support window. Alpine variant maintains minimal image size.

### Decision 2: Dockerfile Stage Updates

**Selected**: Update both builder and runtime stages to `node:22-alpine`

**Rationale**: Consistency between build and runtime environments reduces potential for subtle incompatibilities. Both stages should use same Node version.

## Risks / Trade-offs

| Risk | Impact | Mitigation |
|------|--------|------------|
| Native module incompatibility | @napi-rs/canvas binary may need rebuild | Alpine APK already includes build deps; npm ci rebuilds native modules |
| Docker image size change | Node 22 image may be slightly larger | Alpine variant; impact minimal (~10MB difference) |
| Existing containers orphaned | Users need to rebuild | Document in release notes; not a breaking API change |

## Migration Plan

1. Update Dockerfile base images
2. Update package.json engines requirement
3. Rebuild Docker image: `docker build -t rag-server .`
4. Verify startup: `docker run -p 3001:3001 rag-server`
5. Check health endpoint: `curl http://localhost:3001/api/health`

**Rollback**: If issues arise, revert to `node:18-alpine` and downgrade pdfjs-dist to 3.x/4.x (requires canvas polyfill changes).