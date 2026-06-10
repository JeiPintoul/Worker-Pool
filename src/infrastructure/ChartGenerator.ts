import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { BenchmarkResult } from '../domain/BenchmarkResult';
import { FileSystemUtils } from './FileSystemUtils';

interface ChartItem {
  label: string;
  value: number;
}

export class ChartGenerator {
  async generate(resultsDirectory: string): Promise<string[]> {
    const results = await this.loadLatestResults(resultsDirectory);
    const totalTimePath = path.join(resultsDirectory, 'total-time-comparison.png');
    const rowsPerSecondPath = path.join(resultsDirectory, 'rows-per-second-comparison.png');

    await this.renderBarChart(
      totalTimePath,
      'Total execution time',
      'Milliseconds',
      [
        { label: 'Single-thread', value: results.single.totalTimeMs },
        { label: 'Worker Pool', value: results.pool.totalTimeMs },
      ],
    );

    await this.renderBarChart(
      rowsPerSecondPath,
      'Processed rows per second',
      'Rows/s',
      [
        { label: 'Single-thread', value: results.single.rowsPerSecond },
        { label: 'Worker Pool', value: results.pool.rowsPerSecond },
      ],
    );

    return [totalTimePath, rowsPerSecondPath];
  }

  private async loadLatestResults(resultsDirectory: string): Promise<{
    single: BenchmarkResult;
    pool: BenchmarkResult;
  }> {
    const jsonPath = path.join(resultsDirectory, 'benchmark-results.json');

    if (!existsSync(jsonPath)) {
      throw new Error(`Benchmark results file not found: ${jsonPath}`);
    }

    const results = JSON.parse(await readFile(jsonPath, 'utf8')) as BenchmarkResult[];
    const compatiblePair = this.findLatestCompatiblePair(results);

    if (!compatiblePair) {
      throw new Error(
        'Chart generation requires compatible benchmark results for both modes with the same total_rows, chunk_size, batch_size, and hash_rounds.',
      );
    }

    return compatiblePair;
  }

  private findLatestCompatiblePair(
    results: BenchmarkResult[],
  ): { single: BenchmarkResult; pool: BenchmarkResult } | undefined {
    const singleResults = results.filter((result) => result.mode === 'single-thread');
    const poolResults = results.filter((result) => result.mode === 'worker-pool');

    return singleResults
      .flatMap((single) =>
        poolResults
          .filter((pool) => this.areCompatible(single, pool))
          .map((pool) => ({ single, pool })),
      )
      .sort((left, right) => {
        const leftNewest = Math.max(Date.parse(left.single.createdAt), Date.parse(left.pool.createdAt));
        const rightNewest = Math.max(
          Date.parse(right.single.createdAt),
          Date.parse(right.pool.createdAt),
        );

        if (rightNewest !== leftNewest) {
          return rightNewest - leftNewest;
        }

        const leftOldest = Math.min(Date.parse(left.single.createdAt), Date.parse(left.pool.createdAt));
        const rightOldest = Math.min(Date.parse(right.single.createdAt), Date.parse(right.pool.createdAt));

        return rightOldest - leftOldest;
      })[0];
  }

  private areCompatible(single: BenchmarkResult, pool: BenchmarkResult): boolean {
    return (
      single.totalRows === pool.totalRows &&
      single.chunkSize === pool.chunkSize &&
      single.batchSize === pool.batchSize &&
      single.hashRounds === pool.hashRounds
    );
  }

  private async renderBarChart(
    filePath: string,
    title: string,
    axisLabel: string,
    items: ChartItem[],
  ): Promise<void> {
    await FileSystemUtils.ensureDirectoryForFile(filePath);

    const width = 1280;
    const height = 720;
    const plotTop = 130;
    const plotBottom = 590;
    const plotLeft = 150;
    const maxValue = Math.max(...items.map((item) => item.value), 1);
    const barWidth = 260;
    const colors = ['#2563eb', '#16a34a'];

    const bars = items
      .map((item, index) => {
        const x = plotLeft + index * 430;
        const barHeight = Math.max((item.value / maxValue) * (plotBottom - plotTop), 2);
        const y = plotBottom - barHeight;

        return `
          <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" fill="${colors[index] ?? '#334155'}" rx="6" />
          <text x="${x + barWidth / 2}" y="${y - 18}" text-anchor="middle" font-size="30" font-weight="700" fill="#111827">${this.formatNumber(item.value)}</text>
          <text x="${x + barWidth / 2}" y="${plotBottom + 54}" text-anchor="middle" font-size="30" fill="#111827">${this.escape(item.label)}</text>
        `;
      })
      .join('');

    const svg = `
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="${width}" height="${height}" fill="#ffffff"/>
        <text x="64" y="72" font-size="44" font-weight="700" fill="#111827">${this.escape(title)}</text>
        <text x="64" y="112" font-size="24" fill="#475569">${this.escape(axisLabel)}</text>
        <line x1="${plotLeft - 30}" y1="${plotBottom}" x2="${width - 90}" y2="${plotBottom}" stroke="#94a3b8" stroke-width="3"/>
        <line x1="${plotLeft - 30}" y1="${plotTop}" x2="${plotLeft - 30}" y2="${plotBottom}" stroke="#94a3b8" stroke-width="3"/>
        ${bars}
      </svg>
    `;

    await sharp(Buffer.from(svg)).png().toFile(filePath);
  }

  private formatNumber(value: number): string {
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 2,
    }).format(value);
  }

  private escape(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
