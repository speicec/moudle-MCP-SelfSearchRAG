---
capability: async-evaluation
version: 2.0
created: 2026-04-23
updated: 2026-04-23
---

# Spec: Async Evaluation with Redis + Bull

## 概述

使用 Redis + Bull 实现生产级异步评估队列，确保评估不阻塞 Agent 主流程。

---

## 为什么选择 Redis + Bull

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Redis + Bull vs Worker Threads                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Worker Threads (Node.js 内置)                                       │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │  ✓ 无外部依赖                                                        │   │
│  │  ✓ 真正并行                                                          │   │
│  │  ✗ 单节点限制                                                        │   │
│  │  ✗ 任务不持久化 (进程重启丢失)                                        │   │
│  │  ✗ 无监控界面                                                        │   │
│  │  ✗ 重试机制需手动实现                                                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Redis + Bull (生产级) ★                                             │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │  ✓ 任务持久化 (Redis 存储)                                           │   │
│  │  ✓ 分布式支持 (多 Worker 进程)                                       │   │
│  │  ✓ 内置重试机制                                                      │   │
│  │  ✓ 优先级队列                                                        │   │
│  │  ✓ 延迟任务                                                          │   │
│  │  ✓ Bull Board 监控界面                                               │   │
│  │  ✓ 任务进度跟踪                                                      │   │
│  │  ✗ 需要外部 Redis                                                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  结论: 生产环境首选 Redis + Bull                                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 架构设计

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Redis + Bull 架构                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                        Agent 主进程                                          │
│                        ═══════════════                                       │
│                                                                             │
│   MedicalAgent.execute()                                                    │
│          │                                                                  │
│          │  1. 执行 Agent 主流程 (3-6秒)                                     │
│          │                                                                  │
│          ▼                                                                  │
│   TraceContext.build()                                                      │
│          │                                                                  │
│          │  2. 构建追踪数据                                                   │
│          │                                                                  │
│          ▼                                                                  │
│   TraceStorage.saveTrace()                                                  │
│          │                                                                  │
│          │  3. 持久化追踪 (主线程，<10ms)                                     │
│          │                                                                  │
│          ▼                                                                  │
│   EvaluationQueue.add(job)                                                  │
│          │                                                                  │
│          │  4. 添加到 Bull 队列                                              │
│          │     jobId = traceId                                              │
│          │     data = { traceData, weights }                                │
│          │     opts = { priority, attempts, backoff }                       │
│          │                                                                  │
│          │←─────────────────────────────────────────────────────────────    │
│          │  立即返回 job.id (不阻塞!)                                        │
│          │                                                                  │
│          ▼                                                                  │
│   return AgentResult                                                        │
│          │                                                                  │
│          │  用户收到响应！                                                   │
│          │                                                                  │
│                                                                             │
│                        Redis                                                 │
│                        ═════                                                 │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │  Bull Queue: evaluation:pending                                      │   │
│   │                                                                      │   │
│   │  Job 1: { traceId, traceData, priority: 'normal' }                  │   │
│   │  Job 2: { traceId, traceData, priority: 'high' }                    │   │
│   │  Job 3: { traceId, traceData, priority: 'low' }                     │   │
│   │  ...                                                                 │   │
│   │                                                                      │   │
│   │  特性:                                                                │   │
│   │  • 持久化存储 (进程重启不丢失)                                        │   │
│   │  • 优先级排序 (high > normal > low)                                  │   │
│   │  • 自动重试 (attempts: 3, backoff: exponential)                     │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│                        Worker 进程 (独立)                                    │
│                        ══════════════════                                    │
│                                                                             │
│   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐                      │
│   │  Worker 1   │   │  Worker 2   │   │  Worker 3   │                      │
│   │             │   │             │   │             │                      │
│   │  Bull Worker│   │  Bull Worker│   │  Bull Worker│                      │
│   │  Process Job│   │  Process Job│   │  Process Job│                      │
│   │             │   │             │   │             │                      │
│   │  • 获取 Job │   │  • 获取 Job │   │  • 获取 Job │                      │
│   │  • 执行评估 │   │  • 执行评估 │   │  • 执行评估 │                      │
│   │  • LLM调用 │   │  • LLM调用 │   │  • LLM调用 │                      │
│   │  • 更新进度 │   │  • 更新进度 │   │  • 更新进度 │                      │
│   │  • 完成Job │   │  • 完成Job │   │  • 完成Job │                      │
│   └─────────────┘   └─────────────┘   └─────────────┘                      │
│          │                 │                 │                              │
│          │                 │                 │                              │
│          ▼                 ▼                 ▼                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │  Bull Events:                                                        │   │
│   │                                                                      │   │
│   │  • job:completed → 回调处理                                          │   │
│   │  • job:failed → 重试或记录错误                                        │   │
│   │  • job:progress → 进度更新                                           │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│                        结果处理                                              │
│                        ═════════                                             │
│                                                                             │
│   job:completed 事件                                                         │
│          │                                                                  │
│          │  5. Worker 完成                                                   │
│          │                                                                  │
│          ▼                                                                  │
│   ResultHandler.onSuccess(traceId, result)                                 │
│          │                                                                  │
│          │  6. 持久化评估结果                                                │
│          │                                                                  │
│          ▼                                                                  │
│   TraceStorage.saveEvaluation(result)                                      │
│          │                                                                  │
│          │  7. WebSocket 推送                                               │
│          │                                                                  │
│          ▼                                                                  │
│   MetricsAggregator.broadcastUpdate(traceId, result)                       │
│          │                                                                  │
│          │  8. 前端收到评估分数更新                                          │
│          │                                                                  │
│                                                                             │
│                        Bull Board (监控)                                     │
│                        ════════════                                          │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │  /admin/queues                                                       │   │
│   │                                                                      │   │
│   │  • 队列状态: pending, active, completed, failed                      │   │
│   │  • Worker 状态: idle, busy                                           │   │
│   │  • 任务详情: traceId, 进度, 错误                                      │   │
│   │  • 重试任务                                                          │   │
│   │  • 清理队列                                                          │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Bull 核心概念

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Bull Queue 生命周期                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Job 状态流转                                                               │
│   ═════════════                                                             │
│                                                                             │
│   ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐            │
│   │  added   │───▶│  waiting │───▶│  active  │───▶│ completed │            │
│   │          │    │          │    │          │    │          │            │
│   │  刚添加   │    │  等待处理 │    │  正在处理 │    │  成功完成 │            │
│   └──────────┘    └──────────┘    └──────────┘    └──────────┘            │
│                         │               │                                   │
│                         │               │                                   │
│                         │               ▼                                   │
│                         │         ┌──────────┐    ┌──────────┐            │
│                         │         │  failed  │───▶│  delayed │            │
│                         │         │          │    │          │            │
│                         │         │  失败     │    │  等待重试 │            │
│                         │         └──────────┘    └──────────┘            │
│                         │               │               │                  │
│                         │               │               │                  │
│                         │               └───────────────│                  │
│                         │                               │                  │
│                         └───────────────────────────────│                  │
│                                                         │                  │
│                                                         ▼                  │
│                                                   ┌──────────┐            │
│                                                   │  waiting │            │
│                                                   │  (重试)  │            │
│                                                   └──────────┘            │
│                                                                             │
│   配置                                                                       │
│   ═════════════                                                             │
│                                                                             │
│   • attempts: 3         重试次数                                             │
│   • backoff: { type: 'exponential', delay: 1000 }  重试间隔递增              │
│   • removeOnComplete: true   完成后自动删除                                  │
│   • removeOnFail: 100        保留最近 100 个失败任务                          │
│                                                                             │
│   优先级                                                                     │
│   ═════════════                                                             │
│                                                                             │
│   Bull 使用 Redis 的有序集合实现优先级                                        │
│   priority: 1 (最高) → priority: 9 (最低)                                   │
│                                                                             │
│   const priorityMap = {                                                     │
│     high: 1,                                                                │
│     normal: 5,                                                              │
│     low: 9,                                                                 │
│   };                                                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 核心模块设计

