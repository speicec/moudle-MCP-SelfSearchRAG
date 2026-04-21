# 自进化类型修复系统 (Self-Evolving Type Fix System)

## 一、功能概述

本系统是一个**自动化的 TypeScript 类型错误检测与修复引导系统**，通过以下机制实现"自进化"能力：

1. **ESLint 自定义规则** - 实时检测类型错误，并在错误消息中嵌入 MCP Tool 提示
2. **PostToolUse Hook** - 每次代码编辑后自动运行 lint 检查
3. **MCP Tool `type_fix`** - 提供修复建议和代码示例
4. **触发器模式** - 极简的 CLAUDE.md 配置，避免上下文膨胀

```
┌─────────────────────────────────────────────────────────────────┐
│                    核心设计理念                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  传统方式: 先编码 → 后发现错误 → 手动修复                        │
│                                                                 │
│  自进化方式: 编码 → Hook自动检测 → Agent看到提示 → 自动修复      │
│                                                                 │
│  关键创新: 错误消息内嵌 MCP Tool 调用提示                        │
│  "💡 Fix: type_fix(2322)"                                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 二、系统架构

### 2.1 四层触发机制

```
┌─────────────────────────────────────────────────────────────────┐
│                    四层触发保障                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Layer 0: PostToolUse Hook                                      │
│  ─────────────────────────────                                  │
│  • 触发时机: Edit/Write 工具调用后                               │
│  • 执行命令: npm run lint                                       │
│  • 输出结果: ESLint 错误列表 + type_fix 提示                     │
│  • 关键配置: asyncRewake=true (唤醒 Agent)                      │
│                                                                 │
│  Layer 1: CLAUDE.md 触发器                                       │
│  ─────────────────────────────                                  │
│  • 位置: 项目根目录                                              │
│  • 内容: "TS error → type_fix(error_code)"                      │
│  • Token 消耗: ~10 tokens                                       │
│                                                                 │
│  Layer 2: MCP Tool 描述                                          │
│  ─────────────────────────────                                  │
│  • 位置: MCP tools 定义                                          │
│  • 内容: 触发条件 + 覆盖范围 + 修复建议                          │
│  • Token 消耗: ~150 tokens (调用时加载)                         │
│                                                                 │
│  Layer 3: ESLint 错误消息                                        │
│  ─────────────────────────────                                  │
│  • 位置: ESLint 规则输出                                         │
│  • 内容: 错误描述 + "💡 Fix: type_fix(2322)"                    │
│  • 作用: Agent 看到错误时直接看到调用提示                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 数据流图

```
┌─────────────────────────────────────────────────────────────────┐
│                       工作流程                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────┐    Edit     ┌──────────┐    Hook    ┌──────────┐ │
│  │  Agent   │ ──────────▶ │  代码    │ ─────────▶ │  Lint    │ │
│  │  编码    │             │  文件    │           │  检查    │ │
│  └──────────┘             └──────────┘           └────┬─────┘ │
│                                                          │      │
│                                         ┌────────────────┘      │
│                                         │                       │
│                                         ▼                       │
│  ┌──────────┐    Wake     ┌──────────┐    Show     ┌──────────┐ │
│  │  Agent   │◀─────────── │  Hook    │◀────────── │  Error   │ │
│  │  修复    │             │  Output  │            │  Output  │ │
│  └──────────┘             └──────────┘            └──────────┘ │
│       │                                                        │
│       │   看到提示: "💡 Fix: type_fix(2322)"                   │
│       │                                                        │
│       ▼                                                        │
│  ┌──────────┐    Call     ┌──────────┐                      │
│  │  MCP     │ ──────────▶ │ type_fix │                      │
│  │  Tool    │             │  Handler │                      │
│  └──────────┘             └──────────┘                      │
│       │                                                        │
│       │   返回: 修复建议 + 代码示例                             │
│       │                                                        │
│       ▼                                                        │
│  ┌──────────┐                                                  │
│  │  Apply   │   应用修复                                       │
│  │  Fix     │                                                  │
│  └──────────┘                                                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 三、Hook 配置

### 3.1 配置文件位置

```
.claude/settings.local.json
```

### 3.2 完整配置

```json
{
  "permissions": {
    "allow": [
      "Bash(npm run:*)",
      "Bash(npm test:*)",
      ...
    ]
  },
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "npm run lint --silent 2>&1 | tail -50; [ ${PIPESTATUS[0]} -ne 0 ] && exit 2",
            "async": true,
            "asyncRewake": true,
            "timeout": 120,
            "statusMessage": "Running lint check..."
          }
        ]
      }
    ]
  }
}
```

### 3.3 配置说明

| 参数 | 值 | 说明 |
|------|-----|------|
| `matcher` | `Write|Edit` | 匹配 Edit 和 Write 工具调用 |
| `async` | `true` | 异步执行，不阻塞编辑操作 |
| `asyncRewake` | `true` | 当 exit code = 2 时唤醒 Agent |
| `timeout` | `120` | 最大执行时间 120 秒 |
| `statusMessage` | `Running lint check...` | Spinner 显示的消息 |

### 3.4 Exit Code 设计

```
Exit Code 0: lint 通过，无错误
Exit Code 1: lint 发现错误
Exit Code 2: 唤醒 Agent (asyncRewake 触发)
```

命令逻辑:
```bash
npm run lint --silent 2>&1 | tail -50; [ ${PIPESTATUS[0]} -ne 0 ] && exit 2
```

- `tail -50`: 限制输出行数，避免上下文膨胀
- `PIPESTATUS[0]`: 获取 lint 命令的原始 exit code
- `exit 2`: 当有错误时，触发 asyncRewake 唤醒 Agent

---

## 四、ESLint 自定义规则

### 4.1 规则文件位置

```
eslint-rules/no-nullable-assignment.ts
```

### 4.2 规则功能

检测以下 nullable 类型赋值错误:

1. **AssignmentExpression** - 变量赋值
2. **VariableDeclarator** - 变量声明初始化
3. **ReturnStatement** - 函数返回值

### 4.3 错误消息格式

```
Type '{{source}}' is not assignable to type '{{target}}'.
💡 Fix: type_fix(2322)
```

### 4.4 规则核心代码

```typescript
import { ESLintUtils, TSESTree } from '@typescript-eslint/utils';
import * as ts from 'typescript';

