/**
 * EvaluationQueue - 评估任务队列
 *
 * 使用 Bull 队列处理异步评估任务
 */

import Queue, { Job } from 'bull';
import type { JobOptions as BullJobOptions } from 'bull';
import type { TraceContextData } from '../tracing/types.js';
import {
  RedisConfig,
  QueueConfig,
  JobOptions,
  JobPriority,
  DEFAULT_REDIS_CONFIG,
  DEFAULT_QUEUE_CONFIG,
  DEFAULT_JOB_OPTIONS,
  PRIORITY_VALUES,
  createRedisConfig,
  createQueueConfig,
} from '../config/redis-config.js';

/**
 * 评估任务数据
 */
export interface EvaluationJobData {
  traceId: string;
  traceData: TraceContextData;
  priority: JobPriority;
  timestamp: number;
  sessionId?: string;
}

/**
 * 评估任务结果
 */
export interface EvaluationJobResult {
  evaluationId: string;
  traceId: string;
  overallScore: number;
  riskLevel: string;
  durationMs: number;
  success: boolean;
  error?: string;
}

/**
 * 队列统计信息
 */
export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  total: number;
}

/**
 * EvaluationQueue - 评估队列管理类
 */
export class EvaluationQueue {
  private queue: ReturnType<typeof Queue<EvaluationJobData>>;
  private redisConfig: RedisConfig;
  private queueConfig: QueueConfig;
  private jobOptions: JobOptions;
  private resultHandlers: Map<string, {
    onSuccess?: (result: EvaluationJobResult) => void;
    onError?: (error: Error) => void;
    onProgress?: (progress: number) => void;
  }> = new Map();

  constructor(redisConfig?: Partial<RedisConfig>, queueConfig?: Partial<QueueConfig>) {
    this.redisConfig = createRedisConfig(redisConfig);
    this.queueConfig = createQueueConfig(queueConfig);
    this.jobOptions = DEFAULT_JOB_OPTIONS;

    // 创建 Bull 队列
    this.queue = new Queue<EvaluationJobData>(this.queueConfig.queueName, {
      redis: {
        host: this.redisConfig.host,
        port: this.redisConfig.port,
        password: this.redisConfig.password,
        db: this.redisConfig.db ?? 0,
      },
      defaultJobOptions: {
        attempts: this.jobOptions.attempts,
        backoff: this.jobOptions.backoff,
        removeOnComplete: this.jobOptions.removeOnComplete,
        removeOnFail: this.jobOptions.removeOnFail,
      },
      limiter: this.queueConfig.limiter,
    });

    // 设置事件监听
    this.setupEventListeners();
  }

  /**
   * 设置事件监听
   * 使用 global:* 事件来监听跨进程的通知（Worker 在独立进程中运行）
   */
  private setupEventListeners(): void {
    // 使用 global:completed 监听其他进程（Worker）完成的任务
    // Bull global:completed 只传递 jobId，需要从 job 获取 returnvalue
    this.queue.on('global:completed', async (jobId: string) => {
      try {
        const job = await this.queue.getJob(jobId);
        if (!job) {
          console.warn(`[EvaluationQueue] Job ${jobId} not found for global:completed`);
          return;
        }

        const result = job.returnvalue as EvaluationJobResult | undefined;
        const handlers = this.resultHandlers.get(jobId);
        if (handlers?.onSuccess && result) {
          handlers.onSuccess(result);
        }
        this.resultHandlers.delete(jobId);
      } catch (err) {
        console.error(`[EvaluationQueue] Error processing global:completed for job ${jobId}:`, err);
      }
    });

    // 使用 global:failed 监听其他进程失败的任务
    this.queue.on('global:failed', async (jobId: string, failedReason: string) => {
      const handlers = this.resultHandlers.get(jobId);
      if (handlers?.onError) {
        handlers.onError(new Error(failedReason));
      }
    });

    // 本地 progress 事件（在同一进程内有效）
    this.queue.on('progress', (job: Job<EvaluationJobData>, progress: number) => {
      const handlers = this.resultHandlers.get(String(job.id));
      if (handlers?.onProgress) {
        handlers.onProgress(progress);
      }
    });
  }