### Requirement: EvaluationQueue
系统 SHALL 使用 Bull 管理评估任务队列。

#### Scenario: 创建队列
- **WHEN** 创建 EvaluationQueue
- **THEN** 连接 Redis
- **AND** 创建 'evaluation' 队列

#### Scenario: 添加任务
- **WHEN** 调用 addJob(traceData, priority)
- **THEN** 任务添加到 Bull 队列
- **AND** 立即返回 job.id
- **AND** 不阻塞主流程

#### Scenario: 任务配置
- **WHEN** 添加任务
- **THEN** 设置 attempts = 3
- **AND** 设置 backoff = exponential
- **AND** 设置 removeOnComplete = true

#### Scenario: 优先级支持
- **WHEN** 设置 priority
- **THEN** 使用 Bull 优先级机制
- **AND** high > normal > low

#### Scenario: 任务状态查询
- **WHEN** 调用 getJobStatus(jobId)
- **THEN** 返回任务状态
- **AND** pending | waiting | active | completed | failed

### Requirement: EvaluationWorker
系统 SHALL 使用 Bull Worker 处理评估任务。

#### Scenario: 创建 Worker
- **WHEN** 创建 EvaluationWorker
- **THEN** 注册 Bull Worker 处理函数
- **AND** 设置 concurrency (并发数)

