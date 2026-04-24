## Context

项目使用 TypeScript strict 模式，启用了 `exactOptionalPropertyTypes: true`。该选项要求可选属性 `foo?: T` 不能被显式赋值 `undefined`（只能 omit 或赋 `T` 类型值）。当前代码存在多处违反此规则的情况，导致构建失败。

**错误分布**:
- 重复导出: 1 处
- 类型导入缺失: 1 处
- Phase 类型不匹配: 1 处
- exactOptionalPropertyTypes 问题: 9 处
- 函数参数不匹配: 1 处
- 缺失模块声明: 1 处
- implicit any: 4 处
- Bull import 问题: 2 处

## Goals / Non-Goals

**Goals:**
- 修复所有 TypeScript 构建错误，恢复构建能力
- 保持 `exactOptionalPropertyTypes: true` 严格模式不降级
- 使用统一模式解决可选属性赋值问题

**Non-Goals:**
- 不关闭或降级 tsconfig.json 中的严格选项
- 不重构超出修复范围的代码
- 不添加新的功能或能力

## Decisions

### D1: 保持 exactOptionalPropertyTypes 开启

**决定**: 保持 `exactOptionalPropertyTypes: true`，系统性修复代码

**理由**: 项目已采用严格类型系统，关闭会降低类型安全性并可能隐藏潜在 bug

**替代方案**: 关闭该选项 — 被拒绝，因为会降低整体类型安全性

### D2: 可选属性赋值策略

**决定**: 使用条件赋值模式（spread + condition）

**模式**:
```typescript
// ❌ 错误写法
const obj: T = { optionalProp: maybeUndefined };

// ✅ 正确写法
const obj: T = {
  requiredProp: value,
  ...(maybeUndefined && { optionalProp: maybeUndefined }),
};
```

**理由**: 保持接口定义不变，只修改赋值逻辑，最小化变更范围

**替代方案**:
- 修改接口定义为 `prop?: T | undefined` — 被拒绝，会放宽类型约束
- 使用 omit + 后续赋值 — 被拒绝，代码更分散

### D3: Phase 类型修复

**决定**: 将 `'trace'` 改为 `'complete'`

**理由**: `'trace'` 是内部持久化日志操作，不属于 Agent 执行阶段。`'complete'` phase 更符合语义

**替代方案**: 扩展 phase 类型添加 `'trace'` — 被拒绝，因为这不是真正的执行阶段

### D4: sql.js 类型声明位置

**决定**: 创建 `src/types/sql.js.d.ts` 文件

**理由**: 项目级声明文件，与其他类型声明一致

**替代方案**: 安装 `@types/sql.js` — 被拒绝，npm 上不存在官方类型包

## Risks / Trade-offs

| 风险 | 缓解措施 |
|------|----------|
| 条件赋值模式增加代码复杂度 | 使用注释标注原因，保持模式一致性 |
| 修复后仍可能有运行时问题 | 运行完整测试套件验证 |
| sql.js 类型声明不完整可能遗漏方法 | 基于实际使用定义必要方法，可后续扩展 |

## Migration Plan

无迁移需求。修复后直接构建验证:

1. 修复代码
2. 运行 `npm run build`
3. 确认无错误
4. 运行测试验证功能正确性