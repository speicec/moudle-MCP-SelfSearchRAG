## ADDED Requirements

### Requirement: TypeScript 构建成功

系统代码 SHALL 通过 TypeScript 编译检查，无类型错误。

#### Scenario: 构建命令执行成功

- **WHEN** 执行 `npm run build`
- **THEN** TypeScript 编译完成且无错误输出

### Requirement: 可选属性赋值符合 exactOptionalPropertyTypes

可选属性 `prop?: T` SHALL NOT 被显式赋值 `undefined`。

#### Scenario: 条件赋值模式

- **WHEN** 构建包含可选属性的对象
- **THEN** 使用条件 spread 赋值或完全 omit 属性

### Requirement: 类型导入完整

使用外部类型 SHALL 在文件头部显式导入。

#### Scenario: RiskLevel 和 EvaluationWeights 导入

- **WHEN** `evaluation/types.ts` 使用 `RiskLevel` 或 `EvaluationWeights` 类型
- **THEN** 文件头部包含 `import type { RiskLevel, EvaluationWeights } from '../tracing/types.js'`

### Requirement: Phase 类型值有效

AgentLogger phase 值 SHALL 在定义的联合类型范围内。

#### Scenario: 有效 phase 值

- **WHEN** 调用 `logger.log(iteration, phase, message)`
- **THEN** phase 为 `'think' | 'act' | 'observe' | 'decide' | 'answer' | 'complete' | 'decide_rule' | 'early_termination'` 之一

### Requirement: 第三方模块有类型声明

使用无类型声明的第三方模块 SHALL 提供项目级声明文件。

#### Scenario: sql.js 类型声明

- **WHEN** `TraceStorage.ts` 导入 `sql.js`
- **THEN** `src/types/sql.js.d.ts` 存在且包含必要接口定义