#### Scenario: 处理任务
- **WHEN** Worker 收到任务
- **THEN** 执行 MedicalEvaluationPipeline.evaluate
- **AND** 返回评估结果

#### Scenario: 进度更新
- **WHEN** 评估进行中
- **THEN** 调用 job.updateProgress()
- **AND** 发送进度百分比

#### Scenario: 错误处理
- **WHEN** 评估失败
- **THEN** Bull 自动重试
- **AND** 达到 attempts 后标记 failed

#### Scenario: Worker 并发
- **WHEN** 设置 concurrency = 2
- **THEN** 每个 Worker 同时处理 2 个任务
- **AND** 可创建多个 Worker 进程

### Requirement: ResultHandler
系统 SHALL 处理 Bull 任务完成事件。

#### Scenario: 监听完成事件
- **WHEN** job:completed 事件触发
- **THEN** 获取 job.returnvalue
- **AND** 调用 onSuccess 处理

#### Scenario: 监听失败事件
- **WHEN** job:failed 事件触发
- **THEN** 获取 job.failedReason
- **AND** 调用 onError 处理

#### Scenario: 监听进度事件
- **WHEN** job:progress 事件触发
- **THEN** 推送进度到 WebSocket
- **AND** 前端可显示评估进度

### Requirement: Bull Board 集成
系统 SHALL 提供队列监控界面。

#### Scenario: 创建 Bull Board
- **WHEN** 配置 Bull Board
- **THEN** 创建 /admin/queues 路由
- **AND** 显示队列状态

#### Scenario: 查看任务详情
- **WHEN** 点击任务
- **THEN** 显示 traceId, data, progress, error
- **AND** 可重试/删除任务

---

## API

