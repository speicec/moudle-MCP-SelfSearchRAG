import type { ContentPosition } from './pdf-parser.js';
import type { ImageBlock } from '../core/types.js';

/**
 * Chart type enumeration
 */
export type ChartType =
  | 'bar'
  | 'line'
  | 'pie'
  | 'scatter'
  | 'area'
  | 'radar'
  | 'heatmap'
  | 'unknown';

/**
 * Diagram type enumeration
 */
export type DiagramType =
  | 'flowchart'
  | 'network'
  | 'venn'
  | 'tree'
  | 'timeline'
  | 'process'
  | 'unknown';

/**
 * Chart detection configuration
 */
export interface ChartDetectionConfig {
  minChartWidth: number;
  minChartHeight: number;
  confidenceThreshold: number;
  includeLegends: boolean;
  includeAxisLabels: boolean;
}

/**
 * Default chart detection configuration
 */
export const DEFAULT_CHART_CONFIG: ChartDetectionConfig = {
  minChartWidth: 100,
  minChartHeight: 100,
  confidenceThreshold: 0.6,
  includeLegends: true,
  includeAxisLabels: true,
};

/**
 * Detected chart information
 */
export interface DetectedChart {
  id: string;
  pageNumber: number;
  position: ContentPosition;
  chartType: ChartType;
  confidence: number;
  hasLegend: boolean;
  hasAxisLabels: boolean;
  hasTitle: boolean;
  estimatedDataPoints: number;
}

/**
 * Detected diagram information
 */
export interface DetectedDiagram {
  id: string;
  pageNumber: number;
  position: ContentPosition;
  diagramType: DiagramType;
  confidence: number;
  nodeCount: number;
  hasLabels: boolean;
}

/**
 * PDF chart detector
 * Note: This is a simplified implementation. Full implementation would use
 * computer vision models or specialized chart detection libraries
 */
export class PDFChartDetector {
  private config: ChartDetectionConfig;

  constructor(config: Partial<ChartDetectionConfig> = {}) {
    this.config = {
      ...DEFAULT_CHART_CONFIG,
      ...config,
    };
  }

  /**
   * Detect charts in images
   * This uses heuristic-based detection - full implementation would use ML models
   */
  async detectCharts(
    images: ImageBlock[]
  ): Promise<DetectedChart[]> {
    const charts: DetectedChart[] = [];

    for (const image of images) {
      // Skip small images
      const width = image.metadata.width;
      const height = image.metadata.height;
      if (!width || !height || width < this.config.minChartWidth || height < this.config.minChartHeight) {
        continue;
      }

      // Heuristic detection based on aspect ratio and surrounding text
      const potentialChart = this.analyzeForChart(image);

      if (potentialChart.confidence >= this.config.confidenceThreshold) {
        charts.push(potentialChart);
      }
    }

    return charts;
  }

  /**
   * Analyze image for chart characteristics
   */
  private analyzeForChart(image: ImageBlock): DetectedChart {
    const width = image.metadata.width ?? 0;
    const height = image.metadata.height ?? 0;
    const aspectRatio = width / height;

    // Determine likely chart type based on aspect ratio and characteristics
    let chartType: ChartType = 'unknown';
    let confidence = 0.3;

    // Charts typically have aspect ratios between 1:1 and 4:1
    if (aspectRatio >= 0.8 && aspectRatio <= 4) {
      confidence += 0.2;

      // Bar charts are often wider than tall
      if (aspectRatio > 1.5 && aspectRatio <= 3) {
        chartType = 'bar';
        confidence += 0.1;
      }

      // Line charts can have similar aspect ratios
      if (aspectRatio >= 1 && aspectRatio <= 2.5) {
        chartType = 'line';
        confidence += 0.05;
      }

      // Pie charts are typically square or circular
      if (aspectRatio >= 0.9 && aspectRatio <= 1.1) {
        chartType = 'pie';
        confidence += 0.15;
      }

      // Scatter plots are often square-ish
      if (aspectRatio >= 0.8 && aspectRatio <= 1.3) {
        if (chartType === 'unknown') {
          chartType = 'scatter';
          confidence += 0.1;
        }
      }
    }

    // Additional heuristics based on size
    if (width > 300 && height > 200) {
      confidence += 0.1; // Typical chart size
    }

    return {
      id: `chart_${image.blockIndex}`,
      pageNumber: image.position.page,
      position: image.position,
      chartType,
      confidence: Math.min(confidence, 1),
      hasLegend: this.config.includeLegends && aspectRatio > 1.2,
      hasAxisLabels: this.config.includeAxisLabels && chartType !== 'pie',
      hasTitle: true, // Assume charts have titles
      estimatedDataPoints: this.estimateDataPoints(chartType, width, height),
    };
  }

