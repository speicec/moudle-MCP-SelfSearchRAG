---
status: proposed
created: 2026-04-21
schema: opsx-v2
---

# Smart PDF Mixed-Mode Processing

## Problem

用户上传138页PDF文档，系统只处理了1页（871字符）。

**根因分析**：
1. `text-extractor.ts`依赖`\f`分页符检测页面，但`pdf-parse`库返回的`text`只用`\n\n`分隔页面
2. OCR触发条件只检测`totalText === 0`，871字符≠0时不触发

**影响**：任何"部分有文本、大部分是图片"的PDF都会被错误处理。

## Proposed Solution

实现智能混合处理模式：
- 自动诊断每页类型（文本页 vs 图片页）
- 文本页：直接文本提取（快速）
- 图片页：走OCR流程（准确）
- 保持页面顺序完整性

## Scope

| 组件 | 改动 |
|------|------|
| text-extractor.ts | Bug修复 + 新增诊断方法 |
| parse-stage.ts | 新增混合处理逻辑 |
| image-pdf-processor.ts | 新增选择性页面处理 |
| pdf-parser.ts | 配置项扩展 |

## Success Criteria

- [ ] 138页PDF正确处理（全部138页，非1页）
- [ ] 纯文字PDF走文本提取（不调用OCR）
- [ ] 纯扫描PDF走OCR流程
- [ ] 混合PDF正确分类处理
- [ ] 配置项可调整阈值和行为

## Risks

| 风险 | 级别 | 缓解措施 |
|------|------|----------|
| OCR服务不可用 | 中 | 降级到纯文本提取 |
| 大文档性能 | 中 | 配置页数上限 |
| 阈值不适配某些PDF | 低 | 用户可配置调整 |

## Timeline

预计工作量：2-3天

- Day 1: Bug修复 + 诊断逻辑
- Day 2: 混合处理流程
- Day 3: 测试 + 配置项 + 文档