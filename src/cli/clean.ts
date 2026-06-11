import { Command } from 'commander';
import { DEFAULT_OUTPUT_DIR } from '../config/BenchmarkConfig';
import { FileSystemUtils } from '../infrastructure/FileSystemUtils';

// CLI utilitária para limpar arquivos gerados entre execuções do experimento.
async function main(): Promise<void> {
  const program = new Command();

  program
    .name('clean')
    .description('Remove generated benchmark data.')
    .option('--target <path>', 'directory to remove', DEFAULT_OUTPUT_DIR);

  program.parse();
  const options = program.opts<{ target: string }>();
  // Remove a pasta de dados, incluindo CSV, bancos SQLite, métricas e gráficos.
  await FileSystemUtils.removePath(options.target);
  console.log(`Removed ${options.target}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
