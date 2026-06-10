import { createHash } from 'node:crypto';

export class HashService {
  createSecurityHash(id: number, isoDate: string, valueReais: number, rounds: number): string {
    let payload = `${id}|${isoDate}|${valueReais.toFixed(2)}`;

    for (let index = 0; index < rounds; index += 1) {
      payload = createHash('sha256').update(payload).digest('hex');
    }

    return payload;
  }
}
