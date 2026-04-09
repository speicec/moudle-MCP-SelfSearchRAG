## Context

项目使用严格的TypeScript配置，包括：
- `exactOptionalPropertyTypes: true` - 可选属性不能显式赋值 `undefined`
- `noUncheckedIndexedAccess: true` - 数组索引访问返回 `T | undefined`
- `strict: true` - 启用所有严格类型检查

## Goals / Non-Goals

**Goals:**
- 修复所有TypeScript编译错误（约120个）
- 保持严格类型配置不变
- 建立一致的类型编码模式

**Non-Goals:**
- 不改变运行时行为
- 不添加新功能
- 不修改业务逻辑

## Decisions

### 1. 可选属性类型定义

**决定：显式声明 `| undefined`**

```typescript
// ❌ 错误模式
interface Foo {
  bar?: string;  // exactOptionalPropertyTypes 下不能赋 undefined
}

// ✅ 正确模式
interface Foo {
  bar?: string | undefined;  // 显式允许 undefined
}
```

理由：保持 `exactOptionalPropertyTypes` 的好处，同时允许显式传递 `undefined`。

### 2. 数组索引访问处理

**决定：使用非空断言或条件检查**

```typescript
// ❌ 错误
const item = array[0];

// ✅ 方案A：条件检查
const item = array[0];
if (item !== undefined) { /* use item */ }

// ✅ 方案B：非空断言（确定存在时）
const item = array[0]!;
```

### 3. 导入导出规范

**决定：使用显式重新导出**

```typescript
// ❌ 错误：重复导出同名成员
export * from './a';
export * from './b';  // b 中也有同名导出

// ✅ 正确：显式选择导出
export { foo } from './a';
export { bar } from './b';
```

### 4. 抽象类处理

**决定：使用具体子类或修复抽象类设计**

```typescript
// ❌ 错误
new BaseStage('name', plugins);

// ✅ 正确
class ConcreteStage extends BaseStage { /* ... */ }
new ConcreteStage('name', plugins);
```

## Risks / Trade-offs

| 风险 | 缓解措施 |
|------|----------|
| 非空断言过度使用导致运行时错误 | 仅在确定存在时使用，添加注释说明 |
| 类型修复引入隐式行为变化 | 仅修改类型，不修改逻辑 |