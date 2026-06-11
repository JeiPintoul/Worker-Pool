import { parentPort } from 'node:worker_threads';
import { RawCsvRow } from '../domain/RawCsvRow';
import { DataTransformer } from '../etl/DataTransformer';

interface TransformWorkerRequest {
  taskId: number;
  rows: RawCsvRow[];
  hashRounds: number;
}

// Cada Worker mantém seu próprio transformador, isolado da main thread.
const transformer = new DataTransformer();

if (!parentPort) {
  throw new Error('Transform worker must run inside a worker thread.');
}

// Este arquivo roda dentro de cada Worker, fora da main thread.
parentPort.on('message', (message: TransformWorkerRequest) => {
  try {
    // Workers apenas transformam; CSV, SQLite, métricas e gráficos ficam centralizados.
    // A mensagem traz um chunk e o número de rounds de hash configurado pela CLI.
    const rows = transformer.transformRows(message.rows, message.hashRounds);
    parentPort?.postMessage({
      // O taskId liga a resposta à tarefa enviada pelo Worker Pool.
      taskId: message.taskId,
      rows,
    });
  } catch (error) {
    parentPort?.postMessage({
      // Mesmo em erro, o taskId identifica qual Promise deve ser rejeitada.
      taskId: message.taskId,
      error: error instanceof Error ? error.message : 'Unknown worker error.',
    });
  }
});
