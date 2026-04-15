# QA-2: AI流式输出场景下，前端如何处理残缺JSON？

## 问题背景

> 来源：掘金文章 https://juejin.cn/post/7627690218269851702
> 
> "在一个 AI 流式输出（Streaming）的对话场景里，如果大模型返回的是一个极其复杂的、带有代码块和多步工具调用（Tool Call）的 JSON 块。在流式传输还没结束、JSON 还是残缺状态的时候，你的前端是怎么保证 UI 不崩溃，并且能平滑渲染中间状态的？"

---

## 当前系统的实际情况

**结论：这个项目的前端并没有处理"残缺JSON"的场景。**

当前系统的流式处理采用 **"风险上移"** 设计：

```
服务端 SSE Event                前端处理
────────────────────────────────────────────────────
generation:thinking │ "思"     →  直接拼接字符串
generation:thinking │ "考"     →  直接拼接字符串  
generation:thinking │ "中"     →  直接拼接字符串
                     ↓
              state.currentThinking += content
                     ↓
              完整JSON → JSON.parse() → 取出content字段
```

### 关键代码位置

**WebSocket层** (`src/frontend/lib/websocket-singleton.ts`):
```typescript
// 每个chunk都是完整的JSON message
const message = JSON.parse(event.data);
```

**Store层** (`src/frontend/store/index.ts`):
```typescript
handleGenerationThinking: (content: string) => {
  set((state) => ({
    currentThinking: state.currentThinking + content,
  }));
},
```

**UI层** (`src/frontend/components/ChatWindow.tsx`):
```typescript
// 直接渲染累积的字符串，没有解析逻辑
{currentThinking}
<span className="cursor-animation" />
```

### 为什么不会崩溃？

设计规避了问题：

```
┌─────────────────────────────────────────────────────────┐
│               当前系统的安全边界                          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  服务端: 生成完整JSON chunk → 发送                       │
│          {"type":"thinking","content":"思考中"}         │
│                                                         │
│  前端:  收到完整JSON → parse → 取content → 拼接         │
│          永远不处理残缺JSON                              │
│                                                         │
│  风险边界: 移到了服务端                                  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 复杂场景分析：多步工具调用的残缺JSON

文章问的复杂场景：

```
大模型返回复杂JSON块（含代码块 + 多步工具调用）