  /**
   * Estimate number of data points in chart
   */
  private estimateDataPoints(
    chartType: ChartType,
    width: number,
    height: number
  ): number {
    switch (chartType) {
      case 'bar':
        return Math.floor(width / 30); // ~30px per bar
      case 'line':
        return Math.floor(width / 10); // ~10px per point
      case 'pie':
        return 5; // Typical pie chart segments
      case 'scatter':
        return Math.floor((width * height) / 1000); // Density-based
      default:
        return 10;
    }
  }

  /**
   * Detect diagrams/flowcharts
   */
  async detectDiagrams(
    images: ImageBlock[]
  ): Promise<DetectedDiagram[]> {
    const diagrams: DetectedDiagram[] = [];

    for (const image of images) {
      const width = image.metadata.width;
      const height = image.metadata.height;
      if (!width || !height || width < this.config.minChartWidth || height < this.config.minChartHeight) {
        continue;
      }

      const potentialDiagram = this.analyzeForDiagram(image);

      if (potentialDiagram.confidence >= this.config.confidenceThreshold) {
        diagrams.push(potentialDiagram);
      }
    }

    return diagrams;
  }

  /**
   * Analyze image for diagram characteristics
   */
  private analyzeForDiagram(image: ImageBlock): DetectedDiagram {
    const width = image.metadata.width ?? 0;
    const height = image.metadata.height ?? 0;
    const aspectRatio = width / height;

    let diagramType: DiagramType = 'unknown';
    let confidence = 0.3;
    let nodeCount = 0;

    // Flowcharts often have moderate aspect ratios
    if (aspectRatio >= 0.5 && aspectRatio <= 3) {
      confidence += 0.2;

      // Vertical flowcharts (tall)
      if (aspectRatio < 1) {
        diagramType = 'flowchart';
        confidence += 0.1;
        nodeCount = Math.floor(height / 80); // Estimate nodes
      }

      // Horizontal flowcharts/process diagrams (wide)
      if (aspectRatio > 1.5) {
        diagramType = 'process';
        confidence += 0.1;
        nodeCount = Math.floor(width / 100);
      }

      // Network diagrams (often square-ish)
      if (aspectRatio >= 0.9 && aspectRatio <= 1.3) {
        diagramType = 'network';
        confidence += 0.05;
        nodeCount = Math.floor((width * height) / 2000);
      }

      // Tree diagrams (often tall with branching)
      if (aspectRatio < 0.7 && height > 300) {
        diagramType = 'tree';
        confidence += 0.1;
        nodeCount = Math.floor(height / 60);
      }
    }

    return {
      id: `diagram_${image.blockIndex}`,
      pageNumber: image.position.page,
      position: image.position,
      diagramType,
      confidence: Math.min(confidence, 1),
      nodeCount,
      hasLabels: confidence > 0.5, // Assume labels if confident
    };
  }

  /**
   * Get all detected visuals (charts + diagrams)
   */
  async detectAllVisuals(images: ImageBlock[]): Promise<{
    charts: DetectedChart[];
    diagrams: DetectedDiagram[];
  }> {
    const charts = await this.detectCharts(images);
    const diagrams = await this.detectDiagrams(images);

    return { charts, diagrams };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ChartDetectionConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }
}

/**
 * Create chart detector
 */
export function createChartDetector(
  config?: Partial<ChartDetectionConfig>
): PDFChartDetector {
  return new PDFChartDetector(config);
}