  /**
   * 添加评估任务（不阻塞）
   */
  async addJob(
    traceData: TraceContextData,
    priority: JobPriority = 'normal',
    handlers?: {
      onSuccess?: (result: EvaluationJobResult) => void;
      onError?: (error: Error) => void;
      onProgress?: (progress: number) => void;
    }
  ): Promise<Job<EvaluationJobData>> {
    const jobData: EvaluationJobData = {
      traceId: traceData.traceId,
      traceData,
      priority,
      timestamp: Date.now(),
      ...(traceData.sessionId && { sessionId: traceData.sessionId }),
    };

    const bullOptions: BullJobOptions = {
      priority: PRIORITY_VALUES[priority],
      attempts: this.jobOptions.attempts,
      backoff: this.jobOptions.backoff,
      removeOnComplete: this.jobOptions.removeOnComplete,
      removeOnFail: this.jobOptions.removeOnFail,
    };

    const job = await this.queue.add(jobData, bullOptions);

    // 注册结果处理器
    if (handlers) {
      this.resultHandlers.set(String(job.id), handlers);
    }

    return job;
  }

  /**
   * 批量添加任务
   */
  async addBatch(
    traces: Array<{ traceData: TraceContextData; priority?: JobPriority }>
  ): Promise<Job<EvaluationJobData>[]> {
    const jobs = await Promise.all(
      traces.map(({ traceData, priority }) =>
        this.addJob(traceData, priority ?? 'normal')
      )
    );
    return jobs;
  }

  /**
   * 获取任务状态
   */
  async getJobStatus(jobId: string): Promise<string | null> {
    const job = await this.queue.getJob(jobId);
    if (!job) return null;

    // 返回 Bull 的状态字符串
    const state = await job.getState();
    return String(state);
  }

  /**
   * 获取队列统计信息
   */
  async getQueueStats(): Promise<QueueStats> {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
      this.queue.getDelayedCount(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      total: waiting + active + completed + failed + delayed,
    };
  }

  /**
   * 获取任务详情
   */
  async getJobDetails(jobId: string): Promise<{
    id: string;
    data: EvaluationJobData;
    state: string;
    progress: number;
    returnvalue?: EvaluationJobResult;
    failedReason?: string;
  } | null> {
    const job = await this.queue.getJob(jobId);
    if (!job) return null;

    const state = await job.getState();

    return {
      id: String(job.id),
      data: job.data,
      state: state as string,
      progress: job.progress() ?? 0,
      ...(job.returnvalue && { returnvalue: job.returnvalue as EvaluationJobResult }),
      ...(job.failedReason && { failedReason: job.failedReason }),
    };
  }

  /**
   * 重试失败任务
   */
  async retryJob(jobId: string): Promise<boolean> {
    const job = await this.queue.getJob(jobId);
    if (!job) return false;

    try {
      await job.retry();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 移除任务
   */
  async removeJob(jobId: string): Promise<boolean> {
    const job = await this.queue.getJob(jobId);
    if (!job) return false;

    try {
      await job.remove();
      this.resultHandlers.delete(jobId);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 清空队列
   */
  async empty(): Promise<void> {
    await this.queue.empty();
    this.resultHandlers.clear();
  }

  /**
   * 关闭队列
   */
  async close(): Promise<void> {
    await this.queue.close();
    this.resultHandlers.clear();
  }

  /**
   * 获取队列名称
   */
  getQueueName(): string {
    return this.queueConfig.queueName;
  }

  /**
   * 获取 Bull 队列实例（用于 Bull Board）
   */
  getBullQueue(): ReturnType<typeof Queue<EvaluationJobData>> {
    return this.queue;
  }
}

/**
 * 创建 EvaluationQueue
 */
export function createEvaluationQueue(
  redisConfig?: Partial<RedisConfig>,
  queueConfig?: Partial<QueueConfig>
): EvaluationQueue {
  return new EvaluationQueue(redisConfig, queueConfig);
}