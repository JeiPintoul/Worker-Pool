import { performance } from 'node:perf_hooks';
import { BenchmarkConfig } from '../config/BenchmarkConfig';
import { BenchmarkResult } from '../domain/BenchmarkResult';
import { Database } from '../infrastructure/Database';
import { MetricsRecorder } from '../infrastructure/MetricsRecorder';
import { CsvChunkReader } from './CsvChunkReader';
import { DataTransformer } from './DataTransformer';
import { SqliteLoader } from './SqliteLoader';

export class SingleThreadEtlRunner {
  constructor(
    private readonly csvChunkReader = new CsvChunkReader(),
    private readonly dataTransformer = new DataTransformer(),
  ) {}

  async run(config: BenchmarkConfig): Promise<BenchmarkResult> {
    const database = await Database.open(config.db, config.resetDatabase);

    try {
      const loader = new SqliteLoader(database.getConnection());
      loader.createSchema();

      const metricsRecorder = new MetricsRecorder(database.getConnection(), config.outputDir);
      const start = performance.now();
      let totalRowsRead = 0;
      let totalRowsInserted = 0;

      for await (const chunk of this.csvChunkReader.readChunks(config.input, config.chunkSize)) {
        totalRowsRead += chunk.length;
        const transformedRows = this.dataTransformer.transformRows(chunk, config.hashRounds);
        loader.insertRows(transformedRows, config.batchSize);
        totalRowsInserted += transformedRows.length;
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
        mode: 'single-thread',
        totalRows,
        workers: 1,
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
      database.close();
    }
  }
}
