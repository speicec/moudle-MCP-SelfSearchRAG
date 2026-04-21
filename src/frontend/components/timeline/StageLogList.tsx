import React, { useEffect, useRef } from 'react';
import type { LogEntry } from '../../store/timelineStore';

/**
 * StageLogList - displays log entries for a specific stage
 */
const StageLogList: React.FC<{
  logs: LogEntry[];
}> = ({ logs }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to newest log
  useEffect(() => {
    if (scrollRef.current && logs.length > 0) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs.length]);

  if (logs.length === 0) {
    return (
      <div className="text-xs text-muted-foreground text-center py-2">
        No logs for this stage
      </div>
    );
  }

  const typeStyles = {
    info: 'text-muted-foreground',
    warn: 'text-confidence-medium',
    error: 'text-destructive',
  };

  return (
    <div
      ref={scrollRef}
      className="max-h-48 overflow-y-auto space-y-1 text-xs"
    >
      {logs.map((log, index) => (
        <div key={index} className={`flex gap-2 ${typeStyles[log.type]}`}>
          <span className="font-mono text-muted-foreground shrink-0">
            {new Date(log.timestamp).toLocaleTimeString()}
          </span>
          <span className="truncate">{log.message}</span>
        </div>
      ))}
    </div>
  );
};

export default StageLogList;