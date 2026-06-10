import BetterSqlite3 from 'better-sqlite3';
import { TransformedRow } from '../domain/TransformedRow';

export class SqliteLoader {
  constructor(private readonly db: BetterSqlite3.Database) {}

  createSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS etl_records (
        id INTEGER PRIMARY KEY,
        nome_cliente_original TEXT NOT NULL,
        nome_cliente_normalizado TEXT NOT NULL,
        data_original TEXT NOT NULL,
        data_iso TEXT NOT NULL,
        valor_centavos INTEGER NOT NULL,
        valor_reais REAL NOT NULL,
        hash_seguro TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS benchmark_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mode TEXT NOT NULL,
        total_rows INTEGER NOT NULL,
        workers INTEGER NOT NULL,
        chunk_size INTEGER NOT NULL,
        batch_size INTEGER NOT NULL,
        hash_rounds INTEGER NOT NULL,
        total_time_ms REAL NOT NULL,
        rows_per_second REAL NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
  }

  insertRows(rows: TransformedRow[], batchSize: number): void {
    const insert = this.db.prepare(`
      INSERT INTO etl_records (
        id,
        nome_cliente_original,
        nome_cliente_normalizado,
        data_original,
        data_iso,
        valor_centavos,
        valor_reais,
        hash_seguro
      ) VALUES (
        @id,
        @nomeClienteOriginal,
        @nomeClienteNormalizado,
        @dataOriginal,
        @dataIso,
        @valorCentavos,
        @valorReais,
        @hashSeguro
      )
    `);

    const insertBatch = this.db.transaction((batch: TransformedRow[]) => {
      for (const row of batch) {
        insert.run(row);
      }
    });

    for (let index = 0; index < rows.length; index += batchSize) {
      insertBatch(rows.slice(index, index + batchSize));
    }
  }

  countRows(): number {
    const row = this.db.prepare('SELECT COUNT(*) AS count FROM etl_records').get() as {
      count: number;
    };

    return row.count;
  }
}
