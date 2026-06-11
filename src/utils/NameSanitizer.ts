// Normaliza nomes sintéticos para simular limpeza de dados no ETL.
export class NameSanitizer {
  sanitize(value: string): string {
    return value
      .trim()
      .replace(/\s+/g, ' ')
      .toLocaleLowerCase('pt-BR')
      .split(' ')
      .map((part) => this.capitalize(part))
      .join(' ');
  }

  // Ajusta cada parte do nome após trim, compactação de espaços e lowercase.
  private capitalize(value: string): string {
    if (value.length === 0) {
      return value;
    }

    return `${value[0]?.toLocaleUpperCase('pt-BR') ?? ''}${value.slice(1)}`;
  }
}