const TS_ERROR_CODE = 2322;

export default ESLintUtils.RuleCreator.withoutDocs({
  meta: {
    type: 'problem',
    messages: {
      nullableAssignment: `Type '{{source}}' is not assignable to type '{{target}}'.
💡 Fix: type_fix(${TS_ERROR_CODE})`,
    },
    schema: [],
  },
  create(context) {
    const parserServices = ESLintUtils.getParserServices(context);
    const checker = parserServices.program.getTypeChecker();

    return {
      AssignmentExpression(node) {
        // 检测赋值表达式中的 nullable 类型错误
        ...
      },
      VariableDeclarator(node) {
        // 检测变量声明中的 nullable 类型错误
        ...
      },
      ReturnStatement(node) {
        // 检测返回语句中的 nullable 类型错误
        ...
      },
    };
  },
});
```

---

## 五、MCP Tools

### 5.1 type_fix

**用途**: 获取 TypeScript 类型错误的修复建议

**调用时机**: 看到 ESLint 错误消息中的 `💡 Fix: type_fix(code)` 提示

**输入参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `error_code` | number | 是 | TypeScript 错误代码 (如 2322) |
| `error_message` | string | 否 | 错误消息文本 |

**返回内容**:

```json
{
  "ruleId": "null-assignment",
  "errorCode": 2322,
  "explanation": "规则解释",
  "fixes": [
    {
      "type": "default-value",
      "description": "添加默认值",
      "example": "const x: string = value ?? 'default';",
      "successRate": 0.85
    },
    {
      "type": "non-null-assert",
      "description": "非空断言",
      "example": "const x: string = value!;",
      "successRate": 0.72
    }
  ]
}
```

### 5.2 type_fix_list

**用途**: 获取所有已覆盖的错误代码列表

**返回内容**:

```json
[
  { "errorCode": 2322, "ruleId": "null-assignment", "brief": "null/undefined 赋值错误" },
  ...
]
```

### 5.3 record_fix

**用途**: 记录修复使用情况，用于统计和自进化

**输入参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `rule_id` | string | 是 | 规则 ID |
| `fix_type` | string | 是 | 修复类型 |
| `success` | boolean | 是 | 是否成功 |
| `file` | string | 否 | 文件路径 |
| `line` | number | 否 | 行号 |

---

## 六、使用示例

### 6.1 典型工作流程

```
1. Agent 编辑代码:
   ┌─────────────────────────────────────────┐
   │ const result: string = maybeString;     │
   │ // maybeString 类型为 string | null     │
   └─────────────────────────────────────────┘

2. PostToolUse Hook 自动运行 lint

3. ESLint 检测到错误，输出:
   ┌─────────────────────────────────────────┐
   │ src/example.ts                          │
   │   5:7  error                            │
   │   Type 'string | null' is not           │
   │   assignable to type 'string'.          │
   │   💡 Fix: type_fix(2322)                │
   └─────────────────────────────────────────┘