```typescript
// === 主进程: Queue ===

import Queue from 'bull';

class EvaluationQueue {
  private queue: Queue.Queue;
  
  constructor(redisConfig: RedisConfig);
  
  /**
   * 添加评估任务 (不阻塞)
   */
  addJob(
    traceData: TraceContextData,
    priority: 'high' | 'normal' | 'low' = 'normal',
    weights?: EvaluationWeights
  ): Promise<Queue.Job>;
  
  /**
   * 批量添加任务
   */
  addBatch(traces: TraceContextData[]): Promise<Queue.Job[]>;
  
  /**
   * 查询任务状态
   */
  getJobStatus(jobId: string): Promise<JobStatus>;
  
  /**
   * 获取队列统计
   */
  getQueueStats(): Promise<QueueStats>;
  
  /**
   * 注册事件处理器
   */
  onCompleted(handler: (job: Queue.Job, result: EvaluationResult) => void): void;
  onFailed(handler: (job: Queue.Job, error: Error) => void): void;
  onProgress(handler: (job: Queue.Job, progress: number) => void): void;
  
  /**
   * 清理队列
   */
  cleanCompleted(): Promise<void>;
  cleanFailed(): Promise<void>;
  
  /**
   * 关闭队列
   */
  close(): Promise<void>;
}

interface RedisConfig {
  host: string;           // 默认: localhost
  port: number;           // 默认: 6379
  password?: string;
  db?: number;            // 默认: 0
  maxRetriesPerRequest?: number;
}

interface JobStatus {
  jobId: string;
  traceId: string;
  state: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed';
  progress: number;       // 0-100
  attemptsMade: number;
  failedReason?: string;
  returnValue?: EvaluationResult;
  timestamp: number;
  processedOn?: number;
  finishedOn?: number;
}

interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

// === Worker 进程: Worker ===

import Worker from 'bull';

class EvaluationWorker {
  private worker: Queue.Worker;
  private pipeline: MedicalEvaluationPipeline;
  
  constructor(
    redisConfig: RedisConfig,
    concurrency: number = 2
  );
  
  /**
   * 处理任务
   */
  process(job: Queue.Job): Promise<EvaluationResult>;
  
  /**
   * 启动 Worker
   */
  start(): void;
  
  /**
   * 停止 Worker
   */
  stop(): Promise<void>;
}

// === Bull Board ===

import { createBullBoard } from '@bull-board/api';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import { ExpressAdapter } from '@bull-board/express';

function setupBullBoard(queue: Queue.Queue, app: Express.Application): void;
```

---

## 实现细节

### EvaluationQueue 实现

