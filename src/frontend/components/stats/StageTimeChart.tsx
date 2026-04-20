import React from 'react';
import { motion } from 'framer-motion';
import { Lightbulb, Check } from 'lucide-react';

/**
 * Stage time distribution chart - displays processing time per stage
 */
const StageTimeChart: React.FC<{
  distribution: { ingest: number; parse: number; embed: number; index: number };
}> = ({ distribution }) => {
  const total = distribution.ingest + distribution.parse + distribution.embed + distribution.index;
  const stages = [
    { name: '导入', value: distribution.ingest, color: 'bg-amber-500' },
    { name: '解析', value: distribution.parse, color: 'bg-violet-500' },
    { name: '嵌入', value: distribution.embed, color: 'bg-primary' },
    { name: '索引', value: distribution.index, color: 'bg-confidence-high' },
  ];

  const maxValue = Math.max(...stages.map(s => s.value));

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-foreground">阶段耗时分布</h3>

      {/* Bar chart */}
      <div className="space-y-2">
        {stages.map((stage) => (
          <div key={stage.name} className="flex items-center gap-2">
            <span className="w-16 text-xs text-muted-foreground">{stage.name}</span>
            <div className="flex-1 h-4 bg-muted rounded overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: maxValue > 0 ? `${(stage.value / maxValue) * 100}%` : '0%' }}
                transition={{ duration: 0.5 }}
                className={`h-full ${stage.color}`}
              />
            </div>
            <span className="w-16 text-xs text-right text-foreground">
              {stage.value}ms
            </span>
          </div>
        ))}
      </div>

      {/* Optimization hint */}
      {total > 0 && (
        <div className="p-2 rounded bg-muted text-xs text-muted-foreground">
          {distribution.embed > total * 0.5 && (
            <span className="flex items-center gap-1">
              <Lightbulb className="w-3 h-3" />
              嵌入阶段耗时最长，建议使用更快的嵌入模型或启用缓存。
            </span>
          )}
          {distribution.parse > total * 0.5 && (
            <span className="flex items-center gap-1">
              <Lightbulb className="w-3 h-3" />
              解析阶段耗时最长，建议优化文档大小或使用批量处理。
            </span>
          )}
          {total > 0 && distribution.embed <= total * 0.5 && distribution.parse <= total * 0.5 && (
            <span className="flex items-center gap-1">
              <Check className="w-3 h-3 text-confidence-high" />
              各阶段耗时均衡，运行状态良好。
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default StageTimeChart;