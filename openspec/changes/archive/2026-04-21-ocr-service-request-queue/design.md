## Context

### Current Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  当前架构（无队列）                                                           │
│                                                                             │
│  uvicorn (workers=1)                                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │   PaddleOCR Engine (全局单例)                                        │   │
│  │                                                                     │   │
│  │   Request 1 ──▶ predict()                                           │   │
│  │   Request 2 ──▶ predict()  ← 同时调用 → 竞态条件/崩溃                │   │
│  │   Request 3 ──▶ predict()                                           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Constraints

1. **PaddleOCR 不支持并发**：PPStructureV3 的 predict() 方法是同步的，并发调用会导致竞态条件或崩溃
2. **内存限制**：CPU 模式下，PaddleOCR 模型占用约 1-2GB 内存，多 worker 会显著增加内存消耗
3. **请求处理时间长**：每页 OCR 需要 50-270 秒，长时间占用资源
4. **单机场景**：OCR 服务部署在单机，不需要分布式队列

### Stakeholders

- OCR 服务端（Python FastAPI）
- 客户端（TypeScript Node.js）
- 文档处理流程上游（PDF 渲染）
- 用户（大型文档处理体验）

## Goals / Non-Goals

**Goals:**

1. **服务稳定性**：高并发请求下服务不崩溃，能够稳定处理
2. **串行处理保证**：所有 OCR 请求按顺序处理，无并发冲突
3. **状态透明**：客户端可以获取队列状态，据此调整策略
4. **超时控制**：请求超时有明确响应，不无限等待
5. **优雅降级**：队列满时返回明确错误码，客户端可以重试

**Non-Goals:**

1. **不增加吞吐量**：串行处理会降低吞吐，这不是性能优化
2. **不实现分布式队列**：单机场景，asyncio.Queue 足够
3. **不改变 OCR 算法**：只改变请求调度方式
4. **不实现多 worker**：内存限制，保持单 worker

## Decisions

### D1: Queue + Worker vs Semaphore

**Decision: asyncio.Queue + Background Worker**

Alternatives considered:

| 方案 | 优点 | 缺点 |
|------|------|------|
| Semaphore | 实现简单（几行代码） | 客户端需要等待 semaphore 释放，阻塞 |
| Queue + Worker | 优雅的队列机制，支持超时，状态监控 | 实现复杂度较高 |

**Rationale:**

Queue + Worker 提供更完整的控制：
- 客户端请求立即入队（不阻塞在获取 semaphore）
- 明确的队列状态（`/status` 端点）
- 超时处理（`asyncio.wait_for`）
- 队列满时返回 503（明确拒绝，不是阻塞等待）

### D2: Single Worker vs Multiple Workers

**Decision: 保持 workers=1**

Alternatives considered:

| 方案 | 内存消耗 | 并发能力 |
|------|----------|----------|
| workers=1 | ~1-2GB | 串行 |
| workers=2 | ~2-4GB | 伪并发（仍需 Queue） |
| workers=N | ~N×2GB | 内存爆炸 |

**Rationale:**

CPU 模式下，PaddleOCR 模型占用大量内存。增加 workers 会：
- 每个进程加载独立的 OCR 模型
- 内存消耗翻倍
- CPU 竞争反而降低效率

Queue + Worker 在单 worker 下已经能保证稳定。

### D3: Response Codes (503 vs 429)

**Decision: 503 Service Unavailable（队列满），408 Request Timeout（超时）**

**Rationale:**

- **503**: 服务暂时无法处理请求，暗示服务端问题，客户端应等待后重试
- **408**: 单个请求超时，客户端可以选择重试或跳过该页
- **429**: 通常表示速率限制（rate limiting），语义上不太适合队列满场景

返回 JSON body 包含 `retry_after_seconds`，帮助客户端决策。

### D4: Queue Capacity

**Decision: 默认 MAX_QUEUE_SIZE=50**

Alternatives considered:

| 容量 | 内存风险 | 等待时间 |
|------|----------|----------|
| 10 | 低 | 队列满频繁 |
| 50 | 中 | 平衡 |
| 100+ | 高 | 长时间等待 |

**Rationale:**

- 每个队列项包含图片数据（5-10MB）
- 50 项 × 10MB = 500MB 内存占用（可接受）
- 可通过 `OCR_MAX_QUEUE_SIZE` 环境变量调整

## Risks / Trade-offs

### R1: 串行处理降低吞吐量

**Risk**: 大型文档处理时间变长

**Mitigation**:
- 客户端预检 `/status` 端点，避开高峰
- 客户端动态调整 batchSize
- 提供 `estimated_wait_seconds` 让用户知道预期等待时间

### R2: Worker 任务崩溃

**Risk**: Background Worker 因异常退出，队列停止处理

**Mitigation**:
- Worker 内部捕获所有异常，不退出循环
- 每次处理后更新统计，便于监控异常率
- 记录详细日志，方便诊断

### R3: 队列满请求被拒绝

**Risk**: 队列满时返回 503，客户端需要处理

**Mitigation**:
- 返回 `retry_after_seconds` 建议等待时间
- 客户端增加重试逻辑（最多 3 次）
- 客户端预检状态，避免发送到满队列

### R4: 内存泄漏（PaddleOCR）

**Risk**: PaddleOCR 长时间运行可能有内存泄漏

**Mitigation**:
- 监控内存使用（`/status` 端点可扩展）
- 定期重启服务（部署策略）
- 长期：考虑请求完成后清理资源

### T1: Trade-off: 响应延迟 vs 服务稳定

我们选择了稳定（串行处理），牺牲了响应速度。这是合理的取舍：
- 崩溃比慢更糟糕
- 用户可以接受"处理需要 X 分钟"，不能接受"处理失败"