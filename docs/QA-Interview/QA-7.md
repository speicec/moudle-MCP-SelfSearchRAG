# QA-7: 自进化 ESLint 规则系统 - 类型安全智能修复

> 问题：如何创建一个自进化的 ESLint 规则，遇到 `string | null` 不能赋给 `string` 这类类型错误时，不只给出错误提示，而是给出修复建议并记录，支持 Agent 一键式启动类型修复？

---

## 一、核心概念：自进化闭环

```
┌─────────────────────────────────────────────────────────────────────┐
│                     自进化类型安全闭环                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   ┌──────────┐                                                      │
│   │ 开发者   │                                                      │
│   │ 编码     │                                                      │
│   └────┬─────┘                                                      │
│        │                                                            │
│        ▼                                                            │
│   ┌──────────┐      ┌──────────────┐                               │
│   │ ESLint   │─────▶│ 规则 + 修复  │  ← 记录修复模式               │
│   │ 检测     │      │ 建议存储     │                               │
│   └────┬─────┘      └──────┬───────┘                               │
│        │                  │                                        │
│        ▼                  ▼                                        │
│   ┌──────────┐      ┌──────────────┐                               │
│   │ 提示错误 │      │ Agent 读取   │  ← 下次编码前预加载           │
│   │ + 建议   │      │ 规则知识库   │                               │
│   └────┬─────┘      └──────┬───────┘                               │
│        │                  │                                        │
│        ▼                  ▼                                        │
│   ┌──────────┐      ┌──────────────┐                               │
│   │ Agent    │─────▶│ 编写安全代码 │  ← 避免 null 类型问题         │
│   │ 一键修复 │      │ 不再犯错     │                               │
│   └────┬─────┘      └──────────────┘                               │
│        │                                                            │
│        ▼                                                            │
│   ┌──────────────────────────────────────┐                         │
│   │ 修复成功 → 学习新模式 → 更新规则存储  │                         │
│   └──────────────────────────────────────┘                         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 二、技术方案对比：独立规则 vs 包装 TypeScript 错误

### 2.1 两种方案架构

```
┌─────────────────────────────────────────────────────────────────┐
│ 方案 A: 独立的自定义 ESLint 规则                                 │
│                                                                 │
│  自己实现类型检查逻辑                                           │
│                                                                 │
│  ┌─────────┐    ┌─────────────────┐    ┌─────────────────────┐ │
│  │ ESLint  │───▶│ 你的规则代码     │───▶│ 自己分析 AST + 类型 │ │
│  │ 运行    │    │                 │    │                     │ │
│  └─────────┘    └─────────────────┘    └─────────────────────┘ │
│                                                                 │
│  核心 API:                                                      │
│  const parserServices = ESLintUtils.getParserServices(context); │
│  const checker = parserServices.program.getTypeChecker();       │
│  const tsNode = parserServices.esTreeNodeToTSNodeMap.get(node); │
│  const type = checker.getTypeAtLocation(tsNode);                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ 方案 B: 包装 TypeScript 编译器错误                              │
│                                                                 │
│  让 TypeScript 先检查，你只是包装/增强它的输出                   │
│                                                                 │
│  ┌─────────┐    ┌─────────────────┐    ┌─────────────────────┐ │
│  │ ESLint  │───▶│ TypeScript 编译 │───▶│ 包装错误 + 添加修复 │ │
│  │ 运行    │    │ 器检查          │    │ 建议                │ │
│  └─────────┘    └─────────────────┘    └─────────────────────┘ │
│                                                                 │
│  流程:                                                          │
│  1. tsc 发现错误 (TS2322)                                       │
│  2. 解析错误字符串                                               │
│  3. 根据错误码查知识库                                          │
│  4. 输出修复建议                                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 详细对比表

