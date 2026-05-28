import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ClickHouseService implements OnModuleInit {
  private readonly logger = new Logger(ClickHouseService.name);
  private url!: string;
  private user!: string;
  private password!: string;
  private database!: string;
  private isAvailable = false;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    const host = this.config.get<string>('CLICKHOUSE_HOST');
    if (!host) {
      this.logger.warn(
        'CLICKHOUSE_HOST не задан. Сервис аналитики переведён в режим Postgres-fallback.',
      );
      return;
    }

    const port = this.config.get<string>('CLICKHOUSE_PORT', '8123');
    const protocol = this.config.get<string>('CLICKHOUSE_PROTOCOL', 'http');
    this.url = `${protocol}://${host}:${port}`;
    this.user = this.config.get<string>('CLICKHOUSE_USER', 'default');
    this.password = this.config.get<string>('CLICKHOUSE_PASSWORD', '');
    this.database = this.config.get<string>('CLICKHOUSE_DB', 'default');

    try {
      const res = await fetch(`${this.url}/ping`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        this.isAvailable = true;
        this.logger.log(`Успешно подключено к ClickHouse DWH: ${this.url}`);
      } else {
        this.logger.warn(`ClickHouse DWH пинг вернул ошибку: ${res.status}. Fallback включен.`);
      }
    } catch (err: any) {
      this.logger.warn(
        `Не удалось подключиться к ClickHouse DWH (${err.message}). Включен Postgres-fallback.`,
      );
    }
  }

  /**
   * Проверка доступности DWH ClickHouse
   */
  isEnabled(): boolean {
    return this.isAvailable;
  }

  /**
   * Выполнение SQL-запроса в ClickHouse
   */
  async query<T>(sql: string): Promise<T[]> {
    if (!this.isAvailable) {
      return [];
    }

    const queryUrl = `${this.url}/?database=${this.database}&default_format=JSON`;
    try {
      const res = await fetch(queryUrl, {
        method: 'POST',
        headers: {
          'X-ClickHouse-User': this.user,
          'X-ClickHouse-Key': this.password,
          'Content-Type': 'text/plain',
        },
        body: sql,
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`ClickHouse query error: ${res.status} ${errText}`);
      }

      const body = await res.json();
      return (body.data as T[]) || [];
    } catch (err: any) {
      this.logger.error(`Ошибка при выполнении запроса в ClickHouse: ${err.message}`);
      throw err;
    }
  }

  /**
   * Пакетная запись данных в ClickHouse
   */
  async write(table: string, rows: any[]): Promise<void> {
    if (!this.isAvailable || rows.length === 0) {
      return;
    }

    const queryUrl = `${this.url}/?query=INSERT+INTO+${table}+FORMAT+JSONEachRow&database=${this.database}`;
    const payload = rows.map((r) => JSON.stringify(r)).join('\n');

    try {
      const res = await fetch(queryUrl, {
        method: 'POST',
        headers: {
          'X-ClickHouse-User': this.user,
          'X-ClickHouse-Key': this.password,
          'Content-Type': 'application/x-ndjson',
        },
        body: payload,
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`ClickHouse insert error: ${res.status} ${errText}`);
      }
    } catch (err: any) {
      this.logger.error(`Ошибка записи в таблицу ClickHouse ${table}: ${err.message}`);
      throw err;
    }
  }
}
