# worker-pool-etl-benchmark

Benchmark prático em TypeScript e Node.js para demonstrar a Estratégia Worker Pool em um pipeline ETL com carga de CPU.

## Objetivo

O projeto compara dois modos de execução para a mesma carga ETL:

1. Single-thread ETL
2. Worker Pool ETL usando `worker_threads` nativo

O benchmark foi projetado para demonstrar como um pool fixo de workers pode melhorar a vazão quando a fase Transform é limitada por CPU.

## Cenário ETL

O pipeline simula um fluxo corporativo de processamento de dados:

- Extract: leitura de um arquivo CSV sintético grande usando streams e chunks.
- Transform: normalização de nomes de clientes, conversão de datas, conversão de centavos para Real brasileiro e geração repetida de hashes SHA-256.
- Load: inserção das linhas transformadas no SQLite usando prepared statements e transações em lote.

Os workers executam apenas a lógica de transformação. As escritas no SQLite são centralizadas na main thread para evitar contenção de escrita concorrente e manter as transações controladas.

## Por que Worker Pool é relevante

Node.js executa JavaScript da aplicação em uma thread principal. Quando uma transformação é intensiva em CPU, essa thread pode ficar bloqueada e reduzir a vazão do pipeline. O Worker Pool distribui a fase Transform entre múltiplas threads reutilizáveis, sem criar um worker novo para cada chunk.

## Tecnologias

- TypeScript
- Node.js
- `worker_threads`
- `node:crypto` com SHA-256
- `csv-parse`
- SQLite com `better-sqlite3`
- `sharp` para geração de gráficos PNG
- ESLint e Prettier

## Estrutura do Projeto

```text
src/
  cli/                 Command-line entry points
  config/              Defaults and argument parsing helpers
  domain/              Typed data contracts
  etl/                 CSV reader, transformer, runners, worker pool, SQLite loader
  infrastructure/      Database, metrics, charts, filesystem utilities
  utils/               Date, name, and hash utilities
  workers/             Worker thread entry point
```

## Instalação

```bash
npm install
```

Em sistemas Windows PowerShell que bloqueiam `npm.ps1`, use:

```bash
npm.cmd install
```

A mesma configuração também pode ser iniciada com:

```bash
npm run install:deps
```

## Gerar Dados Sintéticos

```bash
npm run generate -- --rows 500000 --output data/input.csv
```

O arquivo gerado contém:

```text
id,nome_cliente,data_compra,valor_centavos
```

Os nomes incluem espaços extras e letras com caixa misturada. As datas usam formatos variados, como `dd/mm/yyyy`, `yyyy-mm-dd`, `dd-mm-yyyy` e `yyyy/mm/dd`.

## Executar Benchmark Single-Thread

```bash
npm run benchmark:single -- --input data/input.csv --db data/single-thread.db --chunk-size 5000 --batch-size 5000 --hash-rounds 100
```

## Executar Benchmark Worker Pool

```bash
npm run benchmark:pool -- --input data/input.csv --db data/worker-pool.db --workers 4 --chunk-size 5000 --batch-size 5000 --hash-rounds 100
```

## Executar Comparação Completa

```bash
npm run benchmark:all -- --rows 500000 --workers 4 --chunk-size 5000 --batch-size 5000 --hash-rounds 100
```

Esse comando gera o arquivo CSV, executa os dois modos de benchmark, persiste os resultados e gera os gráficos.

## Gerar Gráficos

```bash
npm run charts
```

Arquivos gerados:

- `data/results/total-time-comparison.png`
- `data/results/rows-per-second-comparison.png`

Os gráficos são gerados apenas quando existe um par compatível de resultados para `single-thread` e `worker-pool` com o mesmo `total_rows`, `chunk_size`, `batch_size` e `hash_rounds`.

## Parâmetros de Configuração

| Parâmetro | Descrição | Padrão |
| --- | --- | --- |
| `--rows` | Quantidade de linhas do CSV sintético | `500000` |
| `--input` | Caminho do CSV de entrada | `data/input.csv` |
| `--db` | Caminho do banco SQLite para um modo de benchmark | específico do modo |
| `--single-db` | Caminho SQLite para single-thread na comparação completa | `data/single-thread.db` |
| `--pool-db` | Caminho SQLite para worker-pool na comparação completa | `data/worker-pool.db` |
| `--output-dir` | Diretório de resultados e gráficos | `data/results` |
| `--workers` | Quantidade de worker threads | `4` |
| `--chunk-size` | Linhas do CSV por chunk de processamento | `5000` |
| `--batch-size` | Tamanho do lote de inserção no SQLite | `5000` |
| `--hash-rounds` | Rodadas de SHA-256 por linha | `100` |
| `--no-reset-database` | Mantém as linhas existentes no banco | desabilitado por padrão |

## Saídas Esperadas

Cada benchmark imprime:

- Mode
- Total processed rows
- Workers
- Chunk size
- Batch size
- Hash rounds
- Total time
- Rows per second
- SQLite database path
- Benchmark result path

Os resultados são persistidos em:

- Tabela SQLite `benchmark_results`
- `data/results/benchmark-results.csv`
- `data/results/benchmark-results.json`

As linhas ETL transformadas são armazenadas na tabela SQLite `etl_records`.

## Notas para Demonstração em Sala

Use uma quantidade menor de linhas em demonstrações ao vivo quando o tempo for limitado:

```bash
npm run benchmark:all -- --rows 100000 --workers 4 --chunk-size 5000 --batch-size 5000 --hash-rounds 100
```

Aumente `--hash-rounds` para tornar a fase Transform mais intensiva em CPU. A versão Worker Pool tende a se beneficiar mais conforme o custo de CPU por linha aumenta.

## Limitações

- Os resultados dependem da quantidade de núcleos de CPU, throttling térmico, velocidade de armazenamento e outros processos em execução.
- O overhead do Worker Pool pode reduzir os ganhos quando a fase Transform é leve.
- SQLite é usado como alvo local de benchmark, não como banco distribuído.
- O benchmark prioriza clareza acadêmica em vez de recursos de ETL de produção, como retries, evolução de schema e dead-letter queues.

## Interpretação Sugerida

A Estratégia Worker Pool é útil quando uma transformação intensiva em CPU bloqueia o event loop do Node.js. Este benchmark mantém Extract e Load controlados na main thread enquanto paraleliza apenas a fase Transform, tornando a comparação focada e adequada para um seminário de Programação Paralela.
