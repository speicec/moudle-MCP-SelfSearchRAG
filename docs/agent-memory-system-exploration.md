# Agent 记忆系统与上下文管理技术探索

> **探索时间**: 2026-04-22
> **探索类型**: 技术探索
> **基于变更**: `agent-planning-enhancement` (已完成)
> **目的**: 分析当前 Agent 上下文管理现状，探索三层记忆系统设计

---

## 一、现状评估

### 1.1 当前实现架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                  Medical Agent 现有架构全景                                    │
└─────────────────────────────────────────────────────────────────────────────┘

                      ┌────────────────────────────┐
                      │      MedicalAgent.ts       │  主入口（一次性执行）
                      └────────────────────────────┘
                                   │
                                   ▼
                      ┌────────────────────────────┐
                      │     AgentExecutor.ts       │  双模式执行器
                      │   ReAct / PlanAndExecute   │
                      └────────────────────────────┘
                                   │
           ┌───────────────────────┼───────────────────────┐
           │                       │                       │
           ▼                       ▼                       ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  AgentState.ts  │     │ ContextManager  │     │  AgentCache.ts  │
│  状态管理       │     │  上下文管理      │     │   结果缓存      │
│                 │     │                 │     │                 │
│ ✓ 单次查询状态  │     │ ✓ Token 计数    │     │ ✓ LLM 缓存      │
│ ✓ 迭代追踪      │     │ ✓ 压缩/截断     │     │ ✓ 检索缓存      │
│ ✓ 推理轨迹      │     │ ✓ 优先级管理    │     │ ✓ TTL 过期      │
│                 │     │                 │     │                 │
│ ✗ 无跨会话状态  │     │ ✗ 无历史记录    │     │ ✗ 无会话关联    │
│ ✗ 无持久化      │     │ ✗ 无长期记忆    │     │ ✗ 无用户关联    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### 1.2 核心组件分析

| 组件 | 路径 | 已实现能力 | 缺失能力 |
|------|------|-----------|---------|
| **AgentState.ts** | `agent/AgentState.ts` | 单次查询状态、迭代追踪、推理轨迹、状态克隆 | 跨会话状态、持久化、从历史恢复（仅调试） |
| **ContextManager.ts** | `agent/ContextManager.ts` | Token计数、动态压缩、优先级截断、滑动窗口 | 对话历史管理、长期记忆、用户偏好 |
| **AgentCache.ts** | `agent/AgentCache.ts` | LLM响应缓存、检索结果缓存、TTL过期、命中率统计 | 会话关联、用户关联、跨会话共享 |
| **chat.ts** | `server/routes/chat.ts` | 简单内存历史（最后50条） | Agent层无法访问、无持久化 |

### 1.3 关键缺失项

| 缺失能力 | 描述 | 用户影响 |
|---------|------|---------|
| **跨会话上下文** | 每次查询独立执行，无会话关联 | 无法处理追问、澄清等对话场景 |
| **对话历史管理** | chat.ts 有简单历史，但 Agent 层无访问 | Agent 无法利用之前对话上下文 |
| **长期记忆系统** | 无用户偏好、知识积累存储 | 每次重新解释相同概念 |
| **状态持久化** | 所有状态仅在内存 | 服务重启丢失所有状态 |
| **分支状态恢复** | `restoreFromHistory` 仅用于调试 | 无法真正从中断恢复 |

---

## 二、概念厘清：上下文管理 vs 记忆系统

### 2.1 时间维度划分

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     Context Management vs Memory System                      │
└─────────────────────────────────────────────────────────────────────────────┘

    SHORT-TERM (Session)              MEDIUM-TERM (User)            LONG-TERM (Knowledge)
    ══════════════════════            ════════════════════          ═════════════════════

    ┌──────────────────┐              ┌──────────────────┐          ┌──────────────────┐
    │ Conversation     │              │ User Memory      │          │ Knowledge Base   │
    │ History          │              │                  │          │                  │
    │                  │              │ • User Profile   │          │ • Learned Facts  │
    │ • Last N turns   │              │ • Preferences    │          │ • Common Patterns│
    │ • Current focus  │              │ • History Summary│          │ • Domain Rules   │
    │ • Active entities│              │ • Session Context│          │                  │
    │                  │              │                  │          │                  │
    │ TTL: 1 session   │              │ TTL: 30 days     │          │ TTL: Permanent   │
    │ Storage: Memory  │              │ Storage: DB/File │          │ Storage: Vector  │
    └──────────────────┘              └──────────────────┘          └──────────────────┘
            │                                 │                              │
            ▼                                 ▼                              ▼
    ContextWindow管理                 用户个性化                      知识检索增强
    (已实现部分)                      (未实现)                        (未实现)