| 维度 | 方案 A (独立规则) | 方案 B (包装 tsc) |
|------|------------------|------------------|
| **控制权** | ✅ 完全控制检测逻辑 | ❌ 依赖 tsc 的检测 |
| **检测时机** | ESLint 运行时，实时检测 | 需要 tsc 先编译，可能较慢 |
| **检测精度** | 需自己实现，可能有漏洞 | ✅ 使用 tsc 官方逻辑，最准确 |
| **修复建议** | ✅ 可根据上下文动态生成 | 需解析 tsc 错误再匹配 |
| **知识库集成** | ✅ 规则内部可直接调用 | 需额外桥接逻辑 |
| **性能** | 每次检查都用类型 API | tsc 编译可能较慢 |
| **复杂度** | 中高 (需了解 TS Compiler API) | 中 (需解析 tsc 输出) |
| **IDE 集成** | ✅ ESLint 插件原生支持 | 可能需要额外配置 |
| **Agent 预读取** | ✅ 规则文件本身就是"知识" | 需额外存储 |

### 2.3 推荐方案

**推荐方案 A (独立规则)**，理由：

| 需求 | 方案 A 优势 |
|------|------------|
| **Agent 预读取规则** | 规则文件本身就是"知识"，Agent 可以直接读取学习 |
| **修复建议集成** | 规则内部可以直接调用知识库，动态生成建议 |
| **自进化记录** | 可以在规则里记录每次检测，统计使用频率 |
| **IDE 实时反馈** | ESLint 原生支持，编辑器里实时看到 |

---

## 三、ESLint 规则实现技术

### 3.1 核心 API

```typescript
import { ESLintUtils, TSESTree } from '@typescript-eslint/utils';
import * as ts from 'typescript';

// 获取类型检查器
const parserServices = ESLintUtils.getParserServices(context);
const checker = parserServices.program.getTypeChecker();

// ESLint AST 节点 → TypeScript AST 节点
const tsNode = parserServices.esTreeNodeToTSNodeMap.get(node);

// 获取类型
const type = checker.getTypeAtLocation(tsNode);

// 检查类型兼容性 (关键!)
checker.isTypeAssignableTo(sourceType, targetType)

// 检查类型标志位
if (type.flags & ts.TypeFlags.String) { ... }
if (type.flags & ts.TypeFlags.Null) { ... }
if (type.flags & ts.TypeFlags.Undefined) { ... }
```

### 3.2 完整规则示例

```typescript
// eslint-rules/no-nullable-assignment.ts
import { ESLintUtils, TSESTree } from '@typescript-eslint/utils';
import * as ts from 'typescript';

export default ESLintUtils.RuleCreator.withoutDocs({
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow nullable assignment without handling',
    },
    messages: {
      nullableAssignment: 'Cannot assign nullable type "{{source}}" to non-null type "{{target}}"',
    },
    schema: [],
    hasSuggestions: true,
  },
  defaultOptions: [],
  create(context) {
    const parserServices = ESLintUtils.getParserServices(context);
    const checker = parserServices.program.getTypeChecker();
    
    // 加载修复知识库
    const fixKnowledgeBase = loadFixKnowledgeBase();
    
    return {
      // 检测赋值表达式
      AssignmentExpression(node: TSESTree.AssignmentExpression) {
        const tsLeft = parserServices.esTreeNodeToTSNodeMap.get(node.left);
        const tsRight = parserServices.esTreeNodeToTSNodeMap.get(node.right);
        
        const leftType = checker.getTypeAtLocation(tsLeft);
        const rightType = checker.getTypeAtLocation(tsRight);
        
        // 检查是否 nullable 赋给 non-null
        if (isNullable(rightType) && !isNullable(leftType)) {
          // 从知识库获取修复建议
          const suggestions = fixKnowledgeBase.getSuggestions({
            sourceType: rightType,
            targetType: leftType,
            node: node.right,
          });
          
          context.report({
            node,
            messageId: 'nullableAssignment',
            data: {
              source: checker.typeToString(rightType),
              target: checker.typeToString(leftType),
            },
            suggest: suggestions.map(s => ({
              desc: s.description,
              fix: (fixer) => fixer.replaceText(node.right, s.code),
            })),
          });
        }
      },
    };
  },
});

// 检查类型是否包含 null 或 undefined
function isNullable(type: ts.Type): boolean {
  return (type.flags & ts.TypeFlags.Null) !== 0 
    || (type.flags & ts.TypeFlags.Undefined) !== 0
    || (type.flags & ts.TypeFlags.Union) !== 0 
      && (type as ts.UnionType).types.some(t => isNullable(t));
}
```

