## 1. Docker Configuration

- [x] 1.1 Update Dockerfile builder stage: `node:18-alpine` → `node:22-alpine`
- [x] 1.2 Update Dockerfile runtime stage: `node:18-alpine` → `node:22-alpine`

## 2. Package Configuration

- [x] 2.1 Update package.json engines: `"node": ">=18.0.0"` → `"node": ">=20.0.0"`

## 3. Verification

- [ ] 3.1 Build Docker image: `docker build -t rag-server .`
- [ ] 3.2 Run container: `docker run -p 3001:3001 rag-server`
- [ ] 3.3 Verify startup without DOMMatrix error
- [ ] 3.4 Check health endpoint: `curl http://localhost:3001/api/health`
- [ ] 3.5 Test PDF upload and processing functionality