{
  "type": "tool_calls",
  "calls": [
    {"name": "read_file", "args": {"path": "/src/
```

在JSON还没闭合时，前端怎么做？

---

## 三种处理策略

### 策略1: 不解析，直接渲染原始文本

```
───────────────────────────────────────────────
收到什么显示什么，用特殊样式标记"正在生成"

UI: 显示 `{ "name": "read_file", "arg` + 闪烁光标
问题: 用户看到原始JSON，体验差
───────────────────────────────────────────────
```

### 策略2: 增量解析器（Incremental Parser）

```
───────────────────────────────────────────────
专门处理不完整JSON的解析器

输入: `{ "name": "read_file", "arg`
输出: { name: "read_file", argInProgress: true }

关键: 容错解析，部分字段可用就先用
───────────────────────────────────────────────
```

实现示例：

```typescript
class IncrementalJsonParser {
  private buffer = '';
  private result: Partial<ToolCall> = {};
  
  feed(chunk: string) {
    this.buffer += chunk;
    this.tryParse();
  }
  
  private tryParse() {
    // 尝试完整解析
    try {
      const parsed = JSON.parse(this.buffer + '}'); // 补闭合
      this.result = parsed;
      return;
    } catch {
      // 不完整，尝试部分解析
    }
    
    // 提取已完成的字段
    const nameMatch = this.buffer.match(/"name":\s*"([^"]+)"/);
    if (nameMatch) {
      this.result.name = nameMatch[1];
      // name字段完整，可以提前显示工具名
    }
    
    // args可能还在生成中
    const argsMatch = this.buffer.match(/"args":\s*\{/);
    if (argsMatch) {
      this.result.argsInProgress = true;
    }
  }
  
  getPartialResult() {
    return this.result;
  }
}
```

### 策略3: 状态机 + 缓冲区

```
───────────────────────────────────────────────
按结构解析，维护当前解析状态

state: "in_object" | "in_array" | "in_string" | ...
buffer: 累积当前token
render: 根据state决定渲染策略

例: state="in_string" → 渲染字符串内容
    state="in_object_key" → 渲染key名
───────────────────────────────────────────────
```

---

## UI渲染中间状态

```tsx
function ToolCallRenderer({ partialToolCall }) {
  if (!partialToolCall.name) {
    return <span className="loading">准备调用工具...</span>;
  }
  
  return (
    <div className="tool-call">
      <span className="tool-name">{partialToolCall.name}</span>
      {partialToolCall.argsInProgress && (
        <span className="args-loading">参数生成中...</span>
      )}
      {partialToolCall.args && (
        <pre>{JSON.stringify(partialToolCall.args, null, 2)}</pre>
      )}
    </div>
  );
}
```

---

## 核心洞察：数据结构视角

> "Bad programmers worry about the code. Good programmers worry about data structures."
> 
> 问题出在数据结构：用JSON表示流式输出是错误选择。

```
方案A（文章问的）：大模型输出完整JSON → 流式传输 → 前端解析残缺
  问题：前端被迫处理不可能的任务（解析不完整结构）

方案B（当前项目）：服务端流式生成 → 每个chunk封装成完整JSON → 前端只解析完整JSON
  优势：复杂度在服务端，服务端知道生成状态，可以正确封装

方案C（最优）：大模型输出结构化事件流 → 不是JSON而是事件协议
  例：<tool_call name="read_file">
       <arg name="path" value="/src/...">
      	
  优势：事件天然支持增量，不需要闭合
```

---

## 推荐改造路径：服务端事件拆分

如果需要支持复杂场景（工具调用、代码块），推荐改造服务端：

```
之前: 一个大JSON包含整个tool_call
{
  "type": "tool_call",
  "name": "read_file",
  "args": { "path": "/src/index.ts" }
}

改为: 拆分成多个原子事件
→ {"type":"tool_start","name":"read_file"}
→ {"type":"tool_arg","key":"path","value":"/src/index.ts"}
→ {"type":"tool_end"}

前端处理:
─────────────────────────────────────────────────
收到 tool_start → 渲染工具名开始
收到 tool_arg  → 渲染参数
收到 tool_end  → 完成状态

每个事件都是完整JSON，前端永远不碰残缺解析
```

---

## 面试回答模板

**简短版（30秒）**：

> 我们系统的设计是把复杂度推给服务端。服务端把每个流式片段封装成完整的JSON消息发送，前端只需要解析完整JSON然后拼接字符串。这样就规避了前端处理残缺JSON的问题。如果未来需要支持复杂的工具调用场景，我们会改造服务端把一个大JSON拆分成多个原子事件流，让前端永远只处理完整消息。

**深入版（展开）**：

> 这个问题的本质其实是数据结构设计问题。用JSON来承载流式输出本身就是一种设计缺陷——JSON要求完整闭合，而流式输出的特点是渐进式生成。
> 
> 我们系统的做法是"风险上移"：服务端知道当前生成到什么状态，所以可以在发送前把内容封装成完整JSON。比如每个thinking片段单独封装成一个`{"type":"thinking","content":"..."}`事件，前端只需要JSON.parse然后取content字段拼接。
> 
> 如果文章问的那种"复杂工具调用JSON在生成中残缺"的场景，有三种策略：一是直接渲染原始文本（体验差）；二是用增量解析器做容错解析（技术复杂度高）；三是状态机方式（最通用但实现成本大）。
> 
> 但我认为最好的做法是从根源解决问题：服务端把一个大JSON拆分成原子事件流。比如tool_call拆成`tool_start`、`tool_arg`、`tool_end`三个独立事件，每个都是完整JSON。这样前端永远只处理完整结构，复杂度在服务端可控。
> 
> 这就是"消除特殊情况"的设计思维——不是让前端学会解析残缺JSON，而是让服务端永远不发送残缺JSON。

---

## 关键要点总结

| 维度 | 内容 |
|------|------|
| 当前方案 | 服务端封装完整JSON，前端只做字符串拼接 |
| 设计原则 | "风险上移" - 复杂度在服务端可控 |
| 扩展方案 | 原子事件流拆分，每个事件独立完整 |
| 核心洞察 | 数据结构问题：JSON不适合流式输出 |
| 面试金句 | "不是让前端学会解析残缺JSON，而是让服务端永远不发送残缺JSON" |