### 3.3 规则配置 (eslint.config.js)

```javascript
import tseslint from 'typescript-eslint';
import noNullableAssignment from './eslint-rules/no-nullable-assignment';

export default tseslint.config(
  {
    files: ['**/*.ts'],
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
        project: './tsconfig.json', // 必需：启用类型检查
      },
    },
  },
);
```

---

## 四、修复知识库设计

### 4.1 文件结构

```
eslint-type-fixes/
├── rules/                     # 规则定义 (Agent 可读)
│   ├── null-assignment.md     # 单条规则 + 修复建议
│   ├── undefined-property.md  
│   ├── array-index-access.md  
│   └── ...
│
├── stats/                     # 使用统计 (自进化数据)
│   └── usage-log.json         # 记录每次修复
│
└── index.json                 # 索引 (快速查找)
```

### 4.2 规则文件模板 (Markdown - Agent 直接可读)

```markdown
---
id: null-assignment
type: type-safety
severity: error
tsCode: 2322
tags: [null, nullable, assignment, type-mismatch]
---

# Nullable Type Assignment

## Detection

TypeScript reports error when a nullable type (`T | null` or `T | undefined`) 
is assigned to a non-null type (`T`).

**Example error message:**
```
Type 'string | null' is not assignable to type 'string'.
Type 'null' is not assignable to type 'string'.
```

## Pattern Match

```
SourceType: T | null | undefined
TargetType: T
```

## Fix Suggestions

### Fix 1: Non-null assertion (when you're sure it's not null)
```typescript
// Before
let x: string = maybeNull;

// After  
let x: string = maybeNull!;
```
**When to use:** You are confident the value is not null at this point.

### Fix 2: Default value fallback
```typescript
// Before
let x: string = maybeNull;

// After
let x: string = maybeNull ?? "";
```
**When to use:** You want a safe default when value is null.

### Fix 3: Conditional check
```typescript
// Before
let x: string = maybeNull;

// After
if (maybeNull !== null) {
  let x: string = maybeNull;
}
```
**When to use:** You need to handle the null case explicitly.

### Fix 4: Type guard function
```typescript
// Before
function process(input: string | null): string {
  return input.toUpperCase(); // Error!
}

// After
function process(input: string | null): string {
  if (input === null) {
    throw new Error("Input cannot be null");
  }
  return input.toUpperCase();
}
```
**When to use:** In function body, when you need runtime validation.

## Statistics

| Fix Type | Times Used | Success Rate |
|----------|-----------|--------------|
| non-null-assert | 15 | 87% |
| default-value | 32 | 100% |
| condition-check | 8 | 100% |
| type-guard | 5 | 95% |

## Related Rules

- [undefined-property](undefined-property.md)
- [array-index-access](array-index-access.md)
```

### 4.3 使用统计文件 (usage-log.json)

```json
{
  "records": [
    {
      "timestamp": "2026-04-20T10:30:00Z",
      "ruleId": "null-assignment",
      "fixType": "default-value",
      "success": true,
      "file": "src/server/handlers.ts",
      "line": 42,
      "sourceType": "string | null",
      "targetType": "string"
    }
  ],
  "summary": {
    "null-assignment": {
      "totalHits": 60,
      "fixDistribution": {
        "non-null-assert": 15,
        "default-value": 32,
        "condition-check": 8,
        "type-guard": 5
      }
    }
  }
}
```

---

