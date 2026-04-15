# Proposal: VLM Enhancement Integration

## Problem

当前纯图片PDF处理流程中，OCR只进行版面分析（`table=False`），输出的table/figure/formula类型块只有位置信息（bbox），缺乏内容理解。

**影响场景**:
- 表格块：只有位置，无表格结构和数据内容
- 图表块：只有位置，无图表类型和数据趋势描述
- 公式块：只有位置，无LaTeX格式和符号解释

**用户痛点**:
- 检索"销售趋势图表"无法匹配到图表内容
- 检索"表格中的增长率数据"无法找到表格
- 答案生成时无法引用表格/图表的具体内容

## Proposed Solution

采用 **方案A：Parse阶段VLM增强**，在文档处理时对特定类型块调用VLM，将理解结果存入文本索引。

```
OCR版面分析 → 识别 blockType + bbox
                    │
                    ├─ text/title → 直接存入chunk
                    │
                    └─ table/figure/formula → 裁剪图片 → VLM理解 → 存入chunk
```

### 核心设计

1. **VLM调用时机**: Parse阶段，处理 table/figure/formula 类型
2. **VLM输出**: 结构化理解结果（Markdown表格/图表描述/公式LaTeX）
3. **存储策略**:
   - HierarchicalStore: VLM文本结果（可检索）
   - ImageStore: 图片裁剪Buffer（可展示）
4. **检索流程**: 发现图片类型chunk → 提取对应图片 → 构建imageContexts

## Key Features

- ✅ VLM结果可直接检索（关键词匹配"柱状图"、"表格数据"）
- ✅ 处理延迟可控（仅对特定类型调用VLM）
- ✅ 复用已有架构（HierarchicalStore、VlmEnhancementService）
- ✅ 与现有流程兼容（通过enableVlm配置开关）

## Scope

**包含**:
- ImageStore模块实现
- image-pdf-processor.ts VLM集成
- document-processor.ts ImageStore集成
- chat.ts 检索层图片提取
- LLMGenerationService.generateMultimodalAnswer调用

**不包含**:
- OCR服务修改（保持table=False）
- VlmEnhancementService修改（已有实现）
- 前端UI修改
- 图片裁剪优化（使用@napi-rs/canvas基础实现）

## Dependencies

**已有依赖**:
- @napi-rs/canvas（图片裁剪）
- VlmEnhancementService（已实现）
- LLMGenerationService（已实现generateMultimodalAnswer）

**新增依赖**:
- 无（完全复用现有基础设施）

**API依赖**:
- 阿里云DashScope (qwen3-vl-flash) - 需配置DASHSCOPE_API_KEY

## Architecture Impact

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     新增模块：ImageStore                                     │
└─────────────────────────────────────────────────────────────────────────────┘

位置: src/chunking/image-store.ts
职责: 管理图片块存储、按页码/类型查询

┌─────────────────────────────────────────────────────────────────────────────┐
│                     修改模块：image-pdf-processor.ts                         │
└─────────────────────────────────────────────────────────────────────────────┘

新增: enhanceWithVlm() 方法
修改: process() 方法（增加VLM处理步骤）
修改: extractImageRegion() 方法（实现真实裁剪）

┌─────────────────────────────────────────────────────────────────────────────┐
│                     修改模块：document-processor.ts                          │
└─────────────────────────────────────────────────────────────────────────────┘

新增: ImageStore初始化和图片存储逻辑

┌─────────────────────────────────────────────────────────────────────────────┐
│                     修改模块：chat.ts                                        │
└─────────────────────────────────────────────────────────────────────────────┘

修改: POST /generate - 提取imageContexts并调用generateMultimodalAnswer
```

## Estimated Effort

| 任务 | 预估工作量 |
|------|-----------|
| ImageStore模块 | 2-3小时 |
| image-pdf-processor.ts VLM集成 | 2-3小时 |
| 图片裁剪实现 | 1-2小时 |
| document-processor.ts集成 | 1小时 |
| chat.ts检索集成 | 1-2小时 |
| 测试编写 | 2-3小时 |
| **总计** | **9-13小时** |

## Success Criteria

1. table/figure/formula类型块经VLM处理后可被关键词检索
2. 答案生成时可引用图片内容（含图片展示）
3. 处理时间可控：单个表格/图表VLM调用 < 3秒
4. 配置开关生效：enableVlm=false时跳过VLM处理
5. ImageStore数据可持久化恢复

## Risks

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| VLM API延迟 | 处理时间增加 | 仅对特定类型调用；默认关闭thinking |
| VLM API费用 | 成本增加 | 可配置启用；按需开关 |
| 图片裁剪内存占用 | 大PDF可能OOM | 分批处理；及时释放Canvas |
| OCR bbox不准确 | 裁剪区域偏移 | 添加边界检查；fallback返回整页 |

## Alternatives Considered

### 方案B：检索阶段实时VLM

**优点**: 上传快速；按需调用
**缺点**: 图片块无法被关键词检索；检索延迟增加

**结论**: 不采用。方案A更符合RAG预处理思想，支持语义检索。