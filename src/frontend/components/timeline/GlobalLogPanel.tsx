import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '../ui/collapsible';
import { ScrollArea } from '../ui/scroll-area';
import type { LogEntry } from '../../store/timelineStore';

/**
 * GlobalLogPanel - displays global pipeline log stream
 */
const GlobalLogPanel: React.FC<{
  logs: LogEntry[];
}> = ({ logs }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to newest log when expanded
  useEffect(() => {
    if (isExpanded && scrollRef.current && logs.length > 0) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs.length, isExpanded]);

  const typeStyles = {
    info: 'text-muted-foreground',
    warn: 'text-confidence-medium',
    error: 'text-destructive',
  };

  const typeIcons = {
    info: '●',
    warn: '⚠',
    error: '✕',
  };

  // Show only recent logs (last 20)
  const recentLogs = logs.slice(-20);

  return (
    <Card>
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CardHeader className="pb-2">
          <CollapsibleTrigger className="flex items-center justify-between w-full cursor-pointer">
            <div className="flex items-center gap-2">
              {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
              <CardTitle className="text-sm">Pipeline Log</CardTitle>
            </div>
            <span className="text-xs text-muted-foreground">
              {logs.length} entries
            </span>
          </CollapsibleTrigger>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-0">
            <ScrollArea className="h-32">
              <div ref={scrollRef} className="space-y-1 text-xs">
                {recentLogs.length === 0 ? (
                  <div className="text-muted-foreground text-center">
                    No logs yet
                  </div>
                ) : (
                  recentLogs.map((log, index) => (
                    <div key={index} className={`flex gap-2 ${typeStyles[log.type]}`}>
                      <span className="shrink-0">
                        {typeIcons[log.type]}
                      </span>
                      <span className="font-mono text-muted-foreground shrink-0">
                        [{new Date(log.timestamp).toLocaleTimeString()}]
                      </span>
                      {log.stage && (
                        <Badge variant="outline" className="shrink-0 text-xs px-1">
                          {log.stage}
                        </Badge>
                      )}
                      <span className="truncate">{log.message}</span>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};

import { Badge } from '../ui/badge';

export default GlobalLogPanel;