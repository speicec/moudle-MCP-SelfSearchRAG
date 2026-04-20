## Why

pdfjs-dist 5.6.205 internally depends on @napi-rs/canvas@0.1.97, which uses `process.getBuiltinModule` API introduced in Node.js 20.6.0. Docker container running Node 18.20.8 lacks this API, causing `DOMMatrix is not defined` crash at startup.

## What Changes

- Upgrade Docker base image from `node:18-alpine` to `node:20-alpine` (or `node:22-alpine` for LTS)
- Update Node.js version requirement in package.json engines field
- Update healthcheck timeout if needed (Node 20 may have different startup characteristics)

## Capabilities

### New Capabilities

None - this is an infrastructure/runtime compatibility fix.

### Modified Capabilities

None - no spec-level behavior changes. Only runtime environment changes.

## Impact

- **Dockerfile**: Base image change (`node:18-alpine` → `node:20-alpine`)
- **package.json**: `engines.node` field update (`>=18.0.0` → `>=20.0.0`)
- **Docker image size**: Minimal change (Alpine variants are similar size)
- **Runtime behavior**: No functional changes, only compatibility fix
- **Deployment**: Existing containers need rebuild with new image