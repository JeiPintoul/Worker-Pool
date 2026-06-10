export interface TransformedRow {
  id: number;
  nomeClienteOriginal: string;
  nomeClienteNormalizado: string;
  dataOriginal: string;
  dataIso: string;
  valorCentavos: number;
  valorReais: number;
  hashSeguro: string;
}
