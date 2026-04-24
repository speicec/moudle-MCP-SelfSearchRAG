/**
 * Bull Board - 队列监控界面
 *
 * 提供 Bull 队列的 Web 监控界面
 */

import { createBullBoard } from '@bull-board/api';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import { ExpressAdapter } from '@bull-board/express';
import express from 'express';

/**
 * BullBoard 配置
 */
export interface BullBoardConfig {
  basePath: string;
  title?: string;
}

/**
 * 默认配置
 */
export const DEFAULT_BULL_BOARD_CONFIG: BullBoardConfig = {
  basePath: '/admin/queues',
  title: 'Evaluation Queue Dashboard',
};

/**
 * 创建 Bull Board 服务器适配器
 */
export function createBullBoardServer(
  queues: unknown[], // Bull Queue instances
  config: Partial<BullBoardConfig> = {}
): ExpressAdapter {
  const mergedConfig = { ...DEFAULT_BULL_BOARD_CONFIG, ...config };

  // 创建 Express 适配器
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath(mergedConfig.basePath);

  // 创建 Bull Board
  createBullBoard({
    queues: queues.map(q => new BullAdapter(q as never)),
    serverAdapter,
  });

  return serverAdapter;
}

/**
 * 设置 Bull Board 路由到 Express 应用
 */
export function setupBullBoardRoutes(
  app: express.Application,
  serverAdapter: ExpressAdapter,
  config: Partial<BullBoardConfig> = {}
): void {
  const basePath = config.basePath ?? DEFAULT_BULL_BOARD_CONFIG.basePath;

  // 添加 Bull Board 路由
  app.use(basePath, serverAdapter.getRouter());

  console.log(`[BullBoard] Dashboard available at ${basePath}`);
}

/**
 * 创建 Bull Board 路由处理器
 */
export function createBullBoardHandler(
  queues: unknown[],
  config?: Partial<BullBoardConfig>
): express.Router {
  const serverAdapter = createBullBoardServer(queues, config);
  return serverAdapter.getRouter();
}