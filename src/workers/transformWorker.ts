import { parentPort } from 'node:worker_threads';
import { RawCsvRow } from '../domain/RawCsvRow';
import { DataTransformer } from '../etl/DataTransformer';

interface TransformWorkerRequest {
  taskId: number;
  rows: RawCsvRow[];
  hashRounds: number;
}

const transformer = new DataTransformer();

if (!parentPort) {
  throw new Error('Transform worker must run inside a worker thread.');
}

parentPort.on('message', (message: TransformWorkerRequest) => {
  try {
    const rows = transformer.transformRows(message.rows, message.hashRounds);
    parentPort?.postMessage({
      taskId: message.taskId,
      rows,
    });
  } catch (error) {
    parentPort?.postMessage({
      taskId: message.taskId,
      error: error instanceof Error ? error.message : 'Unknown worker error.',
    });
  }
});
