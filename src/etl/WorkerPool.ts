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
  // activeTask indica qual chunk está em processamento neste Worker.
  activeTask?: WorkerTask;
}

type WorkerMessage = WorkerSuccessMessage | WorkerErrorMessage;

// Pool fixo de Workers reutilizáveis para evitar criar threads a cada chunk.
export class WorkerPool {
  // A fila guarda tarefas esperando um Worker livre.
  private readonly queue: WorkerTask[] = [];
  // Cada posição representa um Worker reutilizável e seu estado atual.
  private readonly workers: WorkerState[];
  // Cada taskId permite correlacionar a resposta do Worker com a Promise original.
  private nextTaskId = 1;
  private shuttingDown = false;

  constructor(workerFilePath: string, workerCount: number) {
    this.workers = Array.from({ length: workerCount }, () => this.createWorker(workerFilePath));
  }

  // Enfileira um chunk para transformação paralela.
  // A Promise será resolvida quando o Worker devolver as linhas transformadas.
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
    // Encerra as threads de forma explícita ao final do benchmark.
    await Promise.all(this.workers.map((state) => state.worker.terminate()));
  }

  // Cria um Worker e registra os handlers que mantêm o pool consistente.
  private createWorker(workerFilePath: string): WorkerState {
    const state: WorkerState = {
      worker: new Worker(workerFilePath),
    };

    // Eventos do Worker sempre voltam para a main thread.
    state.worker.on('message', (message: unknown) => this.handleMessage(state, message));
    state.worker.on('error', (error) => this.failPool(error));
    state.worker.on('exit', (code) => {
      if (!this.shuttingDown && code !== 0) {
        this.failPool(new Error(`Worker exited with code ${code}.`));
      }
    });

    return state;
  }

  // Despacha tarefas da fila para Workers sem activeTask.
  // Isso mantém o número de Workers fixo e reaproveita as threads existentes.
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
      // A activeTask registra qual Promise será resolvida quando este Worker responder.
      state.worker.postMessage({
        taskId: task.id,
        rows: task.rows,
        hashRounds: task.hashRounds,
      });
    }
  }

  // Resolve ou rejeita somente a tarefa que corresponde ao taskId recebido.
  // Uma resposta com taskId inesperado indica erro de correlação entre request e response.
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

  // Falha todas as tarefas pendentes para evitar Promises presas em deadlock silencioso.
  // Sem isso, uma falha de Worker poderia deixar o runner esperando para sempre.
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

  // Garante que mensagens vindas de Workers tenham o formato mínimo esperado.
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
