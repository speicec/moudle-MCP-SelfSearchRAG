import React from 'react';
import { useConnectionStore } from '../../store';

/**
 * Connection status indicator - displays WebSocket connection state
 */
const ConnectionIndicator: React.FC = () => {
  const { status } = useConnectionStore();

  return (
    <div className="flex items-center gap-2">
      <span
        className={`w-2 h-2 rounded-full ${
          status === 'connected'
            ? 'bg-confidence-high'
            : status === 'reconnecting'
            ? 'bg-confidence-medium animate-pulse'
            : 'bg-confidence-low'
        }`}
      />
      <span className="text-sm text-muted-foreground">
        {status === 'connected'
          ? '已连接'
          : status === 'reconnecting'
          ? '重连中...'
          : '已断开'}
      </span>
    </div>
  );
};

export default ConnectionIndicator;