```typescript
// src/evaluation/EvaluationQueue.ts

import Queue, { Job } from 'bull';
import type { TraceContextData, EvaluationResult, EvaluationWeights } from './types.js';

const PRIORITY_MAP = {
  high: 1,
  normal: 5,
  low: 9,
};

export class EvaluationQueue {
  private queue: Queue.Queue<EvaluationJobData>;
  private resultHandler?: ResultHandler;
  
  constructor(redisConfig: RedisConfig) {
    this.queue = new Queue<EvaluationJobData>('evaluation', {
      redis: {
        host: redisConfig.host || 'localhost',
        port: redisConfig.port || 6379,
        password: redisConfig.password,
        db: redisConfig.db || 0,
      },
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: true,
        removeOnFail: 100,
      },
    });
    
    // 注册事件监听
    this.setupEventListeners();
  }
  
  /**
   * 添加评估任务 (不阻塞)
   */
  async addJob(
    traceData: TraceContextData,
    priority: 'high' | 'normal' | 'low' = 'normal',
    weights?: EvaluationWeights
  ): Promise<Job<EvaluationJobData>> {
    const job = await this.queue.add(
      {
        traceId: traceData.traceId,
        traceData,
        weights,
      },
      {
        priority: PRIORITY_MAP[priority],
        jobId: traceData.traceId,  // 使用 traceId 作为 jobId
      }
    );
    
    console.log(`[EvaluationQueue] Added job ${job.id} for trace ${traceData.traceId}`);
    
    return job;
  }
  
  /**
   * 批量添加
   */
  async addBatch(traces: TraceContextData[]): Promise<Job<EvaluationJobData>[]> {
    const jobs = traces.map(trace => ({
      data: {
        traceId: trace.traceId,
        traceData: trace,
      },
      opts: {
        jobId: trace.traceId,
      },
    }));
    
    return this.queue.addBulk(jobs);
  }
  
  /**
   * 查询任务状态
   */
  async getJobStatus(jobId: string): Promise<JobStatus> {
    const job = await this.queue.getJob(jobId);
    
    if (!job) {
      return {
        jobId,
        traceId: jobId,
        state: 'unknown',
        progress: 0,
        attemptsMade: 0,
        timestamp: 0,
      };
    }
    
    const state = await job.getState();
    
    return {
      jobId: job.id as string,
      traceId: job.data.traceId,
      state,
      progress: job.progress as number || 0,
      attemptsMade: job.attemptsMade,
      failedReason: job.failedReason,
      returnValue: job.returnvalue,
      timestamp: job.timestamp,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
    };
  }
  
  /**
   * 获取队列统计
   */
  async getQueueStats(): Promise<QueueStats> {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
      this.queue.getDelayedCount(),
    ]);
    
    const isPaused = await this.queue.isPaused();
    
    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      paused: isPaused,
    };
  }
  
  /**
   * 设置结果处理器
   */
  setResultHandler(handler: ResultHandler): void {
    this.resultHandler = handler;
  }
  
  /**
   * 设置事件监听
   */
  private setupEventListeners(): void {
    this.queue.on('completed', (job: Job, result: EvaluationResult) => {
      console.log(`[EvaluationQueue] Job ${job.id} completed`);
      if (this.resultHandler) {
        this.resultHandler.onSuccess(job.data.traceId, result);
      }
    });
    
    this.queue.on('failed', (job: Job, error: Error) => {
      console.error(`[EvaluationQueue] Job ${job.id} failed:`, error.message);
      if (this.resultHandler) {
        this.resultHandler.onError(job.data.traceId, error);
      }
    });
    
    this.queue.on('progress', (job: Job, progress: number) => {
      console.log(`[EvaluationQueue] Job ${job.id} progress: ${progress}%`);
      if (this.resultHandler) {
        this.resultHandler.onProgress(job.data.traceId, progress);
      }
    });
    
    this.queue.on('error', (error: Error) => {
      console.error('[EvaluationQueue] Queue error:', error);
    });
  }
  
  /**
   * 清理队列
   */
  async cleanCompleted(): Promise<void> {
    await this.queue.clean(0, 'completed');
  }
  
  async cleanFailed(): Promise<void> {
    await this.queue.clean(0, 'failed');
  }
  
  /**
   * 关闭队列
   */
  async close(): Promise<void> {
    await this.queue.close();
  }
}

interface EvaluationJobData {
  traceId: string;
  traceData: TraceContextData;
  weights?: EvaluationWeights;
}
```

### EvaluationWorker 实现

