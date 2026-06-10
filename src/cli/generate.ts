import { createWriteStream } from 'node:fs';
import { once } from 'node:events';
import { Command } from 'commander';
import { DEFAULT_INPUT_PATH, DEFAULT_ROWS, parsePositiveInteger } from '../config/BenchmarkConfig';
import { FileSystemUtils } from '../infrastructure/FileSystemUtils';

const dirtyNames = [
  '  mARIA   sILVA  ',
  ' joAO    pEREIRA ',
  '  aNA   cAROLINA   sANTOS ',
  'cARLOS    eDUARDO  ',
  '  fERNANDA   aLMEIDA',
  ' rAFAEL   mARTINS  ',
];

async function generateCsv(rows: number, output: string): Promise<void> {
  await FileSystemUtils.ensureDirectoryForFile(output);

  const stream = createWriteStream(output, { encoding: 'utf8' });
  stream.write('id,nome_cliente,data_compra,valor_centavos\n');

  for (let id = 1; id <= rows; id += 1) {
    const line = `${id},${dirtyNames[id % dirtyNames.length]},${createDate(id)},${createValueInCents(id)}\n`;

    if (!stream.write(line)) {
      await once(stream, 'drain');
    }
  }

  stream.end();
  await once(stream, 'finish');
}

function createDate(id: number): string {
  const year = 2020 + (id % 5);
  const month = (id % 12) + 1;
  const day = (id % 28) + 1;
  const dd = day.toString().padStart(2, '0');
  const mm = month.toString().padStart(2, '0');

  switch (id % 4) {
    case 0:
      return `${dd}/${mm}/${year}`;
    case 1:
      return `${year}-${mm}-${dd}`;
    case 2:
      return `${dd}-${mm}-${year}`;
    default:
      return `${year}/${mm}/${dd}`;
  }
}

function createValueInCents(id: number): number {
  return 500 + ((id * 7919) % 250_000);
}

async function main(): Promise<void> {
  const program = new Command();

  program
    .name('generate')
    .description('Generate synthetic CSV data for the ETL benchmark.')
    .option('--rows <number>', 'number of rows to generate', String(DEFAULT_ROWS))
    .option('--output <path>', 'output CSV path', DEFAULT_INPUT_PATH);

  program.parse();
  const options = program.opts<{ rows: string; output: string }>();
  const rows = parsePositiveInteger(options.rows, 'rows');

  await generateCsv(rows, options.output);
  console.log(`Generated ${rows} rows at ${options.output}`);
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

export { generateCsv };
