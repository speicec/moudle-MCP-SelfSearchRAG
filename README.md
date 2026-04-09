# Enhanced RAG MCP Server

A powerful RAG (Retrieval-Augmented Generation) system with multimodal support and advanced PDF parsing, exposed via MCP (Model Context Protocol) server.

## Features

- **Multimodal Support**: Process text and images with unified embedding and retrieval
- **Advanced PDF Parsing**: Extract tables, charts, formulas, and handle multi-column layouts
- **Harness Architecture**: Flexible, pluggable pipeline for document processing
- **MCP Server**: Standard interface for AI assistants (Claude Desktop, etc.)
- **Hybrid Search**: Combine semantic and keyword search with configurable weights
- **Semantic Chunking**: Embedding-based chunk boundaries using cosine similarity cliff detection
- **Hierarchical Retrieval**: Small-to-Big retrieval strategy with parent-child chunk structure
- **Web Dashboard**: React frontend for document management, chat queries, and pipeline visualization

## Installation

```bash
npm install
npm run build
```

## Configuration

Set environment variables:

```bash
# Required for OpenAI embeddings
OPENAI_API_KEY=your-api-key

# Optional: Custom API endpoint
OPENAI_API_BASE_URL=https://api.openai.com/v1

# Optional: Image embedding endpoint
IMAGE_EMBEDDING_ENDPOINT=your-endpoint
```

## Usage

### HTTP Mode (Web Dashboard)

Start the HTTP server with WebSocket support:

```bash
npm run start:server
```

This starts:
- HTTP API at http://localhost:3001
- WebSocket endpoint at ws://localhost:3001/ws
- Web dashboard at http://localhost:3001

#### Command Line Options

```bash
node dist/server/main-server.js --port=3001 --host=localhost
```

#### Features

- **Document Manager**: Upload, view, and delete documents
- **Chat Window**: Query your documents with Small-to-Big retrieval
- **Pipeline Visualizer**: Real-time progress of document processing stages

### MCP Mode (Claude Desktop)

Add to Claude Desktop configuration (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "rag": {
      "command": "node",
      "args": ["/path/to/enhanced-rag-mcp-server/dist/mcp/server.js"]
    }
  }
}
```

### Available Tools

#### `ingest_document`

Ingest a document into the RAG system.

```json
{
  "document_path": "/path/to/document.pdf",
  "metadata": {
    "title": "Document Title",
    "tags": ["research", "pdf"]
  }
}
```

#### `query`

Search for relevant content.

```json
{
  "query_text": "What is the main conclusion?",
  "top_k": 5,
  "threshold": 0.7
}
```

#### `get_document`

Get document details by ID.

```json
{
  "document_id": "doc-uuid"
}
```

#### `list_documents`

List all indexed documents.

```json
{
  "limit": 20,
  "status_filter": "indexed"
}
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Fastify Server                       │
│  ┌─────────────┐  ┌─────────────┐  ┌────────────────┐  │
│  │ HTTP Routes │  │  WebSocket  │  │  Pipeline      │  │
│  │ /documents  │  │   Handler   │  │   Emitter      │  │
│  │ /chat       │  │             │  │                │  │
│  └─────────────┘  └─────────────┘  └────────────────┘  │
│                          │                              │
│                          ▼                              │
│  ┌───────────────────────────────────────────────────┐ │
│  │               Harness Pipeline                    │ │
│  │   Ingest → Parse → Chunk → Embed → Index         │ │
│  └───────────────────────────────────────────────────┘ │
│                          │                              │
│                          ▼                              │
│  ┌───────────────────────────────────────────────────┐ │
│  │            React Frontend Bundle                  │ │
│  │  DocumentManager │ ChatWindow │ PipelineVisualizer│ │
│  └───────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Pipeline Stages

1. **Ingest**: Validate and store document
2. **Parse**: Extract text, tables, images, formulas
3. **Chunk**: Semantic chunking using embedding similarity cliffs
4. **Embed**: Generate vector embeddings
5. **Index**: Store in hierarchical structure (small + parent chunks)

### WebSocket Events

| Event Type | Description |
|------------|-------------|
| `pipeline:start` | Document processing started |
| `stage:start` | Pipeline stage started |
| `stage:progress` | Stage progress update (0-100%) |
| `stage:complete` | Pipeline stage completed |
| `pipeline:complete` | All stages finished |
| `error` | Processing error occurred |

## Development

```bash
# Development build with watch
npm run dev

# Frontend development with hot reload
npm run dev:frontend

# Run tests
npm test

# Lint code
npm run lint

# Build for production (backend + frontend)
npm run build
```

## API Endpoints

### Documents

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/documents/upload` | Upload document |
| GET | `/api/documents` | List all documents |
| GET | `/api/documents/:id` | Get document metadata |
| DELETE | `/api/documents/:id` | Delete document |

### Chat

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/chat/query` | Submit query for retrieval |
| GET | `/api/chat/history` | Get chat history |
| DELETE | `/api/chat/history` | Clear chat history |

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/ws-status` | WebSocket connection count |

## License

MIT