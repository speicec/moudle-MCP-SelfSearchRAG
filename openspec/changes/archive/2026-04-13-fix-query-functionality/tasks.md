## 1. Frontend Bug Fix

- [x] 1.1 Fix store reference in VisualApp.tsx
  - Change `useDocumentStore` to `useChatStore` in QuickQuery component
  - Verify `submitQuery` function is now available

- [x] 1.2 Test QuickQuery after store fix
  - Submit a query through QuickQuery
  - Verify results are returned and displayed
  - Verify no JavaScript errors in console

## 2. Frontend Chat UI Integration

- [x] 2.1 Import ChatWindow component in VisualApp.tsx
  - Add ChatWindow import statement
  - Import useChatStore for state management

- [x] 2.2 Replace QuickQuery with ChatWindow in left panel
  - Remove QuickQuery component from left panel
  - Add ChatWindow component in the same location
  - Ensure proper styling and layout

- [x] 2.3 Connect ChatWindow to WebSocket events
  - Verify WebSocket connection for retrieval flow events
  - Ensure retrieval:start, retrieval:match, retrieval:complete events are handled
  - Update useRetrievalStore integration

- [x] 2.4 Test chat UI functionality
  - Test query submission and result display
  - Test result card expansion
  - Test conversation history
  - Test clear history functionality
  - Test error handling (network failure, empty results)

## 3. MCP Server Architecture Fix

- [x] 3.1 Create MCP RetrievalService
  - Create `src/mcp/mcp-retrieval-service.ts`
  - Implement class that wraps HierarchicalStore and SmallToBigRetriever
  - Add `query(queryText, options)` method
  - Add `getStats()` method
  - Add `deleteDocument(documentId)` method

- [x] 3.2 Modify app.ts to use HierarchicalStore
  - Import HierarchicalStore from chunking module
  - Initialize HierarchicalStore with persistence enabled
  - Create embedding service using factory
  - Create MCP RetrievalService with HierarchicalStore

- [x] 3.3 Update MCP handlers to use new RetrievalService
  - Modify query handler to use MCP RetrievalService
  - Update return format to Small-to-Big format
  - Modify getStats handler
  - Modify deleteDocument handler

- [x] 3.4 Remove or deprecate InMemoryVectorStore in MCP
  - Remove InMemoryVectorStore import and instantiation
  - Remove unused VectorStore-related code
  - Clean up imports

## 4. MCP Query Tool Testing

- [x] 4.1 Test MCP query with Claude Desktop
  - Start MCP server with `npm run mcp`
  - Connect Claude Desktop to MCP server
  - Execute query tool with test query
  - Verify results are returned with correct format

- [x] 4.2 Test MCP query with empty store
  - Test query when store has no data
  - Verify empty results message is returned

- [x] 4.3 Test MCP query options
  - Test top_k parameter
  - Test threshold parameter
  - Verify parameter handling is correct

- [x] 4.4 Test embedding dimension compatibility
  - Verify local embedding dimension matches stored chunks
  - Test with Chinese and English queries

## 5. Integration Testing

- [x] 5.1 Test HTTP Server query (regression test)
  - Verify `/api/chat/query` still works correctly
  - Verify no breaking changes to HTTP API

- [x] 5.2 Test MCP and HTTP Server data consistency
  - Upload new document via HTTP Server
  - Query via HTTP Server and MCP Server
  - Verify both return results from the same data source

- [x] 5.3 Test concurrent usage
  - Run HTTP Server and MCP Server simultaneously
  - Verify both can query without conflicts
  - Verify HierarchicalStore handles concurrent access

## 6. Documentation and Cleanup

- [x] 6.1 Update MCP tool description
  - Update query tool description to reflect new return format
  - Document parentChunkContent, contextWindow, similarityScore fields

- [x] 6.2 Clean up unused code
  - Remove unused InMemoryVectorStore references
  - Clean up unused imports in app.ts and handlers.ts

- [x] 6.3 Update README if needed
  - Document MCP query return format changes
  - Note configuration requirements for local embedding