```

### 2.2 职责边界

| 层级 | 职责 | 示例数据 | Token预算 |
|------|------|---------|----------|
| **Short-Term** | 当前对话上下文 | 最近5轮问答、当前实体焦点 | 4K tokens |
| **Medium-Term** | 用户个性化记忆 | 常用药物列表、偏好设置 | 2K tokens |
| **Long-Term** | 知识积累 | 已验证医学事实、学习结果 | 8K tokens |

---

## 三、三层记忆系统设计

### 3.1 整体架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     Agent Memory System - 三层架构                            │
└─────────────────────────────────────────────────────────────────────────────┘

                              Query Input
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │      MemoryCoordinator       │  新增组件
                    │   (协调三层记忆)              │
                    └──────────────────────────────┘
                                   │
        ┌──────────────────────────┼──────────────────────────┐
        │                          │                          │
        ▼                          ▼                          ▼
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│ Short-Term      │      │ Medium-Term     │      │ Long-Term       │
│ Memory          │      │ Memory          │      │ Memory          │
│                 │      │                 │      │                 │
│ 实现: 扩展       │      │ 实现: 新增       │      │ 实现: 新增       │
│ ContextManager  │      │ UserMemory.ts   │      │ KnowledgeVault  │
└─────────────────┘      └─────────────────┘      └─────────────────┘
        │                          │                          │
        │                          │                          │
        ▼                          ▼                          ▼
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│ • 最近N轮对话   │      │ • 用户偏好      │      │ • 已确认的医学   │
│ • 当前实体焦点  │      │ • 常用药物列表  │      │   知识事实      │
│ • 临时澄清信息  │      │ • 历史诊断记录  │      │ • Agent学习结果 │
│ • 正在处理任务  │      │ • 会话摘要      │      │ • 领域规则      │
│                 │      │                 │      │                 │
│ Token预算: 4K   │      │ Token预算: 2K   │      │ Token预算: 8K   │
│ 存储: 内存      │      │ 存储: JSON文件  │      │ 存储: 向量索引  │
└─────────────────┘      └─────────────────┘      └─────────────────┘
```

### 3.2 Short-Term Memory（对话历史）设计

**扩展 ContextManager**：

```typescript
interface ConversationContext {
  // 现有能力（保留）
  entries: ContextEntry[];      // 检索内容
  tokenBudget: number;
  
  // 新增：对话历史
  turns: ConversationTurn[];    // 用户-Agent 对话轮次
  
  // 新增：当前焦点
  activeEntities: EntityFocus;  // 当前正在讨论的实体
  
  // 新增：澄清状态
  clarifications: Clarification[]; // 已澄清的信息
}

interface ConversationTurn {
  role: 'user' | 'agent';
  content: string;
  entities: MedicalEntities;  // 该轮涉及的实体
  timestamp: number;
  summary?: string;           // 压缩后的摘要（早期轮次）
}

interface EntityFocus {
  primary: string;            // 当前主要关注实体
  related: string[];          // 相关实体
  lastUpdated: number;
}
```

**关键设计点**：

1. **Token预算管理**：对话历史占用独立预算（4K tokens）
2. **滑动窗口**：保留最近 N 轮（如 5-10 轮）
3. **智能压缩**：早期对话压缩为摘要（LLM/规则）
4. **实体追踪**：自动识别并追踪当前焦点实体

### 3.3 Medium-Term Memory（用户记忆）设计

