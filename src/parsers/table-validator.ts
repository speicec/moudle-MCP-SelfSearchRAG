import type { TableBlock } from '../core/types.js';
import type { TableCell } from './table-extractor.js';

/**
 * Table validation metrics
 */
export interface TableValidationMetrics {
  totalTables: number;
  correctlyDetectedTables: number;
  falsePositives: number;
  falseNegatives: number;
  precision: number;
  recall: number;
  f1Score: number;
}

/**
 * Cell-level validation metrics
 */
export interface CellValidationMetrics {
  totalCells: number;
  correctlyExtractedCells: number;
  missingCells: number;
  extraCells: number;
  accuracy: number;
}

/**
 * Cell validation result with details
 */
export interface CellValidationResult {
  total: number;
  correctlyExtractedCells: number;
  missingCells: number;
  extraCells: number;
  accuracy: number;
}

/**
 * Ground truth table
 */
export interface GroundTruthTable {
  id: string;
  pageNumber: number;
  rows: number;
  columns: number;
  cells: TableCell[];
}

/**
 * Table validation result
 */
export interface TableValidationResult {
  tableMetrics: TableValidationMetrics;
  cellMetrics: CellValidationMetrics;
  details: TableValidationDetail[];
}

/**
 * Individual table validation detail
 */
export interface TableValidationDetail {
  tableId: string;
  detected: boolean;
  rowMatch: boolean;
  columnMatch: boolean;
  cellAccuracy: number;
  issues: string[];
}

/**
 * Table validator
 */
export class TableValidator {
  /**
   * Validate extracted tables against ground truth
   */
  validate(
    extractedTables: TableBlock[],
    groundTruth: GroundTruthTable[]
  ): TableValidationResult {
    const details: TableValidationDetail[] = [];
    let correctlyDetected = 0;
    let falsePositives = 0;
    let falseNegatives = 0;
    let totalCells = 0;
    let correctlyExtractedCells = 0;
    let missingCells = 0;
    let extraCells = 0;

    // Match extracted tables to ground truth
    const matchedGroundTruth = new Set<string>();

    for (const extracted of extractedTables) {
      const match = this.findMatchingGroundTruth(extracted, groundTruth);

      if (match) {
        matchedGroundTruth.add(match.id);
        correctlyDetected++;

        // Validate cell extraction
        const cellValidation = this.validateCells(extracted, match);
        totalCells += cellValidation.total;
        correctlyExtractedCells += cellValidation.correctlyExtractedCells;
        missingCells += cellValidation.missingCells;
        extraCells += cellValidation.extraCells;

        details.push({
          tableId: match.id,
          detected: true,
          rowMatch: extracted.rows.length === match.rows,
          columnMatch: extracted.columns.length === match.columns,
          cellAccuracy: cellValidation.accuracy,
          issues: cellValidation.issues,
        });
      } else {
        falsePositives++;
        details.push({
          tableId: `unknown_${extracted.blockIndex}`,
          detected: false,
          rowMatch: false,
          columnMatch: false,
          cellAccuracy: 0,
          issues: ['False positive - no matching ground truth'],
        });
      }
    }

    // Count false negatives (missed tables)
    for (const gt of groundTruth) {
      if (!matchedGroundTruth.has(gt.id)) {
        falseNegatives++;
        details.push({
          tableId: gt.id,
          detected: false,
          rowMatch: false,
          columnMatch: false,
          cellAccuracy: 0,
          issues: ['False negative - table not detected'],
        });
      }
    }

    // Calculate metrics
    const precision = extractedTables.length > 0
      ? correctlyDetected / extractedTables.length
      : 0;

    const recall = groundTruth.length > 0
      ? correctlyDetected / groundTruth.length
      : 0;

    const f1Score = precision + recall > 0
      ? 2 * (precision * recall) / (precision + recall)
      : 0;

    const cellAccuracy = totalCells > 0
      ? correctlyExtractedCells / totalCells
      : 0;

    return {
      tableMetrics: {
        totalTables: groundTruth.length,
        correctlyDetectedTables: correctlyDetected,
        falsePositives,
        falseNegatives,
        precision,
        recall,
        f1Score,
      },
      cellMetrics: {
        totalCells,
        correctlyExtractedCells,
        missingCells,
        extraCells,
        accuracy: cellAccuracy,
      },
      details,
    };
  }

  /**
   * Find matching ground truth table
   */
  private findMatchingGroundTruth(
    extracted: TableBlock,
    groundTruth: GroundTruthTable[]
  ): GroundTruthTable | null {
    // Match by page and approximate dimensions
    for (const gt of groundTruth) {
      if (extracted.position.page === gt.pageNumber) {
        // Allow some tolerance in row/column counts
        const rowDiff = Math.abs(extracted.rows.length - gt.rows);
        const colDiff = Math.abs(extracted.columns.length - gt.columns);

        if (rowDiff <= 1 && colDiff <= 1) {
          return gt;
        }
      }
    }

    return null;
  }

