import { createHash } from 'node:crypto';

// Gera o hash que torna a etapa Transform mais intensiva em CPU.
export class HashService {
  // rounds controla o peso computacional usado no benchmark.
  createSecurityHash(id: number, isoDate: string, valueReais: number, rounds: number): string {
    let payload = `${id}|${isoDate}|${valueReais.toFixed(2)}`;

    // Mais rounds aumentam o custo de CPU e evidenciam o impacto da paralelização.
    for (let index = 0; index < rounds; index += 1) {
      payload = createHash('sha256').update(payload).digest('hex');
    }

    return payload;
  }
}
