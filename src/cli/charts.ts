import { Command } from 'commander';
import { DEFAULT_RESULTS_DIR } from '../config/BenchmarkConfig';
import { ChartGenerator } from '../infrastructure/ChartGenerator';

async function main(): Promise<void> {
  const program = new Command();

  program
    .name('charts')
    .description('Generate benchmark comparison chart images.')
    .option('--output-dir <path>', 'benchmark results output directory', DEFAULT_RESULTS_DIR);

  program.parse();
  const options = program.opts<{ outputDir: string }>();
  const chartPaths = await new ChartGenerator().generate(options.outputDir);

  console.log(`Charts generated: ${chartPaths.join(', ')}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
