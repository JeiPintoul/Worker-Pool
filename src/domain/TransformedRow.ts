// Representa a linha pronta para carga no SQLite após normalização, data ISO e hash.
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