```typescript
interface UserMemory {
  userId: string;
  
  // 用户画像
  profile: {
    preferredLanguage: 'zh' | 'en';
    expertiseLevel: 'patient' | 'clinician' | 'researcher';
    commonTopics: string[];  // 常问话题标签
  };
  
  // 历史摘要（定期压缩）
  sessionSummaries: SessionSummary[];
  
  // 实体记忆（核心）
  entityMemory: {
    knownDrugs: DrugMemory[];      // 已讨论过的药物
    knownDiseases: DiseaseMemory[]; // 已讨论过的疾病
    knownIndicators: IndicatorMemory[]; // 已讨论过的指标
  };
  
  // 偏好设置
  preferences: {
    alwaysIncludeSources: boolean;
    preferredFormat: 'detailed' | 'concise';
    enableSafetyWarnings: boolean;
  };
  
  // 元数据
  lastActive: number;
  totalSessions: number;
}

interface DrugMemory {
  canonicalName: string;
  lastDiscussed: number;    // 时间戳
  discussionCount: number;  // 讨论次数
  keyPoints: string[];      // 用户关注点（如副作用、剂量）
  userNotes?: string;       // 用户备注
}
```

**存储方案选择**：

| 方案 | 复杂度 | 适用场景 |
|------|-------|---------|
| JSON文件 | 低 | 单用户、原型验证 |
| SQLite | 中 | 多用户、本地部署 |
| LevelDB | 中 | 高性能读写 |
| PostgreSQL | 高 | 生产级、分布式 |

**推荐路径**：先 JSON → 后 SQLite

### 3.4 Long-Term Memory（知识库）设计

```typescript
interface KnowledgeVault {
  // 已验证事实（来自高置信度回答）
  verifiedFacts: VerifiedFact[];
  
  // Agent 自学习结果
  learnedPatterns: LearnedPattern[];
  
  // 领域规则（硬知识）
  domainRules: DomainRule[];
}

interface VerifiedFact {
  id: string;
  content: string;
  source: SourceCitation;
  verifiedAt: number;
  confidence: number;
  usageCount: number;     // 被引用次数
  
  // 向量索引（用于检索）
  embedding?: number[];
  
  // 关联实体
  entities: {
    drugs: string[];
    diseases: string[];
    indicators: string[];
  };
}

interface LearnedPattern {
  patternType: 'query_pattern' | 'retrieval_pattern' | 'answer_pattern';
  description: string;
  examples: string[];
  effectivenessScore: number;  // 基于用户反馈
}
```

**使用方式**：

1. **检索优先级**：先检索 verifiedFacts，若命中可跳过外部检索
2. **置信度门槛**：confidence ≥ 0.85 + usageCount ≥ 3 才入库
3. **定期清理**：时间衰减 + 低效移除

---

## 四、集成架构设计

### 4.1 Memory-Aware Agent 流程

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Memory-Aware Agent 执行流程                                │
└─────────────────────────────────────────────────────────────────────────────┘

                           MedicalAgent.run()
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │     MemoryCoordinator        │  新增组件
                    │   (协调三层记忆)              │
                    └──────────────────────────────┘
                                   │
        ┌──────────────────────────┼──────────────────────────┐
        │                          │                          │
        ▼                          ▼                          ▼
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│ ShortTermMemory │      │ UserMemory      │      │ KnowledgeVault  │
│                 │      │                 │      │                 │
│ 获取最近对话    │      │ 获取用户偏好    │      │ 检索相关事实    │
│ 合并到上下文    │      │ 合并到上下文    │      │ 合并到检索结果  │
└─────────────────┘      └─────────────────┘      └─────────────────┘
        │                          │                          │
        └──────────────────────────┼──────────────────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │     Enhanced Context         │
                    │   (注入记忆后的完整上下文)     │
                    │                              │
                    │ • ConversationHistory (4K)   │
                    │ • UserPreferences (2K)       │
                    │ • VerifiedFacts (可选 8K)    │
                    │ • RetrievalResults (动态)    │
                    └──────────────────────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │      AgentExecutor           │
                    │   (执行逻辑不变，输入更丰富)   │
                    └──────────────────────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │     执行完成后更新记忆        │
                    │                              │
                    │ • 保存本轮对话到 ShortTerm   │
                    │ • 更新用户实体记忆到 Medium  │
                    │ • 高置信度答案→VerifiedFact  │
                    └──────────────────────────────┘
```

### 4.2 Session Manager 设计

```typescript
interface SessionManager {
  // 会话生命周期
  sessions: Map<string, Session>;
  
  // 当前活跃会话
  activeSessionId: string | null;
  
  // 会话操作
  createSession(userId?: string): Session;
  getSession(id: string): Session | null;
  closeSession(id: string): void;
  
  // 会话恢复
  restoreSession(id: string): boolean;
  serializeSession(id: string): string;
}