  /**
   * Validate cell extraction
   */
  private validateCells(
    extracted: TableBlock,
    groundTruth: GroundTruthTable
  ): CellValidationResult & { issues: string[] } {
    const issues: string[] = [];
    let correct = 0;
    let missing = 0;
    let extra = 0;

    // Create cell maps for comparison
    const extractedCellMap = new Map<string, TableCell>();
    for (const cell of extracted.cells) {
      extractedCellMap.set(`${cell.rowIndex}_${cell.colIndex}`, cell);
    }

    const groundTruthCellMap = new Map<string, TableCell>();
    for (const cell of groundTruth.cells) {
      groundTruthCellMap.set(`${cell.rowIndex}_${cell.colIndex}`, cell);
    }

    // Check each ground truth cell
    for (const [key, gtCell] of groundTruthCellMap) {
      const extractedCell = extractedCellMap.get(key);

      if (!extractedCell) {
        missing++;
        issues.push(`Missing cell at row ${gtCell.rowIndex}, col ${gtCell.colIndex}`);
      } else {
        // Compare content (with some normalization)
        const gtContent = gtCell.content.toLowerCase().trim();
        const extractedContent = extractedCell.content.toLowerCase().trim();

        if (gtContent === extractedContent ||
            gtContent.includes(extractedContent) ||
            extractedContent.includes(gtContent)) {
          correct++;
        } else {
          issues.push(
            `Content mismatch at row ${gtCell.rowIndex}, col ${gtCell.colIndex}: ` +
            `expected "${gtCell.content}", got "${extractedCell.content}"`
          );
        }
      }
    }

    // Count extra cells
    for (const [key] of extractedCellMap) {
      if (!groundTruthCellMap.has(key)) {
        extra++;
        issues.push(`Extra cell at position ${key}`);
      }
    }

    const total = groundTruthCellMap.size;
    const accuracy = total > 0 ? correct / total : 0;

    return {
      total,
      correctlyExtractedCells: correct,
      missingCells: missing,
      extraCells: extra,
      accuracy,
      issues,
    };
  }

  /**
   * Calculate benchmark score
   */
  calculateBenchmarkScore(result: TableValidationResult): number {
    // Weighted combination of metrics
    const weights = {
      tablePrecision: 0.3,
      tableRecall: 0.3,
      cellAccuracy: 0.4,
    };

    return (
      weights.tablePrecision * result.tableMetrics.precision +
      weights.tableRecall * result.tableMetrics.recall +
      weights.cellAccuracy * result.cellMetrics.accuracy
    );
  }
}

/**
 * Benchmark test suite
 */
export class TableBenchmark {
  private validator: TableValidator;

  constructor() {
    this.validator = new TableValidator();
  }

  /**
   * Run benchmark against test dataset
   */
  async runBenchmark(
    extractor: { extract(pageText: string, pageNumber: number): Promise<TableBlock[]> },
    testCases: BenchmarkTestCase[]
  ): Promise<BenchmarkResult> {
    const results: TableValidationResult[] = [];

    for (const testCase of testCases) {
      const extractedTables = await extractor.extract(
        testCase.pageText,
        testCase.pageNumber
      );

      const result = this.validator.validate(
        extractedTables,
        testCase.groundTruth
      );

      results.push(result);
    }

    // Aggregate results
    const aggregated = this.aggregateResults(results);

    return {
      testCases: results,
      aggregatedMetrics: aggregated,
      passed: aggregated.tableMetrics.precision >= 0.95 &&
              aggregated.tableMetrics.recall >= 0.95 &&
              aggregated.cellMetrics.accuracy >= 0.95,
    };
  }

  /**
   * Aggregate multiple validation results
   */
  private aggregateResults(results: TableValidationResult[]): TableValidationResult {
    let totalTables = 0;
    let correctlyDetectedTables = 0;
    let totalCells = 0;
    let correctlyExtractedCells = 0;

    for (const result of results) {
      totalTables += result.tableMetrics.totalTables;
      correctlyDetectedTables += result.tableMetrics.correctlyDetectedTables;
      totalCells += result.cellMetrics.totalCells;
      correctlyExtractedCells += result.cellMetrics.correctlyExtractedCells;
    }

    const precision = totalTables > 0 ? correctlyDetectedTables / totalTables : 0;
    const recall = precision; // Simplified
    const cellAccuracy = totalCells > 0 ? correctlyExtractedCells / totalCells : 0;

    return {
      tableMetrics: {
        totalTables,
        correctlyDetectedTables,
        falsePositives: 0,
        falseNegatives: 0,
        precision,
        recall,
        f1Score: 2 * precision * recall / (precision + recall) || 0,
      },
      cellMetrics: {
        totalCells,
        correctlyExtractedCells,
        missingCells: 0,
        extraCells: 0,
        accuracy: cellAccuracy,
      },
      details: [],
    };
  }
}

/**
 * Benchmark test case
 */
export interface BenchmarkTestCase {
  id: string;
  pageNumber: number;
  pageText: string;
  groundTruth: GroundTruthTable[];
}

/**
 * Benchmark result
 */
export interface BenchmarkResult {
  testCases: TableValidationResult[];
  aggregatedMetrics: TableValidationResult;
  passed: boolean;
}

/**
 * Create table validator
 */
export function createTableValidator(): TableValidator {
  return new TableValidator();
}

/**
 * Create benchmark runner
 */
export function createBenchmark(): TableBenchmark {
  return new TableBenchmark();
}