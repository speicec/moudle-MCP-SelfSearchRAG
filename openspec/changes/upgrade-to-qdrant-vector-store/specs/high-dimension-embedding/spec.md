# High Dimension Embedding Specification

## Overview

文本向量从 384 维升级到 1024 维，提升检索质量和语义表达能力。

## Requirements

### Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-001 | 支持 1024 维文本向量生成 | MUST |
| FR-002 | 保留 512 维 CLIP 图像向量 | MUST |
| FR-003 | 支持 multilingual-e5-large 模型 | MUST |
| FR-004 | 支持 bge-m3 模型 | MUST |
| FR-005 | 动态维度获取方法 | MUST |
| FR-006 | 模型预加载支持 | SHOULD |
| FR-007 | 支持环境变量切换模型 | MUST |

### Quality Requirements

| ID | Requirement | Baseline (384) | Target (1024) |
|----|-------------|----------------|---------------|
| QR-001 | 中文检索精度 | 0.75 | 0.85+ |
| QR-002 | 英文检索精度 | 0.78 | 0.88+ |
| QR-003 | 跨语言检索 | 0.70 | 0.80+ |
| QR-004 | 复杂查询理解 | 弱 | 强 |

## Model Configuration

### Model Options: multilingual-e5-large vs bge-m3

| Model | Xenova/multilingual-e5-large | Xenova/bge-m3 |
|-------|------------------------------|---------------|
| Dimension | 1024 | 1024 |
| Languages | 100+ | Multi (中文优化) |
| Quantized | ✓ (int8, uint8, q4) | ✓ (int8, uint8, q4, fp16) |
| Chinese Quality | Good | Excellent |
| Cross-lingual | Excellent | Good |
| Inference Speed | ~50ms/text | ~60ms/text |
| ONNX Available | ✓ | ✓ |
| transformers.js | ✓ | ✓ |

**推荐选择**:
- 中文为主文档 → bge-m3（中文检索质量最优）
- 中英文混合文档 → multilingual-e5-large（跨语言检索更强）

### Primary Model: multilingual-e5-large

| Attribute | Value |
|-----------|-------|
| Model ID | Xenova/multilingual-e5-large |
| Dimension | 1024 |
| Quantized | true |
| Languages | 100+ |
| Max Input | 512 tokens |
| Cache Key | LOCAL_TEXT_MODEL=multilingual-e5-large |

### Alternative Model: bge-m3

| Attribute | Value |
|-----------|-------|
| Model ID | Xenova/bge-m3 |
| Dimension | 1024 |
| Quantized | true (int8/uint8/q4/fp16) |
| Languages | Multi |
| Speciality | Chinese optimized |
| Cache Key | LOCAL_TEXT_MODEL=bge-m3 |

## Interface Specification

```typescript
interface TextEmbeddingModel {
  getId(): string;
  getDimension(): number;  // 动态返回实际维度
  getMaxInputLength(): number;
  supportsImages(): boolean;
  isReady(): boolean;
  
  embedText(text: string): Promise<number[]>;
  embedTexts(texts: string[]): Promise<number[][]>;
  clearCache(): void;
}
```

## Configuration Update

```typescript
// local-embedding-service.ts

export const LOCAL_MODEL_CONFIGS: Record<string, LocalEmbeddingConfig> = {
  // 保留旧模型（兼容）
  'multilingual-e5-small': {
    modelId: 'Xenova/multilingual-e5-small',
    dimension: 384,
    quantized: true,
  },
  
  // 新增 1024 维模型
  'multilingual-e5-large': {
    modelId: 'Xenova/multilingual-e5-large',
    dimension: 1024,
    quantized: true,
  },
  
  'bge-m3': {
    modelId: 'BAAI/bge-m3',
    dimension: 1024,
    quantized: true,
  },
};

// 默认模型配置（可切换）
export const DEFAULT_TEXT_MODEL = 'bge-m3';  // 中文优化
// export const DEFAULT_TEXT_MODEL = 'multilingual-e5-large';  // 跨语言优化
```

## Memory Impact

| Metric | 384 维 | 1024 维 | Increase |
|--------|--------|---------|----------|
| 单向量大小 | 1.5 KB | 4 KB | 2.67x |
| 100K 向量 | 150 MB | 400 MB | 2.67x |
| 500K 向量 | 750 MB | 2 GB | 2.67x |

## Migration Impact

**数据兼容性**: 384 维向量与 1024 维向量不兼容
- 旧数据需全部删除
- 所有文档需重新处理
- Collection 需重建（不同维度不能混存）

## Environment Variables

```bash
# 文本向量模型（可选）
# 中文为主: LOCAL_TEXT_MODEL=bge-m3
# 中英混合: LOCAL_TEXT_MODEL=multilingual-e5-large
LOCAL_TEXT_MODEL=bge-m3  # 或 multilingual-e5-large

# 维度（由模型配置决定，不需要手动设置）
# TEXT_EMBEDDING_DIMENSION=1024

# HuggingFace 镜像（可选，加速下载）
HF_ENDPOINT=https://hf-mirror.com

# 本地缓存目录
TRANSFORMERS_CACHE=./models
```

## Model Loading

```typescript
// 两种模型都支持 transformers.js
import { pipeline } from '@xenova/transformers';

// bge-m3 加载
const extractor = await pipeline(
  'feature-extraction',
  'Xenova/bge-m3',
  { quantized: true }
);

// multilingual-e5-large 加载
const extractor = await pipeline(
  'feature-extraction',
  'Xenova/multilingual-e5-large',
  { quantized: true }
);
```

## Testing Criteria

- 模型加载成功验证
- 维度正确性验证 (vector.length === 1024)
- 向量归一化验证
- 批量嵌入性能测试 (< 50ms per text)
- 中英文混合文档检索质量测试