## 五、精简设计原则：避免上下文漂移

### 5.1 核心问题：上下文漂移

```
┌─────────────────────────────────────────────────────────────────┐
│                      上下文漂移问题                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  问题本质:                                                       │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                                                             ││
│  │  CLAUDE.md 太长 → 占满上下文窗口 → Agent "忘记"重要规则      ││
│  │                                                             ││
│  │  上下文窗口有限 (比如 200K tokens)                          ││
│  │  - 编码对话会不断增长                                       ││
│  │  - CLAUDE.md 每次都加载                                     ││
│  │  - 如果 CLAUDE.md 占 50K tokens → 只剩 150K 给实际工作      ││
│  │                                                             ││
│  │  结果:                                                       ││
│  │  - Agent 在长对话中可能"忘记"早期的重要规则                  ││
│  │  - 响应质量下降                                             ││
│  │  - 不必要的成本增加                                         ││
│  │                                                             ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 精简主文件设计原则

```
┌─────────────────────────────────────────────────────────────────┐
│                    精简主文件设计原则                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  原则 1: 主文件只做"触发器"                                     │
│  ─────────────────────────────────────────────────────────────  │
│  • 不放详细规则内容                                             │
│  • 不放规则列表                                                 │
│  • 只放一行触发指令                                             │
│                                                                 │
│  原则 2: MCP Tool 描述承载完整信息                              │
│  ─────────────────────────────────────────────────────────────  │
│  • MCP Tool description 包含触发条件                            │
│  • MCP Tool description 包含覆盖范围                            │
│  • Agent 调用时才知道完整规则                                   │
│                                                                 │
│  原则 3: ESLint 错误消息内嵌触发提示                            │
│  ─────────────────────────────────────────────────────────────  │
│  • 错误消息包含 "💡 Fix: type_fix(code)"                        │
│  • Agent 看到错误时直接看到调用提示                             │
│  • 三重保障确保不会遗漏                                         │
│                                                                 │
│  原则 4: 分层存储                                               │
│  ─────────────────────────────────────────────────────────────  │
│  • L0: CLAUDE.md (触发层) - < 20 tokens                         │
│  • L1: MCP Tool 描述 (触发条件层) - 调用时加载                  │
│  • L2: rules/*.md (详细规则层) - MCP Tool 返回                  │
│  • L3: usage-log.json (统计数据层) - 动态更新                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5.3 Token 消耗对比分析

```
┌─────────────────────────────────────────────────────────────────┐
│                    Token 消耗分析                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────────┤
│  │ 方案        │ 项目上下文 │ MCP调用时 │ 总消耗 │ 效率         │
│  ├──────────────────────────────────────────────────────────────┤
│  │ 段落描述    │ 500       │ 0        │ 500    │ ❌ 高消耗     │
│  │ 表格索引    │ 75        │ 150      │ 225    │ ⚠ 中等       │
│  │ 触发器模式  │ 10        │ 200      │ 210    │ ✅ 最优       │
│  └──────────────────────────────────────────────────────────────┤
│                                                                 │
│  关键洞察:                                                       │
│  • 项目上下文每次都加载 → 必须最小化                            │
│  • MCP Tool 描述只在调用时加载 → 可以详细                       │
│  • 触发器模式: 项目上下文 10 tokens，详细内容按需加载            │
│                                                                 │
│  精简效率提升: 83%                                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 六、Agent 读取规则的方式（推荐：触发器模式）

### 6.1 触发器模式架构

```
┌─────────────────────────────────────────────────────────────────┐
│                    触发器模式架构                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  核心设计: CLAUDE.md 极精简 + MCP Tool 描述完整                  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                                                             ││
│  │  CLAUDE.md (10 tokens)                                      ││
│  │  ───────────────────                                        ││
│  │  TS error → type_fix(code)                                  ││
│  │                                                             ││
│  │                     ↓                                       ││
│  │                                                             ││
│  │  MCP Tool 描述 (在 tools 定义中)                            ││
│  │  ─────────────────────────────────                          ││
│  │  name: 'type_fix'                                           ││
│  │  description:                                               ││
│  │    "Get fix suggestions for TypeScript errors.              ││
│  │     WHEN: TS error code (2322, 2353, 2532...)               ││
│  │     RETURNS: fix suggestions + code examples"               ││
│  │                                                             ││
│  │                     ↓                                       ││
│  │                                                             ││
│  │  知识库文件 (按需加载)                                       ││
│  │  ─────────────────────                                      ││
│  │  rules/{code}.md                                            ││
│  │                                                             ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 三重触发保障机制

```
┌─────────────────────────────────────────────────────────────────┐
│                   三重触发保障                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Layer 1: CLAUDE.md 触发器                                   ││
│  │                                                             ││
│  │   • 位置: 项目根目录                                        ││
│  │   • 内容: "TS error → type_fix(code)"                      ││
│  │   • 作用: 提示存在这个 MCP Tool                             ││
│  │                                                             ││
│  │ Layer 2: MCP Tool 描述                                      ││
│  │                                                             ││
│  │   • 位置: MCP tools 定义                                    ││
│  │   • 内容: 完整的触发条件 + 覆盖范围                         ││
│  │   • 作用: Agent 调用时知道这个 Tool 能做什么                ││
│  │                                                             ││
│  │ Layer 3: ESLint 错误消息                                    ││
│  │                                                             ││
│  │   • 位置: ESLint 规则的错误输出                             ││
│  │   • 内容: 错误消息 + "💡 Fix: type_fix(code)" 提示          ││
│  │   • 作用: 错误发生时直接提示 Agent 调用                     ││
│  │                                                             ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  三重保障: 即使 Agent 漏掉一层，还有两层能触发                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 6.3 各层内容设计

**Layer 1: CLAUDE.md（极精简）**

```markdown
# Project Config

TS error → `type_fix(error_code)`
```

**仅 10 tokens，一行触发器**

**Layer 2: MCP Tool 定义（详细）**

```typescript
export const TYPE_FIX_TOOLS = {
  type_fix: {
    name: 'type_fix',
    description: `
Get fix suggestions for TypeScript type errors.

WHEN TO CALL:
- TypeScript error code appears (2322, 2353, 2532, etc.)
- Type mismatch messages ("Type X is not assignable to type Y")
- Null/undefined assignment errors

RETURNS:
- Rule explanation
- Fix suggestions (code examples)
- Success rate statistics

COVERED RULES:
- 2322: null-assignment (string|null → string)
- 2353: undefined-property (optional prop needs | undefined)
- 2532: array-index-access (array[i] may be undefined)
`,
    inputSchema: {
      type: 'object',
      properties: {
        error_code: { type: 'number', description: 'TypeScript error code' },
        error_message: { type: 'string', description: 'Error message for context' },
      },
      required: ['error_code'],
    },
  },
  
  record_fix: {
    name: 'record_fix',
    description: 'Record fix usage. Call after applying fix.',
    inputSchema: {
      type: 'object',
      properties: {
        rule_id: { type: 'string' },
        fix_type: { type: 'string' },
        success: { type: 'boolean' },
      },
      required: ['rule_id', 'fix_type', 'success'],
    },
  },
};
```

**MCP Tool 描述约 150 tokens，只在调用时加载**

**Layer 3: ESLint 错误消息增强**

```typescript
// 在 ESLint 规则的错误消息中添加触发提示
context.report({
  node,
  message: `Type '${sourceType}' is not assignable to type '${targetType}'.
💡 Fix: type_fix(2322)`,
});
```

**Agent 看到 ESLint 错误时，直接看到调用提示**

### 6.4 触发场景分析

```
┌─────────────────────────────────────────────────────────────────┐
│                   触发可靠性场景分析                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ 场景 1: Agent 编码前                                         ││
│  │                                                             ││
│  │   Agent 进入项目 → 读取 CLAUDE.md                            ││
│  │        ↓                                                    ││
│  │   看到 "TS error → type_fix(code)"                          ││
│  │        ↓                                                    ││
│  │   编码时遇到 TS 错误 → 触发 type_fix                         ││
│  │                                                             ││
│  │   ✓ CLAUDE.md 触发器生效                                     ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ 场景 2: Agent 查看可用 MCP Tools                             ││
│  │                                                             ││
│  │   Agent 列出 MCP tools → 看到 type_fix 完整描述              ││
│  │        ↓                                                    ││
│  │   遇到类型错误 → 知道要调用 type_fix                         ││
│  │                                                             ││
│  │   ✓ MCP Tool 描述生效                                        ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ 场景 3: Agent 运行 ESLint                                    ││
│  │                                                             ││
│  │   ESLint 输出错误                                            ││
│  │        ↓                                                    ││
│  │   错误消息包含 "💡 Fix: type_fix(2322)"                      ││
│  │        ↓                                                    ││
│  │   Agent 看到提示 → 直接调用 type_fix                         ││
│  │                                                             ││
│  │   ✓ ESLint 错误提示生效                                      ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 七、MCP Tool 实现（触发器模式）

### 7.1 触发器模式 MCP Tools 定义

```typescript
// src/mcp/type-fix-tools.ts
export const TYPE_FIX_TOOLS = {
  type_fix: {
    name: 'type_fix',
    description: `
Get fix suggestions for TypeScript type errors.

WHEN TO CALL:
- TypeScript error code appears (2322, 2353, 2532, etc.)
- Type mismatch messages ("Type X is not assignable to type Y")
- Null/undefined assignment errors

RETURNS:
- Rule explanation
- Fix suggestions (code examples)
- Success rate statistics (for priority ranking)

COVERED RULES:
- 2322: null-assignment (string|null → string)
- 2353: undefined-property (optional prop needs | undefined)
- 2532: array-index-access (array[i] may be undefined)
- 18048: property-undefined (obj.prop may be undefined)
`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        error_code: {
          type: 'number',
          description: 'TypeScript error code (e.g., 2322)',
        },
        error_message: {
          type: 'string',
          description: 'The error message text (optional, for context)',
        },
      },
      required: ['error_code'],
    },
  },

  record_fix: {
    name: 'record_fix',
    description: `
Record fix usage for self-evolving statistics.
Call this after successfully applying a fix to update the knowledge base.

REQUIRED: rule_id, fix_type, success
`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        rule_id: {
          type: 'string',
          description: 'The rule ID (e.g., "null-assignment")',
        },
        fix_type: {
          type: 'string',
          description: 'The fix type applied (e.g., "default-value", "non-null-assert")',
        },
        success: {
          type: 'boolean',
          description: 'Whether the fix was successful',
        },
        file: {
          type: 'string',
          description: 'The file path (optional)',
        },
        line: {
          type: 'number',
          description: 'The line number (optional)',
        },
      },
      required: ['rule_id', 'fix_type', 'success'],
    },
  },

  type_fix_list: {
    name: 'type_fix_list',
    description: 'Get list of all covered TypeScript error codes and rules.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
};
```

### 7.2 MCP Tool Handler 实现

```typescript
// src/mcp/type-fix-handlers.ts
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const RULES_DIR = join(process.cwd(), 'eslint-type-fixes');
const STATS_FILE = join(RULES_DIR, 'stats', 'usage-log.json');

export class TypeFixHandlers {
  
  /**
   * 根据错误码获取修复建议（核心方法）
   */
  async typeFix(errorCode: number, errorMessage?: string): Promise<ToolResult> {
    // 根据错误码查找规则文件
    const ruleFile = join(RULES_DIR, 'rules', `${errorCode}.md`);
    
    try {
      const ruleContent = readFileSync(ruleFile, 'utf-8');
      
      // 解析 Markdown 获取修复建议和统计
      const { fixes, stats } = parseRuleMarkdown(ruleContent);
      
      // 根据统计排序修复建议（成功率高的优先）
      const prioritizedFixes = prioritizeFixes(fixes, stats);
      
      return {
        success: true,
        data: {
          errorCode,
          ruleContent,
          fixes: prioritizedFixes,
          stats,
        },
      };
    } catch {
      return {
        success: false,
        error: `No rule found for error code ${errorCode}`,
      };
    }
  }
  
  /**
   * 记录修复使用情况（自进化核心）
   */
  async recordFix(record: FixUsageRecord): Promise<ToolResult> {
    const stats = JSON.parse(readFileSync(STATS_FILE, 'utf-8'));
    
    // 添加新记录
    stats.records.push({
      timestamp: new Date().toISOString(),
      ...record,
    });
    
    // 更新汇总统计
    const ruleKey = record.ruleId;
    if (!stats.summary[ruleKey]) {
      stats.summary[ruleKey] = { 
        totalHits: 0, 
        fixDistribution: {},
        successRate: {},
      };
    }
    
    stats.summary[ruleKey].totalHits++;
    stats.summary[ruleKey].fixDistribution[record.fixType] = 
      (stats.summary[ruleKey].fixDistribution[record.fixType] || 0) + 1;
    
    if (record.success) {
      stats.summary[ruleKey].successRate[record.fixType] = 
        (stats.summary[ruleKey].successRate[record.fixType] || 0) + 1;
    }
    
    // 写回文件
    writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2));
    
    return {
      success: true,
      data: { 
        recorded: true, 
        summary: stats.summary[ruleKey],
        suggestion: 'Statistics updated. Next query will prioritize successful fixes.',
      },
    };
  }
  
  /**
   * 获取规则列表
   */
  async typeFixList(): Promise<ToolResult> {
    const index = JSON.parse(readFileSync(join(RULES_DIR, 'index.json'), 'utf-8'));
    
    return {
      success: true,
      data: {
        rules: index.rules.map(r => ({
          errorCode: r.tsCode,
          ruleId: r.id,
          brief: r.brief,
        })),
        total: index.rules.length,
      },
    };
  }
}

