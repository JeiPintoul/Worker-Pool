export class DateParser {
  parseToIso(value: string): string {
    const trimmed = value.trim();
    const parts = trimmed.split(/[/-]/);

    if (parts.length !== 3) {
      throw new Error(`Unsupported date format: ${value}`);
    }

    const [first, second, third] = parts;
    const yearFirst = first?.length === 4;
    const year = Number.parseInt(yearFirst ? first : third ?? '', 10);
    const month = Number.parseInt(yearFirst ? second ?? '' : second ?? '', 10);
    const day = Number.parseInt(yearFirst ? third ?? '' : first ?? '', 10);

    if (!this.isValidDate(year, month, day)) {
      throw new Error(`Invalid date: ${value}`);
    }

    return `${this.pad(year, 4)}-${this.pad(month, 2)}-${this.pad(day, 2)}`;
  }

  private isValidDate(year: number, month: number, day: number): boolean {
    if (year < 1900 || month < 1 || month > 12 || day < 1 || day > 31) {
      return false;
    }

    const candidate = new Date(Date.UTC(year, month - 1, day));

    return (
      candidate.getUTCFullYear() === year &&
      candidate.getUTCMonth() === month - 1 &&
      candidate.getUTCDate() === day
    );
  }

  private pad(value: number, size: number): string {
    return value.toString().padStart(size, '0');
  }
}
