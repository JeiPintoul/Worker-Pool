import { RawCsvRow } from '../domain/RawCsvRow';
import { TransformedRow } from '../domain/TransformedRow';
import { DateParser } from '../utils/DateParser';
import { HashService } from '../utils/HashService';
import { NameSanitizer } from '../utils/NameSanitizer';

// Etapa Transform: normaliza campos e calcula o hash pesado usado no benchmark.
export class DataTransformer {
  constructor(
    private readonly nameSanitizer = new NameSanitizer(),
    private readonly dateParser = new DateParser(),
    private readonly hashService = new HashService(),
  ) {}

  // A mesma transformação é usada na linha de base e dentro dos Workers.
  transformRows(rows: RawCsvRow[], hashRounds: number): TransformedRow[] {
    return rows.map((row) => this.transformRow(row, hashRounds));
  }

  // Concentra a etapa de transformação usada tanto no baseline quanto nos Workers.
  private transformRow(row: RawCsvRow, hashRounds: number): TransformedRow {
    const dataIso = this.dateParser.parseToIso(row.dataCompra);
    const valorReais = row.valorCentavos / 100;

    return {
      id: row.id,
      nomeClienteOriginal: row.nomeCliente,
      nomeClienteNormalizado: this.nameSanitizer.sanitize(row.nomeCliente),
      dataOriginal: row.dataCompra,
      dataIso,
      valorCentavos: row.valorCentavos,
      valorReais,
      hashSeguro: this.hashService.createSecurityHash(row.id, dataIso, valorReais, hashRounds),
    };
  }
}
