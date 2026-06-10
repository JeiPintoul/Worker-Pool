import path from 'node:path';
import { BenchmarkMode } from '../domain/BenchmarkResult';

export const DEFAULT_ROWS = 500_000;
export const DEFAULT_WORKERS = 4;
export const DEFAULT_CHUNK_SIZE = 5_000;
export const DEFAULT_BATCH_SIZE = 5_000;
export const DEFAULT_HASH_ROUNDS = 100;
export const DEFAULT_OUTPUT_DIR = 'data';
export const DEFAULT_RESULTS_DIR = path.join(DEFAULT_OUTPUT_DIR, 'results');
export const DEFAULT_INPUT_PATH = path.join(DEFAULT_OUTPUT_DIR, 'input.csv');
export const DEFAULT_SINGLE_DB_PATH = path.join(DEFAULT_OUTPUT_DIR, 'single-thread.db');
export const DEFAULT_POOL_DB_PATH = path.join(DEFAULT_OUTPUT_DIR, 'worker-pool.db');

export interface GenerateConfig {
  rows: number;
  output: string;
}

export interface BenchmarkConfig {
  mode: BenchmarkMode;
  input: string;
  db: string;
  outputDir: string;
  workers: number;
  chunkSize: number;
  batchSize: number;
  hashRounds: number;
  resetDatabase: boolean;
}

export interface AllBenchmarkConfig {
  rows: number;
  input: string;
  outputDir: string;
  singleDb: string;
  poolDb: string;
  workers: number;
  chunkSize: number;
  batchSize: number;
  hashRounds: number;
  resetDatabase: boolean;
}

export function parsePositiveInteger(value: string, name: string): number {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return parsed;
}

export function parseBoolean(value: string): boolean {
  return ['1', 'true', 'yes', 'y'].includes(value.trim().toLowerCase());
}