```typescript
// src/evaluation/EvaluationWorker.ts

import Worker, { Job } from 'bull';
import { MedicalEvaluationPipeline } from './MedicalEvaluationPipeline.js';
import { createLLMCaller } from '../config/llm-config.js';
import type { EvaluationJobData, EvaluationResult } from './types.js';

export class EvaluationWorker {
  private worker: Worker<EvaluationJobData, EvaluationResult>;
  private pipeline: MedicalEvaluationPipeline;
  
  constructor(
    redisConfig: RedisConfig,
    concurrency: number = 2
  ) {
    // 初始化评估管道
    this.pipeline = new MedicalEvaluationPipeline(
      createLLMCaller(),
      // ... 医学词典等
    );
    
    // 创建 Bull Worker
    this.worker = new Worker<EvaluationJobData, EvaluationResult>(
      'evaluation',
      this.processJob.bind(this),
      {
        redis: {
          host: redisConfig.host || 'localhost',
          port: redisConfig.port || 6379,
        },
        concurrency,  // 每个 Worker 同时处理的任务数
      }
    );
    
    this.setupWorkerListeners();
  }
  
  /**
   * 处理任务
   */
  private async processJob(job: Job<EvaluationJobData>): Promise<EvaluationResult> {
    console.log(`[EvaluationWorker] Processing job ${job.id} for trace ${job.data.traceId}`);
    
    const { traceData, weights } = job.data;
    
    // 设置权重 (如果提供)
    if (weights) {
      this.pipeline.setCustomWeights(weights);
    }
    
    // 更新进度: 开始
    await job.updateProgress(0);
    
    try {
      // Phase 1: 基础评估 (30%)
      await job.updateProgress(10);
      const faithfulness = await this.pipeline.evaluateFaithfulness(
        traceData.answer.text,
        traceData.retrieval.chunks.map(c => c.content)
      );
      await job.updateProgress(20);
      
      const contextRelevance = await this.pipeline.evaluateContextRelevance(
        traceData.query.raw,
        traceData.retrieval.chunks.map(c => c.content)
      );
      await job.updateProgress(30);
      
      // Phase 2: 医疗核心评估 (50%)
      await job.updateProgress(40);
      const medicalAccuracy = await this.pipeline.evaluateMedicalAccuracy(
        traceData.answer.text,
        traceData.query.entities!,
        traceData.retrieval.chunks.map(c => c.content)
      );
      await job.updateProgress(60);
      
      const safetyAssessment = await this.pipeline.evaluateSafetyAssessment(
        traceData.query.entities!,
        traceData.thresholds || []
      );
      await job.updateProgress(80);
      
      // Phase 3: 医疗增强评估 (20%)
      const evidenceTraceability = await this.pipeline.evaluateEvidenceTraceability(
        traceData.answer.text,
        traceData.retrieval.chunks
      );
      
      const completeness = await this.pipeline.evaluateCompleteness(
        traceData.query.raw,
        traceData.answer.text,
        traceData.query.entities!
      );
      
      const terminologyAccuracy = await this.pipeline.evaluateTerminologyAccuracy(
        traceData.answer.text,
        traceData.query.entities!
      );
      
      await job.updateProgress(100);
      
      // 计算综合分数
      const overallScore = this.pipeline.calculateOverallScore({
        faithfulness,
        contextRelevance,
        answerRelevance,
        medicalAccuracy,
        safetyAssessment,
        evidenceTraceability,
        completeness,
        terminologyAccuracy,
      });
      
      const layerScores = this.pipeline.calculateLayerScores({
        faithfulness,
        contextRelevance,
        answerRelevance,
        medicalAccuracy,
        safetyAssessment,
        evidenceTraceability,
        completeness,
        terminologyAccuracy,
      });
      
      const riskLevel = this.pipeline.determineRiskLevel({
        overallScore,
        layerScores,
        safetyAssessment,
        medicalAccuracy,
      });
      
      return {
        evaluationId: `eval-${job.data.traceId}`,
        traceId: job.data.traceId,
        timestamp: new Date().toISOString(),
        metrics: {
          faithfulness,
          contextRelevance,
          answerRelevance,
          medicalAccuracy,
          safetyAssessment,
          evidenceTraceability,
          completeness,
          terminologyAccuracy,
        },
        overallScore,
        layerScores,
        riskLevel,
        metadata: {
          weights: weights || this.pipeline.getWeights(),
          evaluatorModel: 'deepseek-reasoner',
          evaluationDurationMs: Date.now() - job.timestamp,
          retryCount: job.attemptsMade,
        },
      };
      
    } catch (error) {
      console.error(`[EvaluationWorker] Job ${job.id} error:`, error);
      throw error;  // Bull 会自动重试
    }
  }
  
  /**
   * 设置 Worker 监听器
   */
  private setupWorkerListeners(): void {
    this.worker.on('completed', (job: Job) => {
      console.log(`[EvaluationWorker] Job ${job.id} completed`);
    });
    
    this.worker.on('failed', (job: Job | undefined, error: Error) => {
      if (job) {
        console.error(`[EvaluationWorker] Job ${job.id} failed (attempt ${job.attemptsMade}):`, error);
      }
    });
    
    this.worker.on('error', (error: Error) => {
      console.error('[EvaluationWorker] Worker error:', error);
    });
    
    this.worker.on('stalled', (jobId: string) => {
      console.warn(`[EvaluationWorker] Job ${jobId} stalled`);
    });
  }
  
  /**
   * 停止 Worker
   */
  async stop(): Promise<void> {
    await this.worker.close();
  }
}

/**
 * 启动 Worker 进程 (独立进程)
 */
export async function startEvaluationWorkerProcess(): Promise<void> {
  const worker = new EvaluationWorker({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
  }, parseInt(process.env.EVALUATION_CONCURRENCY || '2'));
  
  console.log('[EvaluationWorker] Started with concurrency:', process.env.EVALUATION_CONCURRENCY || '2');
  
  // 保持进程运行
  process.on('SIGTERM', async () => {
    console.log('[EvaluationWorker] Shutting down...');
    await worker.stop();
    process.exit(0);
  });
  
  process.on('SIGINT', async () => {
    console.log('[EvaluationWorker] Shutting down...');
    await worker.stop();
    process.exit(0);
  });
}
```

