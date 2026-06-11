// Representa a linha bruta logo após a leitura do CSV, antes da transformação.
export interface RawCsvRow {
  id: number;
  nomeCliente: string;
  dataCompra: string;
  valorCentavos: number;
}
