import BetterSqlite3 from 'better-sqlite3';
import { existsSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { FileSystemUtils } from './FileSystemUtils';

export class Database {
  private readonly connection: BetterSqlite3.Database;

  private constructor(connection: BetterSqlite3.Database) {
    this.connection = connection;
  }

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
    connection.pragma('journal_mode = WAL');
    connection.pragma('synchronous = NORMAL');
    connection.pragma('temp_store = MEMORY');

    return new Database(connection);
  }

  getConnection(): BetterSqlite3.Database {
    return this.connection;
  }

  close(): void {
    this.connection.close();
  }
}