### Bull Board 集成

```typescript
// src/server/bull-board.ts

import express from 'express';
import { createBullBoard } from '@bull-board/api';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import { ExpressAdapter } from '@bull-board/express';

export function setupBullBoard(
  app: express.Application,
  evaluationQueue: Queue.Queue
): void {
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues');
  
  createBullBoard({
    queues: [new BullAdapter(evaluationQueue)],
    serverAdapter,
  });
  
  app.use('/admin/queues', serverAdapter.getRouter());
  
  console.log('[BullBoard] Available at /admin/queues');
}
```

### 与 MedicalAgent 集成

```typescript
// src/medical/agent/MedicalAgent.ts

import { EvaluationQueue } from '../../evaluation/EvaluationQueue.js';
import { TraceStorage } from '../../tracing/TraceStorage.js';
import { MetricsAggregator } from '../../tracing/MetricsAggregator.js';

export class MedicalAgent {
  private evalQueue: EvaluationQueue;
  private storage: TraceStorage;
  private aggregator: MetricsAggregator;
  
  constructor(redisConfig: RedisConfig) {
    // 初始化存储和聚合器
    this.storage = new TraceStorage();
    this.aggregator = new MetricsAggregator(this.storage);
    
    // 创建评估队列
    this.evalQueue = new EvaluationQueue(redisConfig);
    
    // 设置结果处理器
    this.evalQueue.setResultHandler({
      onSuccess: async (traceId: string, result: EvaluationResult) => {
        await this.storage.saveEvaluation(result);
        this.aggregator.broadcastUpdate(traceId, result);
      },
      onError: (traceId: string, error: Error) => {
        console.error(`[MedicalAgent] Evaluation failed for ${traceId}:`, error);
      },
      onProgress: (traceId: string, progress: number) => {
        this.aggregator.broadcastProgress(traceId, progress);
      },
    });
  }
  
  /**
   * 执行查询
   */
  async execute(query: string): Promise<AgentResult> {
    // 1. 创建追踪上下文
    const traceContext = this.traceVisualizer.createTraceContext();
    
    // 2. 执行 Agent 主流程 (3-6秒)
    const result = await this.executeInternal(query, traceContext);
    
    // 3. 标记完成
    traceContext.complete();
    
    // 4. 构建追踪数据
    const traceData = traceContext.build();
    
    // 5. 持久化追踪 (主线程，<10ms)
    await this.storage.saveTrace(traceData);
    
    // 6. 异步提交评估到 Bull 队列 (不阻塞!)
    await this.evalQueue.addJob(traceData);
    
    // 7. 立即返回结果
    // 用户收到响应，评估在 Worker 进程中进行
    return {
      ...result,
      traceId: traceData.traceId,
      evaluationStatus: 'pending',
    };
  }
  
  /**
   * 获取评估状态
   */
  async getEvaluationStatus(traceId: string): Promise<JobStatus> {
    return this.evalQueue.getJobStatus(traceId);
  }
  
  /**
   * 获取队列统计
   */
  async getQueueStats(): Promise<QueueStats> {
    return this.evalQueue.getQueueStats();
  }
}
```

