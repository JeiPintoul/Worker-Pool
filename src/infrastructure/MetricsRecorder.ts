import BetterSqlite3 from 'better-sqlite3';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { BenchmarkResult } from '../domain/BenchmarkResult';
import { FileSystemUtils } from './FileSystemUtils';

// Persiste as métricas depois de cada execução do benchmark.
export class MetricsRecorder {
  constructor(
    private readonly db: BetterSqlite3.Database,
    private readonly resultsDirectory: string,
  ) {}

  // Salva cada resultado em SQLite, JSON e CSV.
  // Os três formatos atendem consultas diferentes sem repetir a execução.
  async record(result: BenchmarkResult): Promise<void> {
    this.insertSqlite(result);
    await this.appendJson(result);
    await this.appendCsv(result);
  }

  getJsonPath(): string {
    return path.join(this.resultsDirectory, 'benchmark-results.json');
  }

  getCsvPath(): string {
    return path.join(this.resultsDirectory, 'benchmark-results.csv');
  }

  // Mantém um histórico consultável no próprio banco do experimento.
  // O schema é criado pelo SqliteLoader antes da execução.
  private insertSqlite(result: BenchmarkResult): void {
    this.db
      .prepare(
        `
        INSERT INTO benchmark_results (
          mode,
          total_rows,
          workers,
          chunk_size,
          batch_size,
          hash_rounds,
          total_time_ms,
          rows_per_second,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      )
      .run(
        result.mode,
        result.totalRows,
        result.workers,
        result.chunkSize,
        result.batchSize,
        result.hashRounds,
        result.totalTimeMs,
        result.rowsPerSecond,
        result.createdAt,
      );
  }

  // O JSON é a fonte usada depois pelo gerador de gráficos.
  // Ele preserva todos os resultados para encontrar pares compatíveis.
  private async appendJson(result: BenchmarkResult): Promise<void> {
    const jsonPath = this.getJsonPath();
    await FileSystemUtils.ensureDirectoryForFile(jsonPath);

    const currentResults = existsSync(jsonPath)
      ? (JSON.parse(await readFile(jsonPath, 'utf8')) as BenchmarkResult[])
      : [];

    currentResults.push(result);
    await writeFile(jsonPath, `${JSON.stringify(currentResults, null, 2)}\n`, 'utf8');
  }

  // O CSV facilita inspeção externa em planilhas ou outras ferramentas.
  // Cada linha inclui os parâmetros do experimento junto com as métricas.
  private async appendCsv(result: BenchmarkResult): Promise<void> {
    const csvPath = this.getCsvPath();
    await FileSystemUtils.ensureDirectoryForFile(csvPath);

    const header =
      'mode,total_rows,workers,chunk_size,batch_size,hash_rounds,total_time_ms,rows_per_second,sqlite_database_path,created_at\n';
    const line = [
      result.mode,
      result.totalRows,
      result.workers,
      result.chunkSize,
      result.batchSize,
      result.hashRounds,
      result.totalTimeMs.toFixed(2),
      result.rowsPerSecond.toFixed(2),
      result.sqliteDatabasePath,
      result.createdAt,
    ]
      .map((value) => `"${String(value).replace(/"/g, '""')}"`)
      .join(',');

    const content = `${existsSync(csvPath) ? '' : header}${line}\n`;
    await writeFile(csvPath, content, { encoding: 'utf8', flag: 'a' });
  }
}
