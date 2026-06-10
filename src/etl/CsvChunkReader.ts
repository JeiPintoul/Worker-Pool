import { createReadStream } from 'node:fs';
import { parse } from 'csv-parse';
import { RawCsvRow } from '../domain/RawCsvRow';

interface CsvRecord {
  id?: string;
  nome_cliente?: string;
  data_compra?: string;
  valor_centavos?: string;
}

export class CsvChunkReader {
  async *readChunks(filePath: string, chunkSize: number): AsyncGenerator<RawCsvRow[]> {
    const parser = createReadStream(filePath).pipe(
      parse({
        columns: true,
        skip_empty_lines: true,
        trim: false,
      }),
    );

    let chunk: RawCsvRow[] = [];

    for await (const record of parser as AsyncIterable<CsvRecord>) {
      chunk.push(this.toRawCsvRow(record));

      if (chunk.length >= chunkSize) {
        yield chunk;
        chunk = [];
      }
    }

    if (chunk.length > 0) {
      yield chunk;
    }
  }

  private toRawCsvRow(record: CsvRecord): RawCsvRow {
    const id = Number.parseInt(record.id ?? '', 10);
    const valorCentavos = Number.parseInt(record.valor_centavos ?? '', 10);

    if (!Number.isInteger(id) || !Number.isInteger(valorCentavos)) {
      throw new Error(`Invalid CSV record: ${JSON.stringify(record)}`);
    }

    return {
      id,
      nomeCliente: record.nome_cliente ?? '',
      dataCompra: record.data_compra ?? '',
      valorCentavos,
    };
  }
}
