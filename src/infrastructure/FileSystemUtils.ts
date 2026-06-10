import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';

export class FileSystemUtils {
  static async ensureDirectoryForFile(filePath: string): Promise<void> {
    await mkdir(path.dirname(filePath), { recursive: true });
  }

  static async ensureDirectory(directoryPath: string): Promise<void> {
    await mkdir(directoryPath, { recursive: true });
  }

  static async removePath(targetPath: string): Promise<void> {
    await rm(targetPath, { recursive: true, force: true });
  }
}
