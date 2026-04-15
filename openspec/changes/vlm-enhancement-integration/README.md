# VLM Enhancement Integration

## Status: Proposed

## Summary

在Parse阶段集成VLM（qwen3-vl-flash），对OCR识别的table/figure/formula类型块进行深度理解，并将结果存入文本索引以支持语义检索。

## Key Changes

1. **VLM增强处理**: 对特定类型块调用VLM，获取结构化理解结果
2. **ImageStore**: 新增图片存储模块，保存裁剪图片用于答案生成
3. **检索集成**: 从检索结果中提取图片上下文，传递给多模态生成

## Files

- `proposal.md` - 变更提案
- `design.md` - 技术设计
- `tasks.md` - 实现任务列表