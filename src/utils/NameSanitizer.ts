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

  private capitalize(value: string): string {
    if (value.length === 0) {
      return value;
    }

    return `${value[0]?.toLocaleUpperCase('pt-BR') ?? ''}${value.slice(1)}`;
  }
}
