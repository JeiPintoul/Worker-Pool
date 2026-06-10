import { Command } from 'commander';
import {
  DEFAULT_BATCH_SIZE,
  DEFAULT_CHUNK_SIZE,
  DEFAULT_HASH_ROUNDS,
  DEFAULT_INPUT_PATH,
  DEFAULT_POOL_DB_PATH,
  DEFAULT_RESULTS_DIR,
  DEFAULT_ROWS,
  DEFAULT_SINGLE_DB_PATH,
  DEFAULT_WORKERS,
  parsePositiveInteger,
} from '../config/BenchmarkConfig';
import { BenchmarkResult } from '../domain/BenchmarkResult';
import { ChartGenerator } from '../infrastructure/ChartGenerator';
import { SingleThreadEtlRunner } from '../etl/SingleThreadEtlRunner';
import { WorkerPoolEtlRunner } from '../etl/WorkerPoolEtlRunner';
import { generateCsv } from './generate';

type CliMode = 'single' | 'pool' | 'all';

interface BenchmarkCliOptions {
  mode: CliMode;
  rows: string;
  input: string;
  db?: string;
  singleDb: string;
  poolDb: string;
  outputDir: string;
  workers: string;
  chunkSize: string;
  batchSize: string;
  hashRounds: string;
  resetDatabase: boolean;
}

async function main(): Promise<void> {
  const program = new Command();

  program
    .name('runBenchmark')
    .description('Run single-thread, worker-pool, or full ETL benchmark.')
    .option('--mode <mode>', 'single, pool, or all', 'all')
    .option('--rows <number>', 'rows to generate when running all mode', String(DEFAULT_ROWS))
    .option('--input <path>', 'input CSV path', DEFAULT_INPUT_PATH)
    .option('--db <path>', 'SQLite database path for single mode or pool mode')
    .option('--single-db <path>', 'SQLite database path for single-thread all mode', DEFAULT_SINGLE_DB_PATH)
    .option('--pool-db <path>', 'SQLite database path for worker-pool all mode', DEFAULT_POOL_DB_PATH)
    .option('--output-dir <path>', 'benchmark results output directory', DEFAULT_RESULTS_DIR)
    .option('--workers <number>', 'number of workers for worker-pool mode', String(DEFAULT_WORKERS))
    .option('--chunk-size <number>', 'CSV rows per processing chunk', String(DEFAULT_CHUNK_SIZE))
    .option('--batch-size <number>', 'SQLite insert batch size', String(DEFAULT_BATCH_SIZE))
    .option('--hash-rounds <number>', 'SHA-256 rounds per row', String(DEFAULT_HASH_ROUNDS))
    .option('--no-reset-database', 'do not reset the database before running');

  program.parse();
  const options = program.opts<BenchmarkCliOptions>();
  const mode = parseMode(options.mode);
  const workers = parsePositiveInteger(options.workers, 'workers');
  const chunkSize = parsePositiveInteger(options.chunkSize, 'chunk-size');
  const batchSize = parsePositiveInteger(options.batchSize, 'batch-size');
  const hashRounds = parsePositiveInteger(options.hashRounds, 'hash-rounds');

  if (mode === 'all') {
    const rows = parsePositiveInteger(options.rows, 'rows');
    await generateCsv(rows, options.input);

    const singleResult = await new SingleThreadEtlRunner().run({
      mode: 'single-thread',
      input: options.input,
      db: options.singleDb,
      outputDir: options.outputDir,
      workers: 1,
      chunkSize,
      batchSize,
      hashRounds,
      resetDatabase: options.resetDatabase,
    });
    printSummary(singleResult);

    const poolResult = await new WorkerPoolEtlRunner().run({
      mode: 'worker-pool',
      input: options.input,
      db: options.poolDb,
      outputDir: options.outputDir,
      workers,
      chunkSize,
      batchSize,
      hashRounds,
      resetDatabase: options.resetDatabase,
    });
    printSummary(poolResult);

    const chartPaths = await new ChartGenerator().generate(options.outputDir);
    console.log(`Charts generated: ${chartPaths.join(', ')}`);
    return;
  }

  const db = options.db ?? (mode === 'single' ? DEFAULT_SINGLE_DB_PATH : DEFAULT_POOL_DB_PATH);
  const result =
    mode === 'single'
      ? await new SingleThreadEtlRunner().run({
          mode: 'single-thread',
          input: options.input,
          db,
          outputDir: options.outputDir,
          workers: 1,
          chunkSize,
          batchSize,
          hashRounds,
          resetDatabase: options.resetDatabase,
        })
      : await new WorkerPoolEtlRunner().run({
          mode: 'worker-pool',
          input: options.input,
          db,
          outputDir: options.outputDir,
          workers,
          chunkSize,
          batchSize,
          hashRounds,
          resetDatabase: options.resetDatabase,
        });

  printSummary(result);
}

function parseMode(value: string): CliMode {
  if (value === 'single' || value === 'pool' || value === 'all') {
    return value;
  }

  throw new Error('mode must be one of: single, pool, all.');
}

function printSummary(result: BenchmarkResult): void {
  console.log('');
  console.log(`Mode: ${result.mode}`);
  console.log(`Total processed rows: ${result.totalRows}`);
  console.log(`Workers: ${result.workers}`);
  console.log(`Chunk size: ${result.chunkSize}`);
  console.log(`Batch size: ${result.batchSize}`);
  console.log(`Hash rounds: ${result.hashRounds}`);
  console.log(`Total time: ${result.totalTimeMs.toFixed(2)} ms`);
  console.log(`Rows per second: ${result.rowsPerSecond.toFixed(2)}`);
  console.log(`SQLite database path: ${result.sqliteDatabasePath}`);
  console.log(`Benchmark result path: ${result.benchmarkResultPath}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
