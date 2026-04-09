# Enhanced RAG MCP Server

A powerful RAG (Retrieval-Augmented Generation) system with multimodal support and advanced PDF parsing, exposed via MCP (Model Context Protocol) server.

## Features

- **Multimodal Support**: Process text and images with unified embedding and retrieval
- **Advanced PDF Parsing**: Extract tables, charts, formulas, and handle multi-column layouts
- **Harness Architecture**: Flexible, pluggable pipeline for document processing
- **MCP Server**: Standard interface for AI assistants (Claude Desktop, etc.)
- **Hybrid Search**: Combine semantic and keyword search with configurable weights

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

### As MCP Server

Add to Claude Desktop configuration (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "rag": {
      "command": "node",
      "args": ["/path/to/enhanced-rag-mcp-server/dist/main.js"]
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
Document → Ingest → Parse → Embed → Index
                                        ↓
            Query → Retrieval ← Vector Store
```

### Pipeline Stages

1. **Ingest**: Validate and store document
2. **Parse**: Extract text, tables, images, formulas
3. **Embed**: Generate vector embeddings
4. **Index**: Store in vector database

## Development

```bash
# Development build with watch
npm run dev

# Run tests
npm test

# Lint code
npm run lint
```

## License

MIT