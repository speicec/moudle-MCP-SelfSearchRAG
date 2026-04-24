/**
 * Redis Configuration - Redis 连接配置
 *
 * 用于 Bull 队列和评估任务的异步处理
 */

/**
 * Redis 配置接口
 */
export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  maxRetriesPerRequest?: number;
  retryDelayOnFailover?: number;
  enableReadyCheck?: boolean;
  lazyConnect?: boolean;
  tls?: {
    host?: string;
    port?: number;
  };
}

/**
 * 默认 Redis 配置
 */
export const DEFAULT_REDIS_CONFIG: RedisConfig = {
  host: process.env.REDIS_HOST ?? 'localhost',
  port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  ...(process.env.REDIS_PASSWORD && { password: process.env.REDIS_PASSWORD }),
  db: parseInt(process.env.REDIS_DB ?? '0', 10),
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
  lazyConnect: true,
};

/**
 * 队列配置
 */
export interface QueueConfig {
  queueName: string;
  concurrency: number;
  limiter?: {
    max: number;
    duration: number;
  };
}

/**
 * 默认评估队列配置
 */
export const DEFAULT_QUEUE_CONFIG: QueueConfig = {
  queueName: 'evaluation-queue',
  concurrency: parseInt(process.env.EVALUATION_CONCURRENCY ?? '2', 10),
  limiter: {
    max: 10, // 每分钟最多 10 个任务
    duration: 60000, // 60 秒
  },
};

/**
 * Job 配置选项
 */
export interface JobOptions {
  attempts: number;
  backoff: {
    type: 'fixed' | 'exponential';
    delay: number;
  };
  removeOnComplete: boolean | number;
  removeOnFail: boolean | number;
  priority?: number;
  delay?: number;
}

/**
 * 默认 Job 配置
 */
export const DEFAULT_JOB_OPTIONS: JobOptions = {
  attempts: parseInt(process.env.EVALUATION_ATTEMPTS ?? '3', 10),
  backoff: {
    type: 'exponential',
    delay: 1000,
  },
  removeOnComplete: 100, // 保留最近 100 个完成的任务
  removeOnFail: 50, // 保留最近 50 个失败的任务
};

/**
 * Job 优先级
 */
export type JobPriority = 'high' | 'normal' | 'low';

/**
 * 优先级数值映射
 */
export const PRIORITY_VALUES: Record<JobPriority, number> = {
  high: 1,
  normal: 5,
  low: 10,
};

/**
 * 获取 Redis 连接字符串
 */
export function getRedisConnectionString(config: RedisConfig = DEFAULT_REDIS_CONFIG): string {
  const auth = config.password ? `:${config.password}@` : '';
  return `redis://${auth}${config.host}:${config.port}/${config.db ?? 0}`;
}

/**
 * 检查 Redis 是否可用
 */
export function isRedisAvailable(): boolean {
  return Boolean(process.env.REDIS_HOST);
}

/**
 * 创建 Redis 配置（从环境变量）
 */
export function createRedisConfig(overrides?: Partial<RedisConfig>): RedisConfig {
  return {
    ...DEFAULT_REDIS_CONFIG,
    ...overrides,
  };
}

/**
 * 创建队列配置（从环境变量）
 */
export function createQueueConfig(overrides?: Partial<QueueConfig>): QueueConfig {
  return {
    ...DEFAULT_QUEUE_CONFIG,
    ...overrides,
  };
}

/**
 * 创建 Job 配置
 */
export function createJobOptions(priority?: JobPriority): JobOptions {
  const options = { ...DEFAULT_JOB_OPTIONS };
  if (priority) {
    options.priority = PRIORITY_VALUES[priority];
  }
  return options;
}