interface Session {
  id: string;
  userId?: string;          // 可选用户标识
  createdAt: number;
  lastActiveAt: number;
  
  // 状态
  status: 'active' | 'paused' | 'closed';
  
  // 关联组件
  shortTermMemory: ConversationContext;
  agentState?: AgentState;  // 可恢复的执行状态
  
  // 统计
  turnCount: number;
  totalTokensUsed: number;
}
```

---

## 五、实现优先级与路径

### 5.1 优先级矩阵

| 优先级 | 功能 | 复杂度 | 价值 | 建议时机 |
|-------|------|-------|------|---------|
| **P0** | 对话历史管理（Short-Term） | 低 | 高 | 立即可做 |
| **P1** | 会话管理（Session Manager） | 中 | 高 | P0完成后 |
| **P2** | 用户记忆（Medium-Term） | 中 | 中 | 有用户系统后 |
| **P3** | 知识库（Long-Term） | 高 | 中 | 稳定运行后 |

### 5.2 实现路径

```
Phase 1: Short-Term Memory (预估 2-3 天)
───────────────────────────────────────
1. 扩展 ContextManager.ts → ConversationContextManager.ts
2. 新增 ConversationTurn 类型
3. 新增 EntityFocus 追踪机制
4. 实现 Token 预算分离
5. 集成到 AgentExecutor

Phase 2: Session Manager (预估 1-2 天)
───────────────────────────────────────
1. 新增 SessionManager.ts
2. 实现会话创建/关闭/恢复
3. 连接 chat.ts WebSocket 会话
4. 状态序列化/反序列化

Phase 3: Medium-Term Memory (预估 3-4 天)
───────────────────────────────────────
1. 新增 UserMemory.ts 类型定义
2. 实现 JSON 文件存储
3. 实现实体记忆更新逻辑
4. 集成到 MemoryCoordinator

Phase 4: Long-Term Memory (预估 5-7 天)
───────────────────────────────────────
1. 新增 KnowledgeVault.ts
2. 集成到现有向量索引（Qdrant）
3. 实现验证入库逻辑
4. 实现检索优先级策略
```

---

## 六、开放问题

### 6.1 待决策问题

| 问题 | 选项 | 建议 |
|------|------|------|
| **会话标识方式** | A.匿名session ID / B.用户登录 / C.设备指纹 | 先A，后B |
| **记忆更新时机** | A.每轮结束 / B.会话结束 / C.用户确认 | 先B，关键用C |
| **知识验证机制** | A.高置信度+多次验证 / B.用户确认 | A+B混合 |
| **隐私考量** | A.本地存储 / B.加密存储 / C.云端 | 医学数据建议A+B |
| **历史压缩算法** | A.LLM摘要 / B.关键实体提取 / C.时间衰减 | C优先，A可选 |

### 6.2 技术风险

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| Token预算超限 | 上下文丢失 | 分层预算+动态压缩 |
| 记忆污染 | 错误知识传播 | 验证门槛+定期清理 |
| 会话状态膨胀 | 性能下降 | 定期快照+增量更新 |
| 用户隐私泄露 | 安全合规 | 本地存储+加密 |

---

## 七、参考资源

### 7.1 相关代码文件

- `src/medical/agent/ContextManager.ts` - 现有上下文管理
- `src/medical/agent/AgentState.ts` - 状态管理
- `src/medical/agent/AgentCache.ts` - 结果缓存
- `src/server/routes/chat.ts` - HTTP会话路由
- `openspec/changes/agent-planning-enhancement/design.md` - Planning架构设计

### 7.2 相关文档

- [Agent 预研路线分析](./agent-roadmap-analysis.md)
- [PlanAndExecute 模式改进设计](./rag-agent-planandexecute-improvements.md)
- [Re-planning 验证阈值设计](./agent-replanning-validation.md)
- [TaskPlanner Prompt 设计](./agent-taskplanner-prompts.md)

---

## 八、下一步行动

1. **确认需求优先级**：与用户确认最迫切需要的能力
2. **创建变更提案**：使用 OpenSpec 创建 `agent-memory-system` 变更
3. **原型验证**：先实现 Short-Term Memory 的基础版本
4. **集成测试**：验证与现有 Planning 架构的兼容性

---

> **探索状态**: 初步完成，待需求确认后进入提案阶段