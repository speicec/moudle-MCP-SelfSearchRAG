/**
 * EvaluationWorker - 评估任务 Worker
 *
 * 处理队列中的评估任务
 */

import Queue, { Job } from 'bull';
import { MedicalEvaluationPipeline, createMedicalEvaluationPipeline } from '../evaluation/MedicalEvaluationPipeline.js';
import { createTraceStorage, TraceStorage } from '../tracing/TraceStorage.js';
import { createLLMCaller } from '../config/llm-config.js';
import {
  RedisConfig,
  QueueConfig,
  DEFAULT_REDIS_CONFIG,
  DEFAULT_QUEUE_CONFIG,
} from '../config/redis-config.js';
import type { EvaluationJobData, EvaluationJobResult } from './EvaluationQueue.js';
import type { ExtendedEvaluationResult } from '../evaluation/types.js';

/**
 * Worker 配置
 */
export interface WorkerConfig {
  concurrency: number;
  lockDuration: number;
  stalledInterval: number;
}

/**
 * 默认 Worker 配置
 */
export const DEFAULT_WORKER_CONFIG: WorkerConfig = {
  concurrency: parseInt(process.env.EVALUATION_CONCURRENCY ?? '2', 10),
  lockDuration: 60000, // 任务锁定时间 60 秒
  stalledInterval: 30000, // 检查停滞任务间隔 30 秒
};

/**
 * EvaluationWorker - 评估任务处理 Worker
 */
export class EvaluationWorker {
  private queue: ReturnType<typeof Queue<EvaluationJobData>> | null = null;
  private pipeline: MedicalEvaluationPipeline;
  private storage: TraceStorage;
  private redisConfig: RedisConfig;
  private queueConfig: QueueConfig;
  private workerConfig: WorkerConfig;
  private running: boolean = false;

  constructor(
    redisConfig?: Partial<RedisConfig>,
    queueConfig?: Partial<QueueConfig>,
    workerConfig?: Partial<WorkerConfig>
  ) {
    this.redisConfig = { ...DEFAULT_REDIS_CONFIG, ...redisConfig };
    this.queueConfig = { ...DEFAULT_QUEUE_CONFIG, ...queueConfig };
    this.workerConfig = { ...DEFAULT_WORKER_CONFIG, ...workerConfig };

    // 创建 LLM Caller
    const apiKey = process.env.DEEPSEEK_API_KEY;
    const llmCaller = createLLMCaller({
      provider: 'openai',
      model: process.env.DEEPSEEK_MODEL ?? 'deepseek-reasoner',
      baseUrl: process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com',
      ...(apiKey && { apiKey }),
    });

    // 创建评估流水线
    this.pipeline = createMedicalEvaluationPipeline(llmCaller);

    // 创建存储
    this.storage = new TraceStorage(process.env.TRACE_DB_PATH ?? './data/traces.db');
  }

  /**
   * 启动 Worker
   */
  async start(): Promise<void> {
    if (this.running) return;

    // 初始化存储
    await this.storage.init();

    // 创建 Bull Queue 并设置处理函数
    this.queue = new Queue<EvaluationJobData>(
      this.queueConfig.queueName,
      {
        redis: {
          host: this.redisConfig.host,
          port: this.redisConfig.port,
          password: this.redisConfig.password,
          db: this.redisConfig.db ?? 0,
        },
      }
    );

    // 设置处理函数
    this.queue.process(this.workerConfig.concurrency, this.processJob.bind(this));

    // 设置事件监听
    this.setupEventListeners();

    this.running = true;
    console.log(`[EvaluationWorker] Started with concurrency: ${this.workerConfig.concurrency}`);
  }

  /**
   * 处理任务
   */
  private async processJob(job: Job<EvaluationJobData>): Promise<EvaluationJobResult> {
    const { traceId, traceData } = job.data;
    const startTime = Date.now();

    try {
      // 更新进度: 开始
      job.progress(10);

      // 执行评估
      const evaluation = await this.pipeline.evaluate(traceData);

      // 更新进度: 评估完成
      job.progress(80);

      // 持久化评估结果
      await this.storage.saveEvaluation(evaluation as unknown as import('../tracing/types.js').EvaluationResult);

      // 更新进度: 存储
      job.progress(100);

      const durationMs = Date.now() - startTime;

      console.log(`[EvaluationWorker] Job ${job.id} completed in ${durationMs}ms`);

      return {
        evaluationId: evaluation.evaluationId,
        traceId,
        overallScore: evaluation.overallScore,
        riskLevel: evaluation.riskLevel,
        durationMs,
        success: true,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      console.error(`[EvaluationWorker] Job ${job.id} failed:`, errorMessage);

      // 返回失败结果
      return {
        evaluationId: '',
        traceId,
        overallScore: 0,
        riskLevel: 'danger',
        durationMs,
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * 设置事件监听
   */
  private setupEventListeners(): void {
    if (!this.queue) return;

    this.queue.on('completed', (job: Job<EvaluationJobData>, result: EvaluationJobResult) => {
      console.log(`[EvaluationWorker] Job ${job.id} completed with score: ${result.overallScore}`);
    });

    this.queue.on('failed', (job: Job<EvaluationJobData> | undefined, error: Error) => {
      if (job) {
        console.error(`[EvaluationWorker] Job ${job.id} failed:`, error.message);
      } else {
        console.error('[EvaluationWorker] Unknown job failed:', error.message);
      }
    });

    this.queue.on('error', (error: Error) => {
      console.error('[EvaluationWorker] Worker error:', error.message);
    });

    this.queue.on('stalled', (jobId: string) => {
      console.warn(`[EvaluationWorker] Job ${jobId} stalled`);
    });
  }

  /**
   * 停止 Worker
   */
  async stop(): Promise<void> {
    if (!this.running || !this.queue) return;

    await this.queue.close();
    this.storage.close();
    this.running = false;

    console.log('[EvaluationWorker] Stopped');
  }

  /**
   * 检查 Worker 是否运行
   */
  isRunning(): boolean {
    return this.running;
  }
}

/**
 * 创建 EvaluationWorker
 */
export function createEvaluationWorker(
  redisConfig?: Partial<RedisConfig>,
  queueConfig?: Partial<QueueConfig>,
  workerConfig?: Partial<WorkerConfig>
): EvaluationWorker {
  return new EvaluationWorker(redisConfig, queueConfig, workerConfig);
}