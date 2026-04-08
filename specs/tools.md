# RAG MCP Server Tools 规格

## 概述

定义 MCP Server 暴露的 Tools 接口，供 Claude Code 等 MCP Client 调用。

## Tools 列表

### 1. rag_index

**描述**：索引文档到向量库

**输入 Schema**：
```json
{
  "type": "object",
  "properties": {
    "path": {
      "type": "string",
      "description": "要索引的文件或目录路径"
    },
    "recursive": {
      "type": "boolean",
      "default": true,
      "description": "是否递归索引子目录"
    },
    "filters": {
      "type": "array",
      "items": { "type": "string" },
      "description": "文件过滤规则，如 '*.md', '*.ts'"
    }
  },
  "required": ["path"]
}
```

**输出 Schema**：
```json
{
  "type": "object",
  "properties": {
    "indexed": {
      "type": "integer",
      "description": "成功索引的文档数"
    },
    "skipped": {
      "type": "integer",
      "description": "跳过的文档数"
    },
    "errors": {
      "type": "array",
      "items": { "type": "string" },
      "description": "错误信息列表"
    },
    "duration_ms": {
      "type": "integer",
      "description": "索引耗时（毫秒）"
    }
  }
}
```

**行为**：
- 读取指定路径的文件内容
- 智能分块（代码按函数/类，文本按段落）
- 调用 Embedding 服务生成向量
- 存入 Milvus 向量库
- 记录元数据到 SQLite

---

### 2. rag_search

**描述**：混合检索文档

**输入 Schema**：
```json
{
  "type": "object",
  "properties": {
    "query": {
      "type": "string",
      "description": "检索查询文本"
    },
    "top_k": {
      "type": "integer",
      "default": 10,
      "description": "返回结果数量"
    },
    "mode": {
      "type": "string",
      "enum": ["vector", "fulltext", "hybrid", "code"],
      "default": "hybrid",
      "description": "检索模式"
    },
    "filters": {
      "type": "object",
      "description": "过滤条件，如 { extension: '.ts' }"
    }
  },
  "required": ["query"]
}
```

**输出 Schema**：
```json
{
  "type": "object",
  "properties": {
    "results": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "chunk_id": { "type": "string" },
          "doc_id": { "type": "string" },
          "content": { "type": "string" },
          "score": { "type": "number" },
          "source": { "type": "string" },
          "metadata": { "type": "object" }
        }
      }
    },
    "mode": {
      "type": "string",
      "description": "实际使用的检索模式"
    },
    "duration_ms": {
      "type": "integer"
    }
  }
}
```

**行为**：
- 将查询文本转为向量
- 根据模式选择检索策略：
  - `vector`：仅向量检索
  - `fulltext`：仅全文检索（SQLite FTS）
  - `hybrid`：向量+全文融合（RRF算法）
  - `code`：代码语义检索（AST分析）
- 返回排序后的结果

---

### 3. rag_delete

**描述**：删除已索引文档

**输入 Schema**：
```json
{
  "type": "object",
  "properties": {
    "doc_id": {
      "type": "string",
      "description": "文档ID"
    },
    "path": {
      "type": "string",
      "description": "文档路径（可选，用于按路径删除）"
    }
  },
  "required": []
}
```

**输出 Schema**：
```json
{
  "type": "object",
  "properties": {
    "deleted": {
      "type": "boolean"
    },
    "chunks_removed": {
      "type": "integer"
    }
  }
}
```

**行为**：
- 从 Milvus 删除向量记录
- 从 SQLite 删除元数据
- 返回删除统计

---

### 4. rag_status

**描述**：查询系统状态

**输入 Schema**：
```json
{
  "type": "object",
  "properties": {}
}
```

**输出 Schema**：
```json
{
  "type": "object",
  "properties": {
    "indexed_docs": { "type": "integer" },
    "indexed_chunks": { "type": "integer" },
    "storage_health": {
      "type": "object",
      "properties": {
        "milvus": { "type": "string", "enum": ["healthy", "unhealthy"] },
        "sqlite": { "type": "string", "enum": ["healthy", "unhealthy"] }
      }
    },
    "embedding_service": {
      "type": "object",
      "properties": {
        "status": { "type": "string" },
        "model": { "type": "string" }
      }
    },
    "config": {
      "type": "object"
    }
  }
}
```

---

### 5. rag_config

**描述**：配置管理

**输入 Schema**：
```json
{
  "type": "object",
  "properties": {
    "action": {
      "type": "string",
      "enum": ["get", "set", "reset"],
      "default": "get"
    },
    "key": {
      "type": "string",
      "description": "配置项名称"
    },
    "value": {
      "type": "any",
      "description": "配置值（set 操作时使用）"
    }
  },
  "required": ["action"]
}
```

**输出 Schema**：
```json
{
  "type": "object",
  "properties": {
    "config": { "type": "object" },
    "updated": { "type": "boolean" }
  }
}
```

**可配置项**：
- `embedding.service_url`：Embedding 服务地址
- `embedding.model`：Embedding 模型名称
- `embedding.dimension`：向量维度
- `chunk.max_size`：分块最大大小
- `chunk.overlap`：分块重叠大小
- `search.default_top_k`：默认返回数量
- `search.hybrid_weight`：混合检索权重