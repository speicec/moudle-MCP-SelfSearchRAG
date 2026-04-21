---
name: smart-pdf-mixed-mode-processing
description: 智能PDF处理：自动检测每页类型，混合文本提取和OCR
type: project
---

# 问题背景

用户上传138页PDF（25.80 MB），但系统只处理了1页：
- 提取结果：1页，871字符
- 嵌入结果：1个chunk，1个embedding

根本原因：
1. **分页Bug**：`text-extractor.ts`依赖`\f`分页符检测页面边界，但`pdf-parse`库只用`\n\n`分隔
2. **OCR触发条件太窄**：只检测`totalText === 0`，用户PDF有871字符≠0，不触发OCR

# 设计目标

实现智能混合处理：
- 自动诊断每页类型（文本页 vs 图片页）
- 文本页：直接提取（快速、低成本）
- 图片页：走OCR流程（准确、但慢）
- 保持页面顺序完整性

# 核心设计方案

## 处理流程

```
┌─────────────────────────────────────────────────────────────┐
│                    智能PDF处理流程                           │
└─────────────────────────────────────────────────────────────┘

     上传PDF
         │
         ▼
┌─────────────────┐
│ Step 1: 诊断    │  pdf-parse with custom pagerender
│                 │  → 每页文本 + charCount
│ numpages = 138  │  → numpages 元数据
└─────────────────┘
         │
         ▼
┌─────────────────┐
│ Step 2: 分类    │  每页判断: chars < threshold?
│                 │
│ threshold=100   │  文本页 (chars ≥ 100) → 80页
│                 │  图片页 (chars < 100) → 58页
└─────────────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌───────┐ ┌───────┐
│文本页 │ │图片页 │
│直接   │ │OCR    │
│提取   │ │处理   │
└───────┘ └───────┘
    │         │
    └────┬────┘
         ▼
┌─────────────────┐
│ Step 3: 合并    │  按页码顺序合并
│                 │  ParsedContent { pages: 138 }
└─────────────────┘
```

## 关键配置项

| 配置 | 默认值 | 说明 |
|------|--------|------|
| `PDF_MIXED_MODE_THRESHOLD` | 100 | 每页字符数阈值，低于此值视为图片页 |
| `PDF_FORCE_OCR_ALL` | false | 强制全部走OCR（忽略文本提取） |
| `PDF_SKIP_EMPTY_PAGES` | true | 跳过完全空白页 |
| `PDF_MAX_TEXT_PAGES` | 500 | 文本页处理上限 |
| `PDF_MAX_OCR_PAGES` | 100 | OCR页处理上限（已有） |

## 阈值选择建议

```
阈值 vs 行为:

  50 chars ─── 非常严格
              │ 只有完全空页才OCR
              │ 封面/页脚等少量文本页不OCR
              │ 适合：文字为主的PDF

  100 chars ─── 平衡推荐
              │ 典型段落约300-500字符
              │ 少于100字符大概率是图片页
              │ 适合：混合PDF（扫描+文字）

  200 chars ─── 保守策略
              │ 更多页走OCR
              │ 确保"看起来空"的页也OCR
              │ 适合：扫描为主的PDF
```

# 修改范围

## 1. text-extractor.ts (Bug修复)

**问题**：依赖`\f`分页符检测页面

**修复**：
- 使用自定义`pagerender`函数
- 返回结构化结果：`{ pageNumber, text, charCount }[]`
- 不依赖`\f`字符

```typescript
// 新接口
interface PageTextDiagnostic {
  pageNumber: number;
  text: string;
  charCount: number;
  isEmpty: boolean;  // charCount < threshold
}

// 新方法
async diagnose(content: Buffer, threshold: number): Promise<PageTextDiagnostic[]>
```

## 2. parse-stage.ts (逻辑重构)

**新增方法**：`processMixedPdfDocument`

```typescript
private async processMixedPdfDocument(ctx: Context, content: Buffer): Promise<Context> {
  // Step 1: 诊断每页
  const diagnostics = await this.textExtractor.diagnose(content, threshold);

  // Step 2: 分类
  const textPages = diagnostics.filter(d => !d.isEmpty);
  const imagePages = diagnostics.filter(d => d.isEmpty);

  // Step 3: 并行处理
  const textResults = await this.processTextPages(textPages);
  const ocrResults = await this.processImagePages(imagePages, content);

  // Step 4: 合并（按页码排序）
  const mergedPages = this.mergePages(textResults, ocrResults);

  // Step 5: 构建ParsedContent
  ctx.set('parsedContent', { pages: mergedPages, totalPages: diagnostics.length });
}
```

## 3. image-pdf-processor.ts (扩展)

**新增方法**：`processPages`

```typescript
// 原方法处理全部PDF → 新方法处理指定页面
async processPages(pdfBuffer: Buffer, pageNumbers: number[]): Promise<ParsedContent>
```

使用`pdfjs-dist`的`getPage(n)`选择性渲染。

## 4. pdf-parser.ts (配置扩展)

```typescript
interface PdfParserConfig {
  // ... existing fields
  mixedModeThreshold: number;    // 每页字符阈值
  forceOcrAll: boolean;          // 强制OCR全部
  skipEmptyPages: boolean;       // 跳过空白页
}
```

# 实现优先级

| 优先级 | 任务 | 影响 |
|--------|------|------|
| P0 | 修复text-extractor.ts分页bug | 核心问题，必须修复 |
| P1 | 实现每页诊断逻辑 | 智能分类基础 |
| P2 | 实现混合处理流程 | 核心功能 |
| P3 | 添加配置项 | 用户可调整行为 |
| P4 | 性能优化（并行处理） | 大文档处理速度 |

# 边界情况处理

| 场景 | 处理策略 |
|------|----------|
| 全部是文本页 | 只走文本提取，不调用OCR |
| 全部是图片页 | 走现有OCR流程 |
| 混合PDF | 文本页快速处理，图片页OCR |
| OCR服务不可用 | 降级：只用文本提取，记录警告 |
| 部分页面OCR失败 | 记录失败页，其他页继续处理 |

# 测试用例

1. **纯文字PDF**（如Word导出）：验证全部走文本提取
2. **纯扫描PDF**（如古籍扫描）：验证全部走OCR
3. **混合PDF**（封面图片+正文文字）：验证正确分类
4. **超大PDF**（500+页）：验证处理上限和性能
5. **空白页PDF**：验证跳过空白页行为