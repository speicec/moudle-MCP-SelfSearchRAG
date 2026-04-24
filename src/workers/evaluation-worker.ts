/**
 * Evaluation Worker Process - 独立评估 Worker 进程
 *
 * 用于 Docker 部署的独立 Worker 进程
 */

import { createEvaluationWorker, EvaluationWorker } from '../queue/EvaluationWorker.js';

/**
 * Worker 实例
 */
let worker: EvaluationWorker;

/**
 * 启动 Worker 进程
 */
async function startWorkerProcess(): Promise<void> {
  console.log('[Worker] Starting Evaluation Worker Process...');
  console.log('[Worker] Redis Host:', process.env.REDIS_HOST ?? 'localhost');
  console.log('[Worker] Redis Port:', process.env.REDIS_PORT ?? '6379');
  console.log('[Worker] Concurrency:', process.env.EVALUATION_CONCURRENCY ?? '2');

  // 创建 Worker
  worker = createEvaluationWorker();

  // 启动 Worker
  await worker.start();

  console.log('[Worker] Evaluation Worker Process started successfully');
}

/**
 * 停止 Worker 进程
 */
async function stopWorkerProcess(): Promise<void> {
  console.log('[Worker] Stopping Evaluation Worker Process...');

  if (worker) {
    await worker.stop();
  }

  console.log('[Worker] Evaluation Worker Process stopped');
}

/**
 * 处理进程信号
 */
function setupSignalHandlers(): void {
  process.on('SIGTERM', async () => {
    console.log('[Worker] Received SIGTERM signal');
    await stopWorkerProcess();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('[Worker] Received SIGINT signal');
    await stopWorkerProcess();
    process.exit(0);
  });

  process.on('uncaughtException', (error: Error) => {
    console.error('[Worker] Uncaught exception:', error);
    stopWorkerProcess().then(() => process.exit(1));
  });

  process.on('unhandledRejection', (reason: unknown) => {
    console.error('[Worker] Unhandled rejection:', reason);
    stopWorkerProcess().then(() => process.exit(1));
  });
}

/**
 * 主函数
 */
async function main(): Promise<void> {
  setupSignalHandlers();
  await startWorkerProcess();
}

// 启动
main().catch((error) => {
  console.error('[Worker] Failed to start:', error);
  process.exit(1);
});