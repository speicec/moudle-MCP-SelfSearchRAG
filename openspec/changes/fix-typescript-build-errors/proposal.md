## Why

项目构建失败，存在约 50 个 TypeScript 类型错误阻塞开发和部署。错误源于代码不符合 `exactOptionalPropertyTypes: true` 严格模式及其他类型定义问题。需系统性修复以恢复构建能力并保持类型安全标准。

## What Changes

- **修复重复导出**: 删除 `src/tracing/index.ts` 中重复的 `EvaluationTrendData` 导出
- **补充缺失导入**: 在 `src/evaluation/types.ts` 添加 `RiskLevel` 和 `EvaluationWeights` 类型导入
- **修正 Phase 类型**: 将 `AgentExecutor.ts` 中的 `'trace'` phase 改为 `'complete'`
- **修复可选属性赋值**: 使用条件赋值模式解决 `exactOptionalPropertyTypes` 问题（9 个文件）
- **修正函数参数**: 为 `determineRiskLevel` 调用添加缺失的 `overall` 字段
- **添加类型声明**: 创建 `sql.js` 模块的类型声明文件
- **消除 implicit any**: 为 `TraceStorage.ts` 的 `row` 参数添加类型注解
- **修正 Bull import**: 修正 `EvaluationQueue.ts` 的 Queue 类型导入

## Capabilities

### New Capabilities

无新能力引入，这是现有代码的修复。

### Modified Capabilities

无 spec 级别的能力变更。修复仅涉及实现细节和类型合规性。

## Impact

**受影响文件**:
- `src/tracing/index.ts` - 重复导出修复
- `src/evaluation/types.ts` - 导入补充
- `src/medical/agent/AgentExecutor.ts` - Phase 类型修正
- `src/config/redis-config.ts` - 可选属性赋值
- `src/tracing/TraceContext.ts` - 多处可选属性赋值
- `src/tracing/TraceStorage.ts` - sql.js 类型 + row 参数类型
- `src/tracing/TraceVisualizer.ts` - 可选属性赋值
- `src/tracing/MetricsAggregator.ts` - 可选属性赋值
- `src/evaluation/MedicalEvaluationPipeline.ts` - 函数参数修正
- `src/queue/EvaluationQueue.ts` - Bull import + 可选属性赋值
- `src/types/sql.js.d.ts` - 新增类型声明文件

**依赖**: 无新依赖，修复使用现有模式

**API**: 无 API 变更，修复仅影响内部实现