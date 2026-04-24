## 1. 快速修复 (立即见效)

- [x] 1.1 删除 `src/tracing/index.ts` Line 29 重复的 EvaluationTrendData 导出
- [x] 1.2 在 `src/evaluation/types.ts` 添加 `RiskLevel` 和 `EvaluationWeights` 类型导入
- [x] 1.3 将 `AgentExecutor.ts:659` 的 `'trace'` phase 改为 `'complete'`
- [x] 1.4 创建 `src/types/sql.js.d.ts` 类型声明文件

## 2. exactOptionalPropertyTypes 系统性修复

- [x] 2.1 修复 `src/config/redis-config.ts:28` password 条件赋值
- [x] 2.2 修复 `src/tracing/TraceContext.ts` 多处可选属性赋值 (Lines 67, 130, 166, 195)
- [x] 2.3 修复 `src/tracing/TraceStorage.ts:317` rewritten 条件赋值
- [x] 2.4 修复 `src/tracing/TraceVisualizer.ts:139` metadata 条件赋值
- [x] 2.5 修复 `src/tracing/MetricsAggregator.ts:200` evaluation 条件赋值
- [x] 2.6 修复 `src/queue/EvaluationQueue.ts` sessionId 和 Bull import 问题 (Lines 7, 63, 138)

## 3. 类型签名修复

- [x] 3.1 修正 `MedicalEvaluationPipeline.ts:109` determineRiskLevel 参数添加 overall 字段
- [x] 3.2 添加 `TraceStorage.ts` row 参数类型注解 (Lines 341, 370, 401, 435)

## 4. 新发现的错误修复

- [x] 4.1 修复 `src/integration/AgentEvaluationService.ts` 多处错误
- [x] 4.2 修复 `src/queue/EvaluationQueue.ts` 遗留问题 (Lines 187, 295)
- [x] 4.3 修复 `src/queue/EvaluationWorker.ts` apiKey 和 updateProgress 问题
- [x] 4.4 修复 `src/server/bull-board.ts` express 和 Queue 类型问题
- [x] 4.5 修复 `src/tracing/TraceStorage.ts` Object possibly undefined 问题

## 5. 验证与测试

- [x] 5.1 运行 `npm run build` 确认无 TypeScript 错误
- [ ] 5.2 运行测试套件验证功能正确性