---

## Worker 进程启动脚本

```typescript
// src/workers/evaluation-worker.ts

import { startEvaluationWorkerProcess } from '../evaluation/EvaluationWorker.js';

startEvaluationWorkerProcess();

// 单独启动: node dist/workers/evaluation-worker.js
// 或者: npm run worker:evaluation
```

```json
// package.json

{
  "scripts": {
    "worker:evaluation": "node dist/workers/evaluation-worker.js",
    "workers:all": "concurrently \"npm run worker:evaluation\" \"npm run worker:other\"",
  }
}
```

---

## Docker Compose 配置

```yaml
# docker-compose.yml

version: '3.8'

services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes
    
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - REDIS_HOST=redis
      - REDIS_PORT=6379
    depends_on:
      - redis
      - qdrant
    
  evaluation-worker:
    build: .
    command: npm run worker:evaluation
    environment:
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - EVALUATION_CONCURRENCY=2
    depends_on:
      - redis
      - qdrant
    deploy:
      replicas: 2  # 可以启动多个 Worker 进程
      
volumes:
  redis_data:
```

---

## 环境变量配置

```bash
# .env

# Redis 配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# Worker 配置
EVALUATION_CONCURRENCY=2
EVALUATION_ATTEMPTS=3
EVALUATION_BACKOFF_DELAY=1000
```

---

## 测试策略

```typescript
// src/evaluation/EvaluationQueue.test.ts

import { EvaluationQueue } from './EvaluationQueue.js';

describe('EvaluationQueue', () => {
  let queue: EvaluationQueue;
  
  beforeAll(() => {
    queue = new EvaluationQueue({
      host: 'localhost',
      port: 6379,
    });
  });
  
  afterAll(async () => {
    await queue.cleanCompleted();
    await queue.close();
  });
  
  it('should add job without blocking', async () => {
    const startTime = Date.now();
    const job = await queue.addJob(mockTraceData);
    const addTime = Date.now() - startTime;
    
    expect(addTime).toBeLessThan(50);
    expect(job.id).toBeDefined();
  });
  
  it('should respect priority', async () => {
    await queue.addJob(mockTraceData, 'low');
    await queue.addJob(mockTraceData, 'high');
    
    const stats = await queue.getQueueStats();
    expect(stats.waiting).toBeGreaterThanOrEqual(2);
  });
  
  it('should retry on failure', async () => {
    const job = await queue.addJob({
      ...mockTraceData,
      answer: { text: '' },  // 触发错误
    });
    
    // 等待失败
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const status = await queue.getJobStatus(job.id as string);
    expect(status.attemptsMade).toBeGreaterThan(0);
  });
});

describe('EvaluationWorker', () => {
  it('should process job successfully', async () => {
    const worker = new EvaluationWorker(redisConfig, 1);
    
    // 添加任务
    const job = await queue.addJob(mockTraceData);
    
    // 等待完成
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    const status = await queue.getJobStatus(job.id as string);
    expect(status.state).toBe('completed');
    expect(status.returnValue).toBeDefined();
    
    await worker.stop();
  });
});
```

---

## Testing Criteria

- 添加任务不阻塞测试 (< 50ms)
- 优先级队列测试
- 重试机制测试 (attempts = 3)
- Worker 处理测试
- 进度更新测试
- 事件监听测试 (completed/failed/progress)
- Bull Board 可访问测试
- 多 Worker 分布式测试
- Redis 连接恢复测试
- 队列清理测试
- Agent 集成测试 (不阻塞主流程)