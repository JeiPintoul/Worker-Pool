import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { BenchmarkConfig } from '../config/BenchmarkConfig';
import { BenchmarkResult } from '../domain/BenchmarkResult';
import { TransformedRow } from '../domain/TransformedRow';
import { Database } from '../infrastructure/Database';
import { MetricsRecorder } from '../infrastructure/MetricsRecorder';
import { CsvChunkReader } from './CsvChunkReader';
import { SqliteLoader } from './SqliteLoader';
import { WorkerPool } from './WorkerPool';

type SettledChunk =
  | { promise: Promise<TransformedRow[]>; rows: TransformedRow[] }
  | { promise: Promise<TransformedRow[]>; error: unknown };

export class WorkerPoolEtlRunner {
  constructor(private readonly csvChunkReader = new CsvChunkReader()) {}

  async run(config: BenchmarkConfig): Promise<BenchmarkResult> {
    const database = await Database.open(config.db, config.resetDatabase);
    const workerPath = path.resolve(__dirname, '../workers/transformWorker.js');
    const workerPool = new WorkerPool(workerPath, config.workers);

    try {
      const loader = new SqliteLoader(database.getConnection());
      loader.createSchema();

      const metricsRecorder = new MetricsRecorder(database.getConnection(), config.outputDir);
      const start = performance.now();
      const inFlight = new Set<Promise<TransformedRow[]>>();
      const maxInFlight = Math.max(config.workers * 2, 1);
      let totalRowsRead = 0;
      let totalRowsInserted = 0;

      const waitForOne = async (): Promise<void> => {
        const completed = await Promise.race(
          Array.from(
            inFlight,
            (promise): Promise<SettledChunk> =>
              promise.then(
                (rows) => ({ promise, rows }),
                (error: unknown) => ({ promise, error }),
              ),
          ),
        );

        inFlight.delete(completed.promise);

        if ('error' in completed) {
          throw completed.error instanceof Error
            ? completed.error
            : new Error(String(completed.error));
        }

        loader.insertRows(completed.rows, config.batchSize);
        totalRowsInserted += completed.rows.length;
      };

      for await (const chunk of this.csvChunkReader.readChunks(config.input, config.chunkSize)) {
        totalRowsRead += chunk.length;
        inFlight.add(workerPool.run(chunk, config.hashRounds));

        if (inFlight.size >= maxInFlight) {
          await waitForOne();
        }
      }

      while (inFlight.size > 0) {
        await waitForOne();
      }

      const totalTimeMs = performance.now() - start;
      const totalRows = loader.countRows();

      if (totalRowsInserted !== totalRowsRead) {
        throw new Error(
          `Inserted rows mismatch. Read ${totalRowsRead} rows, inserted ${totalRowsInserted} rows.`,
        );
      }

      if (totalRows !== totalRowsInserted) {
        throw new Error(
          `Inserted rows mismatch. Read ${totalRowsRead} rows, inserted ${totalRows} rows.`,
        );
      }

      const result: BenchmarkResult = {
        mode: 'worker-pool',
        totalRows,
        workers: config.workers,
        chunkSize: config.chunkSize,
        batchSize: config.batchSize,
        hashRounds: config.hashRounds,
        totalTimeMs,
        rowsPerSecond: totalRows / (totalTimeMs / 1000),
        sqliteDatabasePath: config.db,
        benchmarkResultPath: metricsRecorder.getCsvPath(),
        createdAt: new Date().toISOString(),
      };

      await metricsRecorder.record(result);

      return result;
    } finally {
      await workerPool.shutdown();
      database.close();
    }
  }
}
