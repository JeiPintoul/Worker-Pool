import BetterSqlite3 from 'better-sqlite3';
import { existsSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { FileSystemUtils } from './FileSystemUtils';

// Centraliza abertura, reset e fechamento do SQLite usado pelo benchmark.
export class Database {
  private readonly connection: BetterSqlite3.Database;

  private constructor(connection: BetterSqlite3.Database) {
    this.connection = connection;
  }

  // reset remove também arquivos auxiliares do WAL para começar uma execução limpa.
  static async open(filePath: string, reset: boolean): Promise<Database> {
    await FileSystemUtils.ensureDirectory(path.dirname(filePath));

    if (reset) {
      for (const targetPath of [filePath, `${filePath}-wal`, `${filePath}-shm`]) {
        if (existsSync(targetPath)) {
          unlinkSync(targetPath);
        }
      }
    }

    const connection = new BetterSqlite3(filePath);
    // Pragmas escolhidos para reduzir overhead de escrita sem mudar a lógica do ETL.
    connection.pragma('journal_mode = WAL');
    connection.pragma('synchronous = NORMAL');
    connection.pragma('temp_store = MEMORY');

    return new Database(connection);
  }

  // Expõe a conexão para loaders e gravadores de métricas compartilharem o mesmo banco.
  getConnection(): BetterSqlite3.Database {
    return this.connection;
  }

  // Fecha o arquivo SQLite ao final da execução.
  close(): void {
    this.connection.close();
  }
}
