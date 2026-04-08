/**
 * @spec evaluation.md#回归测试
 * @layer 4
 * @description 回归测试套件实现
 */

// 回归测试用例
export interface RegressionTestCase {
  id: string;
  name: string;
  category: 'index' | 'search' | 'delete' | 'config' | 'mcp';
  steps: Array<{
    action: string;
    input: Record<string, unknown>;
    expectedOutput?: Record<string, unknown>;
  }>;
  expected: {
    success: boolean;
    metrics?: {
      maxLatency: number;
      minResults?: number;
    };
  };
}

// 测试结果
export interface TestResult {
  testId: string;
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  actualOutput?: Record<string, unknown>;
  expectedOutput: Record<string, unknown>;
  latency: number;
  error?: string;
}

// 回归测试报告
export interface RegressionReport {
  timestamp: Date;
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  results: TestResult[];
  summary: {
    passRate: number;
    categories: Map<string, { passed: number; failed: number }>;
    avgLatency: number;
  };
}

export class RegressionRunner {
  private tests: Map<string, RegressionTestCase> = new Map();
  private handlers: Map<string, (input: Record<string, unknown>) => Promise<Record<string, unknown>>>;

  constructor() {
    this.handlers = new Map();
  }

  registerHandler(action: string, handler: (input: Record<string, unknown>) => Promise<Record<string, unknown>>): void {
    this.handlers.set(action, handler);
  }

  addTest(test: RegressionTestCase): void {
    this.tests.set(test.id, test);
  }

  addTests(tests: RegressionTestCase[]): void {
    for (const test of tests) {
      this.tests.set(test.id, test);
    }
  }

  async runAll(): Promise<RegressionReport> {
    return this.runTests(Array.from(this.tests.keys()));
  }

  async runCategory(category: string): Promise<RegressionReport> {
    const testIds = Array.from(this.tests.values())
      .filter(t => t.category === category)
      .map(t => t.id);
    return this.runTests(testIds);
  }

  async runTest(testId: string): Promise<TestResult> {
    const test = this.tests.get(testId);
    if (!test) {
      return {
        testId,
        name: 'Unknown',
        status: 'skipped',
        expectedOutput: {},
        latency: 0,
        error: 'Test not found'
      };
    }

    const startTime = Date.now();
    let actualOutput: Record<string, unknown> = {};
    let status: 'passed' | 'failed' | 'skipped' = 'passed';
    let error: string | undefined;

    try {
      for (const step of test.steps) {
        const handler = this.handlers.get(step.action);
        if (!handler) {
          throw new Error(`No handler for action: ${step.action}`);
        }
        actualOutput = await handler(step.input);
      }

      // Check expected results
      if (test.expected.metrics) {
        if (test.expected.metrics.maxLatency && Date.now() - startTime > test.expected.metrics.maxLatency) {
          throw new Error(`Latency exceeded: ${Date.now() - startTime}ms > ${test.expected.metrics.maxLatency}ms`);
        }
      }
    } catch (err) {
      status = 'failed';
      error = err instanceof Error ? err.message : 'Unknown error';
    }

    return {
      testId,
      name: test.name,
      status,
      actualOutput,
      expectedOutput: test.expected,
      latency: Date.now() - startTime,
      error
    };
  }

  private async runTests(testIds: string[]): Promise<RegressionReport> {
    const results: TestResult[] = [];
    const categories = new Map<string, { passed: number; failed: number }>();
    let totalLatency = 0;

    for (const testId of testIds) {
      const result = await this.runTest(testId);
      results.push(result);
      totalLatency += result.latency;

      const test = this.tests.get(testId);
      if (test) {
        const cat = test.category;
        if (!categories.has(cat)) {
          categories.set(cat, { passed: 0, failed: 0 });
        }
        if (result.status === 'passed') {
          categories.get(cat)!.passed++;
        } else if (result.status === 'failed') {
          categories.get(cat)!.failed++;
        }
      }
    }

    const passed = results.filter(r => r.status === 'passed').length;
    const failed = results.filter(r => r.status === 'failed').length;
    const skipped = results.filter(r => r.status === 'skipped').length;

    return {
      timestamp: new Date(),
      totalTests: results.length,
      passed,
      failed,
      skipped,
      results,
      summary: {
        passRate: results.length > 0 ? passed / results.length : 0,
        categories,
        avgLatency: results.length > 0 ? totalLatency / results.length : 0
      }
    };
  }
}

// 预定义回归测试用例
export const defaultRegressionTests: RegressionTestCase[] = [
  {
    id: 'search-basic-001',
    name: '基础向量检索',
    category: 'search',
    steps: [
      { action: 'rag_search', input: { query: 'test query', top_k: 10 } }
    ],
    expected: { success: true, metrics: { maxLatency: 1000 } }
  },
  {
    id: 'search-hybrid-002',
    name: '混合检索',
    category: 'search',
    steps: [
      { action: 'rag_search', input: { query: 'code example', mode: 'hybrid' } }
    ],
    expected: { success: true, metrics: { maxLatency: 1500 } }
  },
  {
    id: 'config-get-003',
    name: '获取配置',
    category: 'config',
    steps: [
      { action: 'rag_config', input: { action: 'get' } }
    ],
    expected: { success: true }
  },
  {
    id: 'status-004',
    name: '系统状态查询',
    category: 'mcp',
    steps: [
      { action: 'rag_status', input: {} }
    ],
    expected: { success: true }
  }
];