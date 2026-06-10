import { RawCsvRow } from '../domain/RawCsvRow';
import { TransformedRow } from '../domain/TransformedRow';
import { DateParser } from '../utils/DateParser';
import { HashService } from '../utils/HashService';
import { NameSanitizer } from '../utils/NameSanitizer';

export class DataTransformer {
  constructor(
    private readonly nameSanitizer = new NameSanitizer(),
    private readonly dateParser = new DateParser(),
    private readonly hashService = new HashService(),
  ) {}

  transformRows(rows: RawCsvRow[], hashRounds: number): TransformedRow[] {
    return rows.map((row) => this.transformRow(row, hashRounds));
  }

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
