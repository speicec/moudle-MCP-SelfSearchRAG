# 多模态支持规格 (Multimodal Spec)

## 概述

RAG MCP Server 支持多模态内容：文本、代码、图片、音频。

## 多模态类型

| 类型 | 描述 | 处理方式 |
|------|------|----------|
| **Text** | 普通文本文档 | 文本分块 + 文本 Embedding |
| **Code** | 源代码文件 | AST 分块 + 代码 Embedding |
| **Image** | 图片文件 | 图片 Embedding (CLIP/Vision) |
| **Audio** | 音频文件 | ASR 转文本 + 文本 Embedding |
| **Video** | 视频文件 | 关键帧提取 + 多模态 Embedding |

## 数据结构

```typescript
// 多模态文档
interface MultiModalDocument extends Document {
  modality: ModalityType;
  modalityMeta: ModalityMetadata;
}

type ModalityType = 'text' | 'code' | 'image' | 'audio' | 'video' | 'mixed';

interface ModalityMetadata {
  // 通用
  mimeType: string;
  fileSize: number;

  // 图片
  width?: number;
  height?: number;
  format?: string;

  // 音频
  duration?: number;
  sampleRate?: number;
  channels?: number;

  // 视频
  frameCount?: number;
  fps?: number;

  // 代码
  language?: string;
  astInfo?: ASTInfo;

  // 混合
  components?: ComponentInfo[];
}

// 多模态分块
interface MultiModalChunk extends Chunk {
  modality: ModalityType;
  embeddingType: 'text' | 'image' | 'audio' | 'mixed';
  representation?: {
    text?: string;      // 文本表示
    imageEmbedding?: number[];  // 图片向量
    audioEmbedding?: number[];  // 音频向量
  };
}
```

## Embedding 插件接口

```typescript
// 多模态 Embedder 接口
interface MultiModalEmbedder extends Plugin {
  // 支持的模态类型
  supportedModalities: ModalityType[];

  // Embedding 方法
  embedText(content: string): Promise<number[]>;
  embedCode(code: string, language: string): Promise<number[]>;
  embedImage(image: Buffer | ImageData): Promise<number[]>;
  embedAudio(audio: Buffer, metadata: AudioMetadata): Promise<number[]>;
  embedMultiModal(components: MultiModalComponent[]): Promise<number[]>;

  // 维度
  dimensions: {
    text: number;
    code: number;
    image: number;
    audio: number;
  };
}

// CLIP-style 多模态 Embedder
interface CLIPStyleEmbedder extends MultiModalEmbedder {
  // 共享向量空间
  sharedDimension: number;

  // 跨模态检索
  crossModalSearch(query: string, modality: ModalityType): Promise<number[]>;
}
```

## 处理管道

### 文本处理
```
文本文件
  → 读取内容
  → 按段落/句子分块
  → 文本 Embedding
  → 存入向量库
```

### 代码处理
```
代码文件
  → AST 解析
  → 按函数/类/模块分块
  → 保留语义结构
  → 代码 Embedding
  → 存入向量库
```

### 图片处理
```
图片文件
  → 加载图片数据
  → 可选 OCR 提取文字
  → 图片 Embedding (Vision Model)
  → 存入向量库
```

### 音频处理
```
音频文件
  → ASR 转文本 (Whisper等)
  → 文本分块
  → 文本 Embedding
  → 存入向量库
  → 保留音频向量（可选）
```

### 混合内容处理
```
混合文档（如PDF）
  → 分离组件（文本/图片/表格）
  → 各组件独立处理
  → 关联存储
  → 支持组件级检索
```

## MCP Tool 扩展

```typescript
// rag_index 支持
interface IndexInput {
  path: string;
  modality?: ModalityType | 'auto';  // 'auto' 自动检测
  embedder?: string;  // 指定 Embedder 插件
}

// rag_search 支持
interface SearchInput {
  query: string;
  queryModality?: 'text' | 'image' | 'audio';
  targetModality?: ModalityType[];  // 限制检索目标类型
  crossModal?: boolean;  // 跨模态检索
}

// 跨模态搜索示例
// 用文本描述搜索图片
rag_search({
  query: "一张包含蓝色汽车的图片",
  crossModal: true,
  targetModality: ['image']
})
```

## 插件注册

```typescript
// 注册多模态 Embedder
pluginRegistry.register('embedder:text-openai', {
  type: 'embedder',
  modalities: ['text'],
  dimensions: { text: 1536 },
  factory: () => new OpenAITextEmbedder()
});

pluginRegistry.register('embedder:clip', {
  type: 'embedder',
  modalities: ['text', 'image'],
  dimensions: { text: 512, image: 512 },
  sharedDimension: 512,
  factory: () => new CLIPEmbedder()
});

pluginRegistry.register('embedder:whisper', {
  type: 'embedder',
  modalities: ['audio'],
  dimensions: { audio: 768 },
  factory: () => new WhisperEmbedder()
});
```

## 存储适配

```typescript
// Milvus 多模态 Collection
interface MultiModalCollection {
  name: 'multimodal_chunks';
  fields: [
    { name: 'id', type: 'VARCHAR', isPrimary: true },
    { name: 'doc_id', type: 'VARCHAR' },
    { name: 'modality', type: 'VARCHAR' },
    { name: 'text_embedding', type: 'FLOAT_VECTOR', dim: 1536 },
    { name: 'image_embedding', type: 'FLOAT_VECTOR', dim: 512 },
    { name: 'audio_embedding', type: 'FLOAT_VECTOR', dim: 768 },
    { name: 'content', type: 'VARCHAR' },  // 文本表示
    { name: 'source', type: 'VARCHAR' },
    { name: 'metadata', type: 'JSON' }
  ];
}
```

## 验收标准

- [ ] 支持文本模态处理
- [ ] 支持代码模态处理（AST分块）
- [ ] 支持图片模态处理（可选）
- [ ] 支持音频模态处理（可选）
- [ ] 支持模态类型自动检测
- [ ] 支持跨模态检索（可选）
- [ ] 插件可替换 Embedder
- [ ] 多模态向量正确存储和检索