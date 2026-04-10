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
- **Local Embedding**: Zero-cost, offline-capable multilingual embeddings using transformers.js
- **Multilingual Support**: Chinese, English, and 100+ languages for semantic search
- **Cross-modal Search**: Text-to-image and image-to-text retrieval using CLIP

## Installation

```bash
npm install
npm run build
```

### Pre-download Models (Optional)

For offline operation, download models before first use:

```bash
npm run download-models
```

This downloads:
- `multilingual-e5-small` (~118MB) - Multilingual text embedding
- `clip-vit-base-patch32` (~340MB) - Multimodal image/text embedding

Models are cached in `~/.cache/huggingface/hub/` (or `%USERPROFILE%\.cache\huggingface\hub\` on Windows).

## Configuration

### Embedding Mode

Choose between local (free, offline) or API-based embeddings:

```bash
# Local embedding mode (default) - No API key required
EMBEDDING_MODE=local

# API embedding mode - Requires API key
EMBEDDING_MODE=api
```

### Local Embedding Configuration

```bash
# Embedding mode
EMBEDDING_MODE=local

# Text model (supports 100+ languages including Chinese)
LOCAL_TEXT_MODEL=multilingual-e5-small

# Multimodal model for text-to-image search
LOCAL_MULTIMODAL_MODEL=clip-vit-base-patch32

# Custom cache directory (optional)
# TRANSFORMERS_CACHE=/path/to/custom/cache

# Force offline mode (after models are cached)
# LOCAL_FILES_ONLY=true
```

### API Embedding Configuration

```bash
# Embedding mode
EMBEDDING_MODE=api

# API key for embedding service
EMBEDDING_API_KEY=your-api-key-here

# API base URL (OpenAI or compatible)
EMBEDDING_API_BASE_URL=https://api.openai.com/v1

# Embedding model
EMBEDDING_MODEL=text-embedding-3-small
```

### Multilingual Support

The local embedding mode supports **100+ languages** including:
- Chinese (Simplified & Traditional)
- English
- Japanese
- Korean
- French, German, Spanish, etc.

Chinese queries will find relevant English documents, and vice versa.

### Multimodal Capabilities

With the CLIP model, you can:
- **Text-to-Image Search**: Query "加班表格" to find table screenshots
- **Image-to-Text Search**: Upload an image to find related text descriptions
- **Image-to-Image Search**: Find similar images

### Supported Image Formats

- PNG
- JPEG/JPG
- WebP

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
│  │         Embedding Service Factory                 │ │
│  │  ┌─────────────────┐  ┌─────────────────────────┐│ │
│  │  │ Local (local)   │  │ API (api)               ││ │
│  │  │ • multilingual  │  │ • OpenAI/DeepSeek       ││ │
│  │  │   -e5-small     │  │ • text-embedding-3      ││ │
│  │  │ • CLIP          │  │   -small                ││ │
│  │  │ (multimodal)    │  │                         ││ │
│  │  └─────────────────┘  └─────────────────────────┘│ │
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
4. **Embed**: Generate vector embeddings (local or API)
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

## Troubleshooting

### Model Download Issues

If models fail to download:

1. Check network connection
2. Use a mirror site by setting environment variable:
   ```bash
   HF_ENDPOINT=https://hf-mirror.com
   ```
3. Manually download models from HuggingFace

### Offline Mode Not Working

1. Ensure models are cached first:
   ```bash
   npm run download-models
   ```
2. Set `LOCAL_FILES_ONLY=true` to force offline mode
3. Check cache directory: `~/.cache/huggingface/hub/`

### Memory Issues

For large batches:
- Embedding cache automatically clears when memory exceeds 500MB
- Process documents in smaller batches
- Set lower cache size: adjust `maxCacheSize` in service

## License

MIT