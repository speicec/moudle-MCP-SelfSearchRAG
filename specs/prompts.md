# RAG MCP Server Prompts 规格

## 概述

定义 MCP Server 暴露的 Prompts 接口，供 MCP Client 使用预设提示模板。

## Prompts 列表

### 1. rag-search-optimize

**描述**：优化检索查询的提示模板

**参数**：
```json
{
  "type": "object",
  "properties": {
    "query": {
      "type": "string",
      "description": "原始查询"
    },
    "context": {
      "type": "string",
      "description": "检索上下文（可选）"
    }
  },
  "required": ["query"]
}
```

**生成内容**：
```
请分析以下检索查询，生成优化后的查询建议：

原始查询：{query}
上下文：{context}

优化建议：
1. 关键词提取：[提取核心关键词]
2. 语义扩展：[相关术语扩展]
3. 检索策略建议：[推荐检索模式]
```

---

### 2. rag-result-summary

**描述**：总结检索结果的提示模板

**参数**：
```json
{
  "type": "object",
  "properties": {
    "results": {
      "type": "array",
      "description": "检索结果列表"
    },
    "query": {
      "type": "string",
      "description": "原始查询"
    },
    "format": {
      "type": "string",
      "enum": ["concise", "detailed", "structured"],
      "default": "concise"
    }
  },
  "required": ["results", "query"]
}
```

**生成内容**：
```
基于以下检索结果，生成{format}格式的摘要：

查询：{query}
结果数量：{results.length}

检索结果：
{#each results}
- [{source}] {content_preview} (score: {score})
{/each}

摘要：
[根据 format 生成相应格式的摘要]
```

---

### 3. rag-code-context

**描述**：生成代码上下文分析的提示模板

**参数**：
```json
{
  "type": "object",
  "properties": {
    "code_results": {
      "type": "array",
      "description": "代码检索结果"
    },
    "task": {
      "type": "string",
      "description": "当前任务描述"
    }
  },
  "required": ["code_results"]
}
```

**生成内容**：
```
分析以下代码片段，提供上下文理解：

任务：{task}

相关代码：
{#each code_results}
```{language}
{content}
```
来源：{source}
{/each}

代码分析：
1. 核心概念：[识别的关键概念]
2. 依赖关系：[代码依赖分析]
3. 建议使用方式：[如何利用这些代码]
```

---

### 4. rag-document-analysis

**描述**：分析文档内容的提示模板

**参数**：
```json
{
  "type": "object",
  "properties": {
    "doc_id": {
      "type": "string",
      "description": "文档ID"
    },
    "analysis_type": {
      "type": "string",
      "enum": ["structure", "key_points", "qa_pairs"],
      "default": "key_points"
    }
  },
  "required": ["doc_id"]
}
```

**生成内容**：
```
分析文档 {doc_id}，提取{analysis_type}：

文档内容：
{document_content}

分析结果：
[根据 analysis_type 输出相应分析]
- structure：文档结构和章节划分
- key_points：核心观点和要点总结
- qa_pairs：生成问答对用于验证检索
```

---

### 5. rag-harness-context

**描述**：生成 Harness 运行环境的上下文提示

**参数**：
```json
{
  "type": "object",
  "properties": {
    "session_id": {
      "type": "string",
      "description": "会话ID"
    },
    "task": {
      "type": "string",
      "description": "当前任务"
    },
    "constraints": {
      "type": "array",
      "items": { "type": "string" },
      "description": "约束规则列表"
    }
  },
  "required": ["task"]
}
```

**生成内容**：
```
为当前任务构建 Harness 上下文：

任务：{task}
约束规则：
{#each constraints}
- {constraint}
{/each}

可用工具：
- rag_index：索引文档
- rag_search：混合检索
- rag_delete：删除文档
- rag_status：查询状态
- rag_config：配置管理

上下文建议：
[根据任务和约束，建议如何使用 RAG 工具]
```