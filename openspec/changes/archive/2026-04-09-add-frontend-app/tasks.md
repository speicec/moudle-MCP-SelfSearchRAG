## 1. Project Setup

- [x] 1.1 Add dependencies to package.json (fastify, @fastify/websocket, react, react-dom, zustand, tailwindcss, vite, @vitejs/plugin-react)
- [x] 1.2 Create vite.config.ts for frontend build configuration
- [x] 1.3 Update tsconfig.json to support frontend compilation (add frontend-specific compiler options)
- [x] 1.4 Create src/frontend/ directory structure (components, store, styles, types)

## 2. Backend HTTP Server

- [x] 2.1 Create src/server/http-server.ts with Fastify instance
- [x] 2.2 Create src/server/types.ts for HTTP/WebSocket type definitions (PipelineEvent interface)
- [x] 2.3 Create src/server/routes/documents.ts with upload, list, delete endpoints
- [x] 2.4 Create src/server/routes/chat.ts with query endpoint
- [x] 2.5 Create src/server/document-store.ts for document metadata management (file system storage)
- [x] 2.6 Register routes in http-server.ts
- [x] 2.7 Create src/main-server.ts as HTTP mode entry point

## 3. WebSocket Integration

- [x] 3.1 Install @fastify/websocket plugin in http-server.ts
- [x] 3.2 Create src/server/websocket-handler.ts with WebSocket route (/ws)
- [x] 3.3 Implement client connection management (Set<WebSocket> for broadcasting)
- [x] 3.4 Implement event broadcasting function (broadcastPipelineEvent)
- [x] 3.5 Implement message parsing and validation (JSON format check)

## 4. Pipeline Event Emitter

- [x] 4.1 Create src/server/pipeline-emitter.ts with event emission functions
- [x] 4.2 Add WebSocket emitter hook to src/core/hooks.ts (createWebSocketEmitterHook)
- [x] 4.3 Integrate emitter hook into Harness pipeline execution
- [x] 4.4 Add preExecution hook to emit pipeline:start event
- [x] 4.5 Add postStage hook to emit stage:complete events
- [x] 4.6 Add postExecution hook to emit pipeline:complete event
- [x] 4.7 Add onError hook to emit error events

## 5. Frontend Foundation

- [x] 5.1 Create src/frontend/main.tsx as React entry point
- [x] 5.2 Create src/frontend/App.tsx as root component (layout with three panels)
- [x] 5.3 Create src/frontend/index.css with Tailwind directives
- [x] 5.4 Create tailwind.config.js with content paths
- [x] 5.5 Create src/frontend/store/index.ts with Zustand store (documentStore, chatStore, pipelineStore, connectionStore)
- [x] 5.6 Create src/frontend/hooks/useWebSocket.ts for WebSocket connection management (connect, reconnect, disconnect)
- [x] 5.7 Implement automatic reconnection with exponential backoff

## 6. Frontend DocumentManager Component

- [x] 6.1 Create src/frontend/components/DocumentManager.tsx component
- [x] 6.2 Implement document list display (fetch from /api/documents endpoint)
- [x] 6.3 Implement file upload form with multipart/form-data
- [x] 6.4 Implement upload progress indicator
- [x] 6.5 Implement document deletion with confirmation
- [x] 6.6 Implement document status display (pending/processing/indexed/error)

## 7. Frontend ChatWindow Component

- [x] 7.1 Create src/frontend/components/ChatWindow.tsx component
- [x] 7.2 Implement chat message display (user messages and system responses)
- [x] 7.3 Implement query input form
- [x] 7.4 Implement query submission to /api/chat/query endpoint
- [x] 7.5 Implement retrieval result display (parent chunk content, similarity score, source reference)
- [x] 7.6 Implement chat history management (store in Zustand)
- [x] 7.7 Implement error message display in chat window

## 8. Frontend PipelineVisualizer Component

- [x] 8.1 Create src/frontend/components/PipelineVisualizer.tsx component
- [x] 8.2 Implement pipeline stage display (Ingest→Parse→Chunk→Embed→Index nodes)
- [x] 8.3 Implement stage progress bar (listen to stage:progress events)
- [x] 8.4 Implement stage completion indicator (listen to stage:complete events)
- [x] 8.5 Implement pipeline completion status display (listen to pipeline:complete event)
- [x] 8.6 Implement error display (listen to error events)
- [x] 8.7 Implement document-specific pipeline tracking (by documentId)

## 9. Frontend-Backend Integration

- [x] 9.1 Configure Vite build to output to dist/frontend/
- [x] 9.2 Configure Fastify to serve static frontend files from dist/frontend/
- [x] 9.3 Configure Fastify to serve index.html for / route
- [x] 9.4 Test WebSocket connection establishment from frontend
- [x] 9.5 Test document upload flow end-to-end
- [x] 9.6 Test chat query flow end-to-end
- [x] 9.7 Test pipeline visualization end-to-end

## 10. Testing and Documentation

- [x] 10.1 Create src/__tests__/server.test.ts for HTTP routes tests
- [x] 10.2 Create src/__tests__/websocket.test.ts for WebSocket handler tests
- [x] 10.3 Create src/frontend/__tests__/components.test.tsx for component tests
- [x] 10.4 Update README.md with HTTP mode usage instructions
- [x] 10.5 Create scripts/dev-server.sh for development mode (vite dev + fastify)
- [x] 10.6 Create scripts/build.sh for production build (vite build + tsc)