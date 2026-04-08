/**
 * @spec evaluation.md#性能基准
 * @layer 4
 * @description 性能基准测试实现
 */

export interface PerformanceBenchmark {
  name: string;
  scenario: {
    docsCount: number;
    chunksCount: number;
    queryCount: number;
  };
  benchmarks: {
    indexLatency: number;
    searchLatency: number;
    throughput: number;
    memoryUsage: number;
  };
}

export interface BenchmarkResult {
  name: string;
  actual: {
    indexLatency: number;
    searchLatency: number;
    throughput: number;
    memoryUsage: number;
  };
  baseline: PerformanceBenchmark['benchmarks'];
  passed: boolean;
  delta: Map<string, number>;
}

export class BenchmarkRunner {
  private benchmarks: Map<string, PerformanceBenchmark> = new Map();

  addBenchmark(benchmark: PerformanceBenchmark): void {
    this.benchmarks.set(benchmark.name, benchmark);
  }

  async run(name?: string): Promise<BenchmarkResult[]> {
    const results: BenchmarkResult[] = [];

    const toRun = name
      ? [this.benchmarks.get(name)]
      : Array.from(this.benchmarks.values());

    for (const benchmark of toRun) {
      if (!benchmark) continue;

      const result = await this.runBenchmark(benchmark);
      results.push(result);
    }

    return results;
  }

  private async runBenchmark(benchmark: PerformanceBenchmark): Promise<BenchmarkResult> {
    const startTime = Date.now();
    const startMemory = process.memoryUsage().heapUsed;

    // Simulate benchmark execution
    // In real implementation, this would actually run the workload
    const simulatedResults = {
      indexLatency: Math.random() * benchmark.benchmarks.indexLatency * 1.2,
      searchLatency: Math.random() * benchmark.benchmarks.searchLatency * 1.2,
      throughput: benchmark.benchmarks.throughput * (0.8 + Math.random() * 0.4),
      memoryUsage: (process.memoryUsage().heapUsed - startMemory) / 1024 / 1024
    };

    const actual = {
      indexLatency: Date.now() - startTime,
      searchLatency: simulatedResults.searchLatency,
      throughput: simulatedResults.throughput,
      memoryUsage: simulatedResults.memoryUsage
    };

    const delta = new Map<string, number>();
    delta.set('indexLatency', (actual.indexLatency - benchmark.benchmarks.indexLatency) / benchmark.benchmarks.indexLatency);
    delta.set('searchLatency', (actual.searchLatency - benchmark.benchmarks.searchLatency) / benchmark.benchmarks.searchLatency);
    delta.set('throughput', (actual.throughput - benchmark.benchmarks.throughput) / benchmark.benchmarks.throughput);
    delta.set('memoryUsage', (actual.memoryUsage - benchmark.benchmarks.memoryUsage) / benchmark.benchmarks.memoryUsage);

    const passed = Math.abs(delta.get('indexLatency')!) < 0.5 &&
                   Math.abs(delta.get('searchLatency')!) < 0.5 &&
                   delta.get('throughput')! > -0.3;

    return {
      name: benchmark.name,
      actual,
      baseline: benchmark.benchmarks,
      passed,
      delta
    };
  }
}

// 预定义基准测试
export const defaultBenchmarks: PerformanceBenchmark[] = [
  {
    name: 'small-dataset',
    scenario: { docsCount: 100, chunksCount: 500, queryCount: 50 },
    benchmarks: { indexLatency: 100, searchLatency: 50, throughput: 100, memoryUsage: 200 }
  },
  {
    name: 'medium-dataset',
    scenario: { docsCount: 1000, chunksCount: 5000, queryCount: 100 },
    benchmarks: { indexLatency: 150, searchLatency: 80, throughput: 50, memoryUsage: 500 }
  },
  {
    name: 'large-dataset',
    scenario: { docsCount: 10000, chunksCount: 50000, queryCount: 200 },
    benchmarks: { indexLatency: 200, searchLatency: 150, throughput: 20, memoryUsage: 1500 }
  }
];