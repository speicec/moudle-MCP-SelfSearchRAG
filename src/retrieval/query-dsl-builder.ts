/**
 * Query DSL Builder
 *
 * Builds structured query DSL with filters from analysis results.
 */

import type { QueryAnalysisResult, QueryDSL } from './types.js';

/**
 * Supported filter operators
 */
export type FilterOperator = 'eq' | 'gt' | 'lt' | 'gte' | 'lte' | 'in';

/**
 * Filter mapping from detected filters to DSL
 */
const FILTER_FIELD_MAPPING: Record<string, { field: string; operator: FilterOperator }> = {
  year: { field: 'metadata.year', operator: 'eq' },
  month: { field: 'metadata.month', operator: 'eq' },
  category: { field: 'metadata.category', operator: 'eq' },
  documentType: { field: 'metadata.documentType', operator: 'eq' },
  section: { field: 'metadata.section', operator: 'eq' },
  pageNumber: { field: 'metadata.pageNumber', operator: 'eq' },
};

/**
 * Query DSL Builder class
 */
export class QueryDSLBuilder {
  /**
   * Build DSL from analysis result
   */
  build(analysisResult: QueryAnalysisResult, textQuery: string): QueryDSL {
    const filters = this.buildFilters(analysisResult.detectedFilters);

    const dsl: QueryDSL = {
      textQuery,
      filters,
    };

    // Add sort if needed
    if (analysisResult.complexity === 'structured') {
      // For structured queries, sort by relevance
      dsl.sortBy = { field: 'qualityScore.composite', order: 'desc' };
    }

    return dsl;
  }

  /**
   * Build filters from detected filters
   */
  private buildFilters(
    detectedFilters?: Record<string, string | number>
  ): QueryDSL['filters'] {
    if (!detectedFilters || Object.keys(detectedFilters).length === 0) {
      return [];
    }

    const filters: QueryDSL['filters'] = [];

    for (const [key, value] of Object.entries(detectedFilters)) {
      const mapping = FILTER_FIELD_MAPPING[key];
      if (mapping) {
        filters.push({
          field: mapping.field,
          operator: mapping.operator,
          value,
        });
      } else {
        // Unknown filter - add as generic field
        filters.push({
          field: `metadata.${key}`,
          operator: 'eq',
          value,
        });
      }
    }

    return filters;
  }

  /**
   * Build DSL for range queries (e.g., "2021 to 2023")
   */
  buildRangeDSL(
    query: string,
    field: string,
    startValue: number,
    endValue: number
  ): QueryDSL {
    return {
      textQuery: query,
      filters: [
        { field, operator: 'gte', value: startValue },
        { field, operator: 'lte', value: endValue },
      ],
    };
  }

  /**
   * Build DSL for multi-value filter (e.g., "A or B or C")
   */
  buildMultiValueDSL(
    query: string,
    field: string,
    values: string[]
  ): QueryDSL {
    return {
      textQuery: query,
      filters: [
        { field, operator: 'in', value: values },
      ],
    };
  }

  /**
   * Parse query for range indicators
   */
  parseRange(query: string): { field: string; start: number; end: number } | null {
    // Year range: "2021 to 2023" or "2021-2023"
    const yearRangeMatch = query.match(/(\d{4})\s*(to|至|-|~)\s*(\d{4})/);
    if (yearRangeMatch) {
      return {
        field: 'metadata.year',
        start: parseInt(yearRangeMatch[1]!, 10),
        end: parseInt(yearRangeMatch[3]!, 10),
      };
    }

    return null;
  }

  /**
   * Convert DSL to human-readable description
   */
  describeDSL(dsl: QueryDSL): string {
    const parts: string[] = [`Query: "${dsl.textQuery}"`];

    if (dsl.filters.length > 0) {
      parts.push('Filters:');
      for (const filter of dsl.filters) {
        parts.push(`  - ${filter.field} ${filter.operator} ${JSON.stringify(filter.value)}`);
      }
    }

    if (dsl.sortBy) {
      parts.push(`Sort by: ${dsl.sortBy.field} (${dsl.sortBy.order})`);
    }

    return parts.join('\n');
  }

  /**
   * Merge multiple DSLs (for combining query results)
   */
  mergeDSLs(dsls: QueryDSL[]): QueryDSL {
    if (dsls.length === 0) {
      return { textQuery: '', filters: [] };
    }

    if (dsls.length === 1) {
      return dsls[0]!;
    }

    // Combine text queries
    const textQueries = dsls.map(d => d.textQuery).filter(t => t);
    const combinedTextQuery = textQueries.join(' OR ');

    // Combine filters (remove duplicates)
    const allFilters = dsls.flatMap(d => d.filters);
    const uniqueFilters = this.removeDuplicateFilters(allFilters);

    return {
      textQuery: combinedTextQuery,
      filters: uniqueFilters,
    };
  }

  /**
   * Remove duplicate filters
   */
  private removeDuplicateFilters(filters: QueryDSL['filters']): QueryDSL['filters'] {
    const seen = new Set<string>();
    const unique: QueryDSL['filters'] = [];

    for (const filter of filters) {
      const key = `${filter.field}:${filter.operator}:${JSON.stringify(filter.value)}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(filter);
      }
    }

    return unique;
  }

  /**
   * Validate DSL structure
   */
  validateDSL(dsl: QueryDSL): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!dsl.textQuery && dsl.filters.length === 0) {
      errors.push('DSL must have either textQuery or filters');
    }

    for (const filter of dsl.filters) {
      if (!filter.field) {
        errors.push('Filter must have a field');
      }
      if (!filter.operator) {
        errors.push('Filter must have an operator');
      }
      if (filter.value === undefined) {
        errors.push('Filter must have a value');
      }
      if (!['eq', 'gt', 'lt', 'gte', 'lte', 'in'].includes(filter.operator)) {
        errors.push(`Invalid operator: ${filter.operator}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

/**
 * Create DSL builder instance
 */
export function createQueryDSLBuilder(): QueryDSLBuilder {
  return new QueryDSLBuilder();
}