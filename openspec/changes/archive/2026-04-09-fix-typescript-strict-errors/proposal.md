## Why

当前项目启用 `exactOptionalPropertyTypes` 和 `noUncheckedIndexedAccess` 等严格TypeScript选项，但代码中存在约120处类型错误，导致项目无法编译。这些错误源于接口定义与实际使用不一致、缺少空值处理、导入导出问题等。需要全面修复以确保类型安全，保持严格类型配置不变。

## What Changes

- **修复 exactOptionalPropertyTypes 错误**：接口可选属性显式声明 `| undefined`
- **修复 noUncheckedIndexedAccess 错误**：数组/索引访问添加空值检查或非空断言
- **修复导入导出问题**：解决重复导出、缺失成员、模块路径问题
- **修复类型不匹配**：参数类型、返回值类型、赋值类型对齐
- **修复抽象类实例化**：BaseStage 不应被直接实例化
- **修复 async/await 问题**：确保 await 在 async 函数内使用

## Capabilities

### New Capabilities

- `type-safety-guidelines`: TypeScript严格模式下的类型编码规范

### Modified Capabilities

(无 - 这是代码质量修复，不改变功能需求)

## Impact

- **影响文件**：约30个源文件
- **不影响运行时行为**：仅类型系统修复
- **保持tsconfig严格配置**：不放宽任何类型检查选项
- **提升代码质量**：更强的类型安全保障