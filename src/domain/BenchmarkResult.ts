export type BenchmarkMode = 'single-thread' | 'worker-pool';

export interface BenchmarkResult {
  mode: BenchmarkMode;
  totalRows: number;
  workers: number;
  chunkSize: number;
  batchSize: number;
  hashRounds: number;
  totalTimeMs: number;
  rowsPerSecond: number;
  sqliteDatabasePath: string;
  benchmarkResultPath: string;
  createdAt: string;
}