// 统计驱动的优先级排序
function prioritizeFixes(fixes: Fix[], stats: RuleStats): Fix[] {
  if (!stats || stats.totalHits === 0) return fixes;
  
  return fixes.map(fix => {
    const usageCount = stats.fixDistribution[fix.type] || 0;
    const successCount = stats.successRate[fix.type] || 0;
    const successRate = usageCount > 0 ? successCount / usageCount : 0;
    
    return {
      ...fix,
      priority: successRate * 0.7 + (usageCount / stats.totalHits) * 0.3,
      stats: { usageCount, successRate },
    };
  }).sort((a, b) => b.priority - a.priority);
}
```

---

## 八、自进化循环机制

### 8.1 学习流程

```
┌─────────────────────────────────────────────────────────────────┐
│                      自进化学习循环                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Step 1: Agent 遇到类型错误                                     │
│          ↓                                                      │
│  Step 2: 查询知识库，获取修复方案列表                            │
│          ↓                                                      │
│  Step 3: 选择最合适的修复方案（根据统计优先级）                  │
│          ↓                                                      │
│  Step 4: 应用修复                                               │
│          ↓                                                      │
│  Step 5: 验证修复结果                                           │
│          ├── 成功 → 记录到 usage-log.json                       │
│          └── 失败 → 尝试下一个方案，或添加新方案                 │
│          ↓                                                      │
│  Step 6: 更新统计汇总                                           │
│          ↓                                                      │
│  Step 7: 下次遇到同类问题时，优先推荐成功率高的方案              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 8.2 统计驱动的优先级排序

