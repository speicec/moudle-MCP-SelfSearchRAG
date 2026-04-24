/**
 * WebSocketBroadcaster - 告警 WebSocket 广播器
 *
 * 将告警事件通过 WebSocket 推送到前端 Dashboard
 */

import type { WebSocketHandler } from '../server/websocket-handler.js';
import type { AlertEvent } from './types.js';

/**
 * Alert broadcast event for WebSocket
 */
export interface AlertBroadcastEvent {
  type: 'alert:new' | 'alert:update' | 'alert:resolved';
  alert: AlertEvent;
  timestamp: number;
}

/**
 * WebSocketBroadcaster - WebSocket 告警广播器
 *
 * 功能：
 * - 将告警事件通过 WebSocketHandler 推送给所有连接的客户端
 * - 支持 alert:new、alert:update、alert:resolved 事件类型
 * - 与 AlertHandler 集成
 */
export class WebSocketBroadcaster {
  private wsHandler: WebSocketHandler;

  constructor(wsHandler: WebSocketHandler) {
    this.wsHandler = wsHandler;
  }

  /**
   * 广播告警事件
   *
   * @param event - 告警事件
   */
  broadcast(event: { type: string; alert: AlertEvent }): void {
    const wsEvent: AlertBroadcastEvent = {
      type: event.type as 'alert:new' | 'alert:update' | 'alert:resolved',
      alert: event.alert,
      timestamp: Date.now(),
    };

    this.wsHandler.broadcast(wsEvent as unknown as import('../server/types.js').PipelineEvent);

    console.log(`[WebSocketBroadcaster] Broadcasted ${event.type} alert: ${event.alert.alertId}`);
  }

  /**
   * 广播新告警
   */
  broadcastNew(alert: AlertEvent): void {
    this.broadcast({ type: 'alert:new', alert });
  }

  /**
   * 广播告警更新
   */
  broadcastUpdate(alert: AlertEvent): void {
    this.broadcast({ type: 'alert:update', alert });
  }

  /**
   * 广播告警解决
   */
  broadcastResolved(alert: AlertEvent): void {
    this.broadcast({ type: 'alert:resolved', alert });
  }

  /**
   * 获取连接的客户端数量
   */
  getClientCount(): number {
    return this.wsHandler.getClientCount();
  }
}

/**
 * 创建 WebSocket 广播器
 */
export function createWebSocketBroadcaster(wsHandler: WebSocketHandler): WebSocketBroadcaster {
  return new WebSocketBroadcaster(wsHandler);
}