4. Hook 以 exit code 2 唤醒 Agent

5. Agent 看到提示，调用 type_fix MCP Tool:
   ┌─────────────────────────────────────────┐
   │ Call: type_fix(2322)                    │
   │ Return:                                 │
   │   - 添加默认值: result = x ?? ''        │
   │   - 非空断言: result = x!               │
   │   - 类型收窄: if (x !== null) {...}     │
   └─────────────────────────────────────────┘

6. Agent 应用修复:
   ┌─────────────────────────────────────────┐
   │ const result: string = maybeString ?? '';│
   └─────────────────────────────────────────┘

7. Hook 再次运行，lint 通过
```

### 6.2 触发器模式 vs 传统模式

| 维度 | 传统模式 | 触发器模式 |
|------|----------|------------|
| CLAUDE.md 内容 | 详细规则描述 (~500 tokens) | 单行触发器 (~10 tokens) |
| 错误发现时机 | 手动运行 lint | 自动 (Hook) |
| 修复引导 | 无 | MCP Tool 提示 |
| 上下文消耗 | 高 | 低 (按需加载) |

---

## 七、配置与维护

### 7.1 启用 Hook

**方式一**: 打开 `/hooks` UI 菜单，重新加载配置

**方式二**: 重启 Claude Code 会话

### 7.2 禁用 Hook

1. 编辑 `.claude/settings.local.json`
2. 删除 `hooks.PostToolUse` 配置
3. 打开 `/hooks` 重新加载

### 7.3 添加新规则

1. 创建新规则文件: `eslint-rules/<rule-name>.ts`
2. 在错误消息中添加: `💡 Fix: type_fix(<error_code>)`
3. 在 MCP Tool 中添加对应的修复建议
4. 更新 `type_fix_list` 返回内容

---

## 八、技术实现细节

### 8.1 isNullable 类型检查

```typescript
function isNullable(type: ts.Type, checker: ts.TypeChecker): boolean {
  // Direct null or undefined
  if (type.flags & ts.TypeFlags.Null) return true;
  if (type.flags & ts.TypeFlags.Undefined) return true;

  // Union type - check each constituent
  if (type.flags & ts.TypeFlags.Union) {
    const unionType = type as ts.UnionType;
    return unionType.types.some(t => isNullable(t, checker));
  }

  // Intersection type - check each constituent
  if (type.flags & ts.TypeFlags.Intersection) {
    const intersectionType = type as ts.IntersectionType;
    return intersectionType.types.some(t => isNullable(t, checker));
  }

  // Any or unknown - considered nullable for safety
  if (type.flags & ts.TypeFlags.Any) return true;
  if (type.flags & ts.TypeFlags.Unknown) return true;

  return false;
}
```

### 8.2 ESLint Config 集成

```javascript
// eslint.config.js
import tseslint from 'typescript-eslint';
import noNullableAssignment from './eslint-rules/no-nullable-assignment.ts';

export default tseslint.config(
  tseslint.configs.recommended,
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    plugins: {
      'type-safety': {
        rules: {
          'no-nullable-assignment': noNullableAssignment,
        },
      },
    },
    rules: {
      'type-safety/no-nullable-assignment': 'error',
    },
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',  // 必须配置以启用类型检查
      },
    },
  },
);
```

---

## 九、常见问题

### Q1: Hook 没有触发？

**检查步骤**:
1. 确认 `.claude/settings.local.json` 存在且格式正确
2. 打开 `/hooks` 确认 Hook 已加载
3. 确认编辑的文件匹配 `src/**/*.ts` 或 `src/**/*.tsx`

### Q2: 看不到 type_fix 提示？

**可能原因**:
1. ESLint 规则未正确加载
2. `parserOptions.project` 未配置
3. 错误不在 tail -50 输出范围内

**解决方法**:
- 检查 ESLint 输出的完整内容
- 确认 `tsconfig.json` 包含所有源文件

### Q3: 如何添加新的错误代码支持？

**步骤**:
1. 在 `eslint-rules/` 创建新规则
2. 在 MCP Tool `type_fix` 中添加处理逻辑
3. 创建对应的修复建议文件 `rules/<error-code>.md`

---

## 十、总结

本系统通过以下创新实现"自进化"能力:

1. **自动化检测** - PostToolUse Hook 实现零人工干预
2. **智能引导** - 错误消息内嵌 MCP Tool 调用提示
3. **极简配置** - 触发器模式避免上下文膨胀
4. **持续改进** - record_fix 支持修复统计和优化

这使 Agent 能够:
- 自动发现类型错误
- 知道如何修复
- 应用正确方案
- 学习最佳实践