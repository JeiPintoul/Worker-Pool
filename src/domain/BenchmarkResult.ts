// Identifica qual estratégia de execução produziu o resultado.
export type BenchmarkMode = 'single-thread' | 'worker-pool';

// Métricas e parâmetros persistidos para comparar execuções equivalentes.
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
