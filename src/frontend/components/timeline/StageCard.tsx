import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Check, Loader2, AlertCircle, Clock, ChevronDown, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '../ui/collapsible';
import StageLogList from './StageLogList';
import type { TimelineStage, StageMetrics, LogEntry } from '../../store/timelineStore';

const stageLabels: Record<string, string> = {
  ingest: 'Ingest',
  parse: 'Parse',
  chunk: 'Chunk',
  embed: 'Embed',
  index: 'Index',
};

const stageDescriptions: Record<string, string> = {
  ingest: 'Reading document content',
  parse: 'Extracting text and structure',
  chunk: 'Creating content chunks',
  embed: 'Generating embeddings',
  index: 'Building search index',
};

// Stage-specific colors (used for card border/theme)
const stageThemeColors: Record<string, string> = {
  ingest: 'border-amber-500',
  parse: 'border-violet-500',
  chunk: 'border-cyan-500',
  embed: 'border-primary',
  index: 'border-confidence-high',
};

/**
 * Format metrics for display
 */
function formatMetrics(metrics: StageMetrics | undefined): React.ReactNode {
  if (!metrics) return null;

  const items: Array<{ label: string; value: string }> = [];

  if (metrics.fileSizeBytes) {
    items.push({ label: 'File Size', value: `${(metrics.fileSizeBytes / 1024).toFixed(1)} KB` });
  }
  if (metrics.pagesExtracted) {
    items.push({ label: 'Pages', value: String(metrics.pagesExtracted) });
  }
  if (metrics.tokensExtracted) {
    items.push({ label: 'Tokens', value: String(metrics.tokensExtracted) });
  }
  if (metrics.chunksCreated) {
    items.push({ label: 'Chunks', value: String(metrics.chunksCreated) });
  }
  if (metrics.embeddingDimension) {
    items.push({ label: 'Dim', value: String(metrics.embeddingDimension) });
  }
  if (metrics.processingTimeMs) {
    items.push({ label: 'Time', value: `${metrics.processingTimeMs}ms` });
  }
  if (metrics.throughput) {
    items.push({ label: 'Speed', value: `${metrics.throughput.toFixed(1)}/s` });
  }

  if (items.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-2 text-xs">
      {items.map((item, index) => (
        <div key={index} className="flex flex-col">
          <span className="text-muted-foreground">{item.label}</span>
          <span className="font-medium text-foreground">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * StatusIndicator - displays status icon
 */
const StatusIndicator: React.FC<{
  status: TimelineStage['status'];
}> = ({ status }) => {
  if (status === 'completed') {
    return (
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className="w-6 h-6 rounded-full bg-confidence-high/20 flex items-center justify-center"
      >
        <Check className="w-4 h-4 text-confidence-high" />
      </motion.div>
    );
  }

  if (status === 'running') {
    return (
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        className="w-6 h-6 rounded-full bg-status-processing/20 flex items-center justify-center"
      >
        <Loader2 className="w-4 h-4 text-status-processing" />
      </motion.div>
    );
  }

  if (status === 'error') {
    return (
      <div className="w-6 h-6 rounded-full bg-destructive/20 flex items-center justify-center">
        <AlertCircle className="w-4 h-4 text-destructive" />
      </div>
    );
  }

  // pending
  return (
    <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
      <Clock className="w-4 h-4 text-muted-foreground" />
    </div>
  );
};

/**
 * StageCard - displays single pipeline stage with collapsible logs
 */
const StageCard: React.FC<{
  stage: TimelineStage;
  logs: LogEntry[];
  index: number;
}> = ({ stage, logs, index }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const isRunning = stage.status === 'running';
  const isCompleted = stage.status === 'completed';
  const isError = stage.status === 'error';

  // Auto-expand for running stages
  useEffect(() => {
    if (isRunning) {
      setIsExpanded(true);
    }
  }, [isRunning]);

  const borderColor = stageThemeColors[stage.name] || 'border-border';

  const statusVariant = {
    completed: 'indexed',
    running: 'processing',
    pending: 'pending',
    error: 'error',
  }[stage.status] as 'indexed' | 'processing' | 'pending' | 'error';

  const statusLabels = {
    completed: 'Completed',
    running: 'Running',
    pending: 'Pending',
    error: 'Error',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
    >
      <Card className={`border-2 ${borderColor}`}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <StatusIndicator status={stage.status} />
              <CardTitle className="text-sm">
                {stageLabels[stage.name]}
              </CardTitle>
            </div>
            <div className="flex items-center gap-2">
              {stage.duration && (
                <span className="text-xs text-muted-foreground">
                  {stage.duration}ms
                </span>
              )}
              <Badge variant={statusVariant}>
                {statusLabels[stage.status]}
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          {/* Description */}
          <p className="text-xs text-muted-foreground mb-2">
            {isRunning ? stageDescriptions[stage.name] :
             isCompleted ? 'Completed successfully' :
             isError ? stage.message || 'Error occurred' :
             'Waiting...'}
          </p>

          {/* Progress bar (for running stage) */}
          {isRunning && (
            <div className="mb-2">
              <div className="w-full bg-muted rounded-full h-1.5">
                <motion.div
                  className="h-1.5 rounded-full bg-status-processing"
                  animate={{ width: `${stage.progress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>
          )}

          {/* Metrics (for completed stage) */}
          {isCompleted && stage.metrics && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-2 p-2 bg-muted rounded"
            >
              {formatMetrics(stage.metrics)}
            </motion.div>
          )}

          {/* Collapsible log panel */}
          {(logs.length > 0 || isRunning) && (
            <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
              <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground mt-2 w-full">
                {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                <span>Logs ({logs.length})</span>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <div className="p-2 bg-background rounded border">
                  <StageLogList logs={logs} />
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default StageCard;