```typescript
// 根据统计数据排序修复建议
function prioritizeFixes(fixes: Fix[], stats: RuleStats): Fix[] {
  return fixes.map(fix => ({
    ...fix,
    priority: calculatePriority(fix, stats),
  })).sort((a, b) => b.priority - a.priority);
}

function calculatePriority(fix: Fix, stats: RuleStats): number {
  const usageCount = stats.fixDistribution[fix.type] || 0;
  const successRate = usageCount / stats.totalHits;
  
  // 优先级 = 成功率权重 * 0.7 + 使用频率权重 * 0.3
  return successRate * 0.7 + (usageCount / Math.max(stats.totalHits, 1)) * 0.3;
}
```

---

## 九、项目现有类型安全规范参考

本项目已有类型安全规范（来自 `openspec/changes/archive/2026-04-09-fix-typescript-strict-errors`）：

### 9.1 现有规范

| 规范 | 说明 |
|------|------|
| Optional properties must explicitly include undefined | 接口可选属性需要显式声明 `| undefined` |
| Array index access must handle undefined | 数组索引访问需处理 undefined（`noUncheckedIndexedAccess`） |
| Import exports must not have naming conflicts | 导入导出不能有命名冲突 |
| Abstract classes must not be instantiated directly | 抽象类不能直接实例化 |
| Type imports must be consistent | `import type` 只用于类型注解 |
| Async functions must contain await properly | await 只能在 async 函数内使用 |

### 9.2 现有 vs 自进化对比

```
┌─────────────────────────────────────────────────────────────────┐
│ 现有规范 (静态)                                                  │
│                                                                 │
│ "Optional properties must explicitly include undefined"         │
│ → 只是规则描述                                                   │
│ → 没有修复代码示例                                               │
│ → 没有 Agent 可执行的操作                                        │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│ 自进化知识库 (动态)                                              │
│                                                                 │
│ 同一条规则 + 修复建议 + 学习统计                                  │
│                                                                 │
│ "Optional property with undefined assignment"                   │
│ → 规则描述                                                       │
│ → 修复方案列表 (可执行代码)                                      │
│ → 使用统计 (哪种方案最常用)                                      │
│ → Agent 可一键应用                                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 十、面试回答要点

### 开场（10秒）
> "自进化 ESLint 规则系统的核心是：检测 → 建议 → 修复 → 学习 → 改进的闭环，让类型错误不再只是报错，而是变成可学习、可自动修复的知识。"

### 技术方案（30秒）
> "技术上选择独立自定义 ESLint 规则，而不是包装 TypeScript 编译器错误。因为可以完全控制检测逻辑、直接集成修复知识库、规则文件本身就是 Agent 可读的知识。核心用 `@typescript-eslint/utils` 的 `getTypeChecker()` 和 `getTypeAtLocation()` 来获取类型信息。"

### 精简设计（20秒）
> "为了避免上下文漂移，CLAUDE.md 采用触发器模式，仅 10 tokens 一行：'TS error → type_fix(code)'。详细信息由 MCP Tool 描述承载（约 150 tokens，只在调用时加载）。还有三重触发保障：CLAUDE.md 触发器、MCP Tool 描述、ESLint 错误消息内嵌提示，确保 Agent 不会遗漏。"

### 知识库设计（20秒）
> "知识库分层存储：L0 触发层（CLAUDE.md，10 tokens）、L1 MCP Tool 描述层（调用时加载）、L2 详细规则层（rules/*.md）、L3 统计数据层（usage-log.json）。Agent 通过 MCP Tool 查询详细建议，按需获取，不浪费上下文。"

### 自进化机制（20秒）
> "关键是学习循环：每次 Agent 应用修复后，调用 `record_fix` MCP tool 记录。统计数据驱动优先级排序——成功率高的方案优先推荐。这样系统会随着使用越来越智能。"

### 关键优势（10秒）
> "对比传统方案：传统 ESLint 只报错；自进化系统提供修复建议、记录学习、支持 Agent 一键修复、下次优先推荐成功方案。CLAUDE.md 仅 10 tokens，避免上下文漂移。"