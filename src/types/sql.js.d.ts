/**
 * sql.js Type Declarations
 *
 * sql.js is a pure JavaScript SQLite implementation
 */

declare module 'sql.js' {
  export interface QueryExecResult {
    columns: string[];
    values: unknown[][];
  }

  export interface Database {
    run(sql: string, params?: unknown[]): Database;
    exec(sql: string, params?: unknown[]): QueryExecResult[];
    prepare(sql: string): Statement;
    close(): void;
    each(sql: string, params?: unknown[], callback?: (row: Record<string, unknown>) => void, doneCallback?: () => void): void;
    export(): Uint8Array;
    import(data: Uint8Array): void;
  }

  export interface Statement {
    bind(params?: unknown[]): boolean;
    step(): boolean;
    getAsObject(params?: unknown[]): Record<string, unknown>;
    get(params?: unknown[]): unknown[];
    getColumnNames(): string[];
    free(): boolean;
    run(params?: unknown[]): Statement;
    reset(): Statement;
  }

  export interface SqlJsStatic {
    Database: new (data?: ArrayLike<number> | null) => Database;
  }

  export interface SqlJsConfig {
    locateFile?: (file: string) => string;
  }

  export default function initSqlJs(config?: SqlJsConfig): Promise<SqlJsStatic>;
}