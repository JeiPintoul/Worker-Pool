import { Worker } from 'node:worker_threads';
import { RawCsvRow } from '../domain/RawCsvRow';
import { TransformedRow } from '../domain/TransformedRow';

interface WorkerTask {
  id: number;
  rows: RawCsvRow[];
  hashRounds: number;
  resolve: (rows: TransformedRow[]) => void;
  reject: (error: Error) => void;
}

interface WorkerSuccessMessage {
  taskId: number;
  rows: TransformedRow[];
}

interface WorkerErrorMessage {
  taskId: number;
  error: string;
}

interface WorkerState {
  worker: Worker;
  activeTask?: WorkerTask;
}

type WorkerMessage = WorkerSuccessMessage | WorkerErrorMessage;

export class WorkerPool {
  private readonly queue: WorkerTask[] = [];
  private readonly workers: WorkerState[];
  private nextTaskId = 1;
  private shuttingDown = false;

  constructor(workerFilePath: string, workerCount: number) {
    this.workers = Array.from({ length: workerCount }, () => this.createWorker(workerFilePath));
  }

  run(rows: RawCsvRow[], hashRounds: number): Promise<TransformedRow[]> {
    if (this.shuttingDown) {
      return Promise.reject(new Error('Worker pool is shutting down.'));
    }

    return new Promise((resolve, reject) => {
      this.queue.push({
        id: this.nextTaskId,
        rows,
        hashRounds,
        resolve,
        reject,
      });
      this.nextTaskId += 1;
      this.dispatch();
    });
  }

  async shutdown(): Promise<void> {
    this.shuttingDown = true;
    await Promise.all(this.workers.map((state) => state.worker.terminate()));
  }

  private createWorker(workerFilePath: string): WorkerState {
    const state: WorkerState = {
      worker: new Worker(workerFilePath),
    };

    state.worker.on('message', (message: unknown) => this.handleMessage(state, message));
    state.worker.on('error', (error) => this.failPool(error));
    state.worker.on('exit', (code) => {
      if (!this.shuttingDown && code !== 0) {
        this.failPool(new Error(`Worker exited with code ${code}.`));
      }
    });

    return state;
  }

  private dispatch(): void {
    for (const state of this.workers) {
      if (state.activeTask || this.queue.length === 0) {
        continue;
      }

      const task = this.queue.shift();

      if (!task) {
        return;
      }

      state.activeTask = task;
      state.worker.postMessage({
        taskId: task.id,
        rows: task.rows,
        hashRounds: task.hashRounds,
      });
    }
  }

  private handleMessage(state: WorkerState, message: unknown): void {
    const task = state.activeTask;

    if (!task) {
      this.failPool(new Error('Worker returned a message without an active task.'));
      return;
    }

    state.activeTask = undefined;

    if (!this.isWorkerMessage(message) || message.taskId !== task.id) {
      task.reject(new Error('Worker returned an invalid task response.'));
      this.dispatch();
      return;
    }

    if ('error' in message) {
      task.reject(new Error(message.error));
      this.dispatch();
      return;
    }

    task.resolve(message.rows);
    this.dispatch();
  }

  private failPool(error: Error): void {
    this.shuttingDown = true;

    for (const state of this.workers) {
      state.activeTask?.reject(error);
      state.activeTask = undefined;
    }

    while (this.queue.length > 0) {
      this.queue.shift()?.reject(error);
    }
  }

  private isWorkerMessage(message: unknown): message is WorkerMessage {
    if (typeof message !== 'object' || message === null) {
      return false;
    }

    const candidate = message as Partial<WorkerSuccessMessage & WorkerErrorMessage>;
    const hasTaskId = Number.isInteger(candidate.taskId);
    const hasRows = Array.isArray(candidate.rows);
    const hasError = typeof candidate.error === 'string';

    return hasTaskId && (hasRows || hasError);
  }
}
