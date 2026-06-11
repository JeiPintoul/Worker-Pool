import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';

// Pequenos helpers de filesystem usados por CLIs, métricas, gráficos e banco.
export class FileSystemUtils {
  // Garante a pasta pai antes de escrever CSV, JSON, PNG ou SQLite.
  static async ensureDirectoryForFile(filePath: string): Promise<void> {
    await mkdir(path.dirname(filePath), { recursive: true });
  }

  // Usado quando o caminho já representa diretamente um diretório.
  static async ensureDirectory(directoryPath: string): Promise<void> {
    await mkdir(directoryPath, { recursive: true });
  }

  // Remove artefatos gerados para permitir repetir o experimento do zero.
  static async removePath(targetPath: string): Promise<void> {
    await rm(targetPath, { recursive: true, force: true });
  }
}
