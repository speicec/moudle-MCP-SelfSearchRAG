# RAG MCP Server Resources 规格

## 概述

定义 MCP Server 暴露的 Resources 接口，供 MCP Client 订阅和读取。

## Resources 列表

### 1. rag://docs

**描述**：已索引文档列表

**URI Template**：`rag://docs`

**内容 Schema**：
```json
{
  "type": "object",
  "properties": {
    "documents": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "path": { "type": "string" },
          "indexed_at": { "type": "string", "format": "date-time" },
          "chunks_count": { "type": "integer" },
          "size_bytes": { "type": "integer" },
          "metadata": { "type": "object" }
        }
      }
    },
    "total": { "type": "integer" },
    "updated_at": { "type": "string", "format": "date-time" }
  }
}
```

**更新机制**：索引/删除操作后自动更新

---

### 2. rag://docs/{doc_id}

**描述**：单个文档详情

**URI Template**：`rag://docs/{doc_id}`

**内容 Schema**：
```json
{
  "type": "object",
  "properties": {
    "id": { "type": "string" },
    "path": { "type": "string" },
    "content_preview": { "type": "string", "description": "前500字符" },
    "chunks": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "content_preview": { "type": "string" },
          "position": { "type": "object" }
        }
      }
    },
    "metadata": { "type": "object" },
    "indexed_at": { "type": "string", "format": "date-time" }
  }
}
```

---

### 3. rag://history

**描述**：检索历史记录

**URI Template**：`rag://history`

**内容 Schema**：
```json
{
  "type": "object",
  "properties": {
    "queries": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "query": { "type": "string" },
          "mode": { "type": "string" },
          "results_count": { "type": "integer" },
          "duration_ms": { "type": "integer" },
          "timestamp": { "type": "string", "format": "date-time" }
        }
      }
    },
    "total_queries": { "type": "integer" }
  }
}
```

**更新机制**：每次检索后追加记录

---

### 4. rag://config

**描述**：当前系统配置

**URI Template**：`rag://config`

**内容 Schema**：
```json
{
  "type": "object",
  "properties": {
    "embedding": {
      "type": "object",
      "properties": {
        "service_url": { "type": "string" },
        "model": { "type": "string" },
        "dimension": { "type": "integer" }
      }
    },
    "chunk": {
      "type": "object",
      "properties": {
        "max_size": { "type": "integer" },
        "overlap": { "type": "integer" }
      }
    },
    "search": {
      "type": "object",
      "properties": {
        "default_top_k": { "type": "integer" },
        "hybrid_weight": { "type": "number" }
      }
    },
    "milvus": {
      "type": "object",
      "properties": {
        "host": { "type": "string" },
        "port": { "type": "integer" },
        "collection": { "type": "string" }
      }
    },
    "storage": {
      "type": "object",
      "properties": {
        "sqlite_path": { "type": "string" }
      }
    }
  }
}
```

---

### 5. rag://metrics

**描述**：系统运行指标（观测审计）

**URI Template**：`rag://metrics`

**内容 Schema**：
```json
{
  "type": "object",
  "properties": {
    "uptime_seconds": { "type": "integer" },
    "total_indexed": { "type": "integer" },
    "total_searches": { "type": "integer" },
    "avg_search_latency_ms": { "type": "number" },
    "avg_index_latency_ms": { "type": "number" },
    "error_count": { "type": "integer" },
    "last_error": { "type": "string" },
    "memory_usage_mb": { "type": "number" }
  }
}
```