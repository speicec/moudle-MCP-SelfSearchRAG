# Agent 执行指南

> 此文档定义 Agent 如何使用 Spec 驱动开发

## 快速开始

### 1. 启动开发

```
1. 读取 specs/overview.md → 了解项目全貌
2. 读取 specs/schedule.md → 确认当前节点
3. 读取相关 Spec → 理解实现细节
4. 执行任务 → 按 Spec 实现
5. 验证结果 → 确保合规
6. 等待确认 → 节点完成
```

### 2. 执行命令

```bash
# 开始 Node A
"开始 Node A 开发"

# 检查当前状态
"当前开发状态是什么？"

# 验证当前任务
"验证当前实现的 Spec 合规性"

# 完成节点
"Node A 已完成，请求确认"
```

## 详细流程

### Phase 1: 读取 Spec

**必须读取的文件**：

```markdown
1. specs/overview.md          - 项目总览
2. specs/schedule.md          - 当前节点和任务
3. specs/directory-structure.md - 目录结构规范
4. [相关技术 Spec]            - 根据任务类型
```

**任务到 Spec 映射**：

| 任务类型 | 必读 Spec |
|----------|-----------|
| 存储层开发 | architecture.md, plugin-system.md |
| 查询层开发 | query-layer.md |
| 切分层开发 | chunking-layer.md |
| 检索层开发 | reranker.md, offline-search.md, long-tail-query.md |
| MCP Server | tools.md, resources.md, prompts.md |
| Harness | harness.md |
| 测试评估 | evaluation.md |

### Phase 2: 实现代码

**必须遵守**：

1. **接口签名**：必须与 Spec 定义的接口完全一致
2. **数据结构**：必须使用 Spec 定义的类型
3. **目录位置**：必须放在 directory-structure.md 指定的位置
4. **依赖关系**：只依赖下层，不反向依赖

**代码模板**：

```typescript
// 文件头：标注 Spec 来源
/**
 * @spec query-layer.md#QueryParser
 * @node B.3
 * @task 实现查询解析器
 */

import { ParsedQuery, QueryIntent } from '../types';

// 接口定义来自 Spec
export interface IQueryParser {
  parse(rawQuery: string): Promise<ParsedQuery>;
}

// 实现必须符合 Spec 接口
export class QueryParser implements IQueryParser {
  async parse(rawQuery: string): Promise<ParsedQuery> {
    // 实现逻辑...
  }
}
```

### Phase 3: 验证合规

**自检清单**：

```markdown
- [ ] 接口签名与 Spec 一致
- [ ] 数据类型与 Spec 一致
- [ ] 文件位置符合目录规范
- [ ] 依赖关系正确（只依赖下层）
- [ ] 添加了 Trace 信息
- [ ] 通过单元测试
- [ ] 满足验收标准
```

**验证命令**：

```bash
# 类型检查
npm run type-check

# 代码检查
npm run lint

# 单元测试
npm test

# Spec 合规检查
npm run spec-check
```

### Phase 4: 完成确认

**节点完成条件**：

1. 所有任务已完成
2. 所有验证已通过
3. 所有验收标准已满足
4. Trace 信息已记录

**请求确认**：

```
Node A 已完成：

✅ A.1 项目初始化 - 通过
✅ A.2 存储层实现 - 通过
✅ A.3 插件系统框架 - 通过
✅ A.4 Harness基础组件 - 通过
✅ A.5 单元测试 - 通过率 85%

验收标准：
✅ 项目可编译
✅ 插件系统可加载/卸载
✅ Milvus 连接正常
✅ 约束规则生效
✅ 单元测试通过率 > 80%

请确认是否可以进入 Node B？
```

## Skill 使用指南

### requirements-analyzer

**使用场景**：
- 分析新需求
- 更新 Spec 文档

**调用示例**：
```
调用 requirements-analyzer 分析以下需求：
[需求描述]
```

**输出**：specs/*.md 规格文档

### coder

**使用场景**：
- 根据 Spec 实现代码

**调用示例**：
```
调用 coder 实现 specs/query-layer.md#QueryParser 接口
```

**输出**：src/query/parser.ts

### tdd-tester

**使用场景**：
- 编写测试用例
- 运行测试

**调用示例**：
```
调用 tdd-tester 为 QueryParser 编写测试
```

**输出**：tests/query/parser.test.ts

### reviewer

**使用场景**：
- 代码审核
- Spec 合规检查

**调用示例**：
```
调用 reviewer 审核 src/query/parser.ts 的 Spec 合规性
```

**输出**：审核报告

### cicd-orchestrator

**使用场景**：
- 生成 Dockerfile
- 配置 CI/CD

**调用示例**：
```
调用 cicd-orchestrator 创建生产部署配置
```

**输出**：Dockerfile, docker-compose.yml, .github/workflows/

## 异常处理

### Spec 不存在

```
错误：未找到 spec: specs/xxx.md
解决：先调用 requirements-analyzer 创建 Spec
```

### 接口不匹配

```
错误：接口签名与 Spec 不匹配
Spec: parse(query: string): Promise<ParsedQuery>
代码: parse(query: string): ParsedQuery
解决：修改代码使签名与 Spec 一致
```

### 验收标准未满足

```
错误：验收标准未通过
标准: 单元测试通过率 > 80%
实际: 75%
解决：修复失败的测试用例
```

## 进度追踪

### 查看进度

```
当前节点: Node A
当前任务: A.3 插件系统框架
任务状态: 进行中
已完成: A.1, A.2
待完成: A.3, A.4, A.5
```

### 更新进度

每完成一个任务，更新 specs/schedule.md 中的状态标记。