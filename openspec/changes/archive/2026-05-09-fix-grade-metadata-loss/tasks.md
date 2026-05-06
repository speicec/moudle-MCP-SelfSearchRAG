## 1. Type Definition Updates

- [x] 1.1 扩展 VectorPayload 接口，添加 `documentYear?: number`, `documentTitle?: string`, `documentAuthor?: string`, `guidelineSource?: string` 字段
- [x] 1.2 更新 COLLECTION_NAMES 常量和 Payload 字段注释

## 2. Storage Layer Updates

- [x] 2.1 修改 `document-processor.ts:storeVectorsInQdrant`，在 small chunks payload 构建时写入新字段
- [x] 2.2 修改 `document-processor.ts:storeVectorsInQdrant`，在 parent chunks payload 构建时写入新字段
- [x] 2.3 添加条件判断，仅在 chunk.metadata 有对应字段时写入 payload

## 3. Recovery Layer Updates

- [x] 3.1 修改 `hybrid-small-to-big-retriever.ts:recoverFromQdrant`，恢复 documentYear 到 metadata
- [x] 3.2 修改 `hybrid-small-to-big-retriever.ts:recoverFromQdrant`，恢复 documentTitle 到 metadata
- [x] 3.3 修改 `hybrid-small-to-big-retriever.ts:recoverFromQdrant`，恢复 documentAuthor 到 metadata
- [x] 3.4 修改 `hybrid-small-to-big-retriever.ts:recoverFromQdrant`，恢复 guidelineSource 到 metadata

## 4. Test Updates

- [x] 4.1 添加 VectorPayload 新字段的单元测试
- [x] 4.2 添加 recoverFromQdrant 新字段恢复的集成测试
- [x] 4.3 添加向后兼容测试（legacy payload 无新字段）

## 5. Documentation Updates

- [x] 5.1 更新 `openspec/specs/qdrant-vector-store/spec.md` 的 Payload 字段表格
- [x] 5.2 添加变更日志说明已索引文档需要重新上传

## 6. Verification

- [x] 6.1 运行 `npm run build` 确保编译通过
- [x] 6.2 运行 `npm test` 确保所有测试通过
- [ ] 6.3 上传新 PDF 文档验证元数据正确传递到 GRADE 评估