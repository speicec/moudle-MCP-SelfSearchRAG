## 1. 配置扩展

- [x] 1.1 在 `src/chunking/config.ts` 添加 `ContextWindowConfig` 接口
- [x] 1.2 在 `SmallToBigRetrievalConfig` 中添加 `contextWindow` 配置项
- [x] 1.3 在 `SemanticChunkerConfig` 中添加 `respectStructureBoundaries` 配置项

## 2. 类型定义扩展

- [x] 2.1 在 `src/chunking/types.ts` 中为 `HierarchicalRetrievalResult` 添加 `contextWindow`、`windowStart`、`windowEnd` 字段
- [x] 2.2 添加 `StructureBoundary` 接口定义
- [x] 2.3 添加 `ContextWindowConfig` 接口定义

## 3. 结构边界检测器

- [x] 3.1 创建 `src/chunking/structure-boundary-detector.ts` 文件
- [x] 3.2 实现 `detectStructureBoundaries(content: string): StructureBoundary[]` 函数
- [x] 3.3 实现中文章节标题检测模式（如 "第一章", "第1节"）
- [x] 3.4 实现列表序号检测模式（如 "1.", "一、", "A."）
- [x] 3.5 实现 `isHighConfidenceBoundary(boundary: StructureBoundary): boolean` 辅助函数
- [ ] 3.6 编写单元测试

## 4. 上下文窗口提取

- [x] 4.1 在 `src/chunking/small-to-big-retriever.ts` 中实现 `extractContextWindow()` 私有方法
- [x] 4.2 实现 `findSmallChunkPosition()` 辅助函数，定位 small chunk 在 parent 中的位置
- [x] 4.3 实现句子边界截断逻辑（`respectSentenceBoundary` 配置）
- [x] 4.4 处理边界情况（small chunk 不在 parent 中、窗口超出边界等）
- [ ] 4.5 编写单元测试

## 5. 修改 expandToParents

- [x] 5.1 修改 `expandToParents()` 方法，调用 `extractContextWindow()`
- [x] 5.2 在返回结果中填充 `contextWindow`、`windowStart`、`windowEnd` 字段
- [x] 5.3 保持 `parentChunkContent` 字段向后兼容
- [x] 5.4 更新日志输出，记录窗口提取信息
- [ ] 5.5 编写集成测试

## 6. 修改父块分组策略

- [x] 6.1 在 `HierarchicalStore` 中添加 `structureBoundaryDetector` 实例
- [x] 6.2 修改 `groupForParents()` 方法，先检测结构边界
- [x] 6.3 实现边界感知的分组逻辑：遇到边界强制结束当前父块
- [x] 6.4 添加配置项 `respectStructureBoundaries` 控制是否启用
- [ ] 6.5 编写单元测试

## 7. 集成与验证

- [x] 7.1 运行所有单元测试确保无回归
- [x] 7.2 使用麻醉学文档进行端到端测试
- [x] 7.3 验证查询"麻醉前用药的常用药物"返回精简上下文
- [x] 7.4 验证父块不再跨越章节边界（仅1/32跨章节，且块很小）
- [x] 7.5 更新 `openspec/specs/` 下的规格文件

## 8. 文档更新

- [x] 8.1 更新 README.md 中的检索策略说明
- [x] 8.2 添加配置示例到 `.env.example`
- [x] 8.3 更新 API 文档说明新增字段