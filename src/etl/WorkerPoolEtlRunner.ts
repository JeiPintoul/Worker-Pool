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

// Execução paralela: Workers transformam chunks, mas a main thread lê CSV e escreve no SQLite.
// A diferença para o baseline está só na etapa Transform, que vira trabalho paralelo.
export class WorkerPoolEtlRunner {
  constructor(private readonly csvChunkReader = new CsvChunkReader()) {}

  // Orquestra Extract, Transform paralelo e Load centralizado.
  async run(config: BenchmarkConfig): Promise<BenchmarkResult> {
    const database = await Database.open(config.db, config.resetDatabase);
    const workerPath = path.resolve(__dirname, '../workers/transformWorker.js');
    const workerPool = new WorkerPool(workerPath, config.workers);

    try {
      const loader = new SqliteLoader(database.getConnection());
      loader.createSchema();

      const metricsRecorder = new MetricsRecorder(database.getConnection(), config.outputDir);
      const start = performance.now();
      // Tarefas já enviadas aos Workers, mas ainda não inseridas no SQLite.
      // A Promise carrega o resultado futuro de um chunk transformado.
      const inFlight = new Set<Promise<TransformedRow[]>>();
      // Mantém os Workers ocupados sem acumular chunks demais na memória.
      // O limite reduz pressão de memória quando o CSV é maior que a capacidade de processamento.
      const maxInFlight = Math.max(config.workers * 2, 1);
      let totalRowsRead = 0;
      let totalRowsInserted = 0;

      const waitForOne = async (): Promise<void> => {
        // Espera o primeiro Worker terminar para liberar memória e gravar o batch.
        // Promise.race evita esperar todos os chunks pendentes para continuar o Load.
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
        // Mesmo no modo paralelo, a inserção do chunk concluído ocorre na main thread.
        totalRowsInserted += completed.rows.length;
      };

      // Chunks são unidades de trabalho dos Workers; batches são blocos de insert no SQLite.
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

      // Garante comparação justa com a execução single-thread.
      // Se alguma linha sumir ou duplicar, a métrica de performance fica inválida.
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
      // Mesmo com erro, encerra Workers para não deixar threads vivas.
      // O banco também é fechado aqui para liberar o arquivo SQLite.
      await workerPool.shutdown();
      database.close();
    }
  }
}
