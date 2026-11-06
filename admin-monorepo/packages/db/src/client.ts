import { drizzle, type MySql2Database } from 'drizzle-orm/mysql2';
import mysql, { type Pool, type PoolConnection, type ResultSetHeader } from 'mysql2/promise';

import * as schema from './schema/index.js';

/** 数据库连接参数：由调用方从环境变量读取后传入，便于在多个项目中复用。 */
export interface DatabaseOptions {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  /** 连接池上限，默认 10。 */
  connectionLimit?: number;
  /** MySQL 会话时区，默认 +08:00。 */
  timezone?: string;
}

/** 事务回调中使用的连接对象。 */
export type TransactionConnection = PoolConnection;

/**
 * 共享数据库客户端。
 *
 * - `db`：Drizzle 查询构建器，业务代码优先使用它获得类型提示；
 * - `query` / `queryOne` / `execute`：复杂聚合查询可退回参数化 SQL；
 * - `transaction`：在同一连接上开启事务。
 */
export class DatabaseClient {
  readonly pool: Pool;
  readonly db: MySql2Database<typeof schema>;

  constructor(options: DatabaseOptions) {
    this.pool = mysql.createPool({
      host: options.host,
      port: options.port,
      user: options.user,
      password: options.password,
      database: options.database,
      waitForConnections: true,
      connectionLimit: options.connectionLimit ?? 10,
      queueLimit: 0,
      timezone: options.timezone ?? '+08:00',
      // DATETIME 统一以字符串返回，避免 Node 与 MySQL 时区差异
      dateStrings: true,
    });
    this.db = drizzle(this.pool, { schema, mode: 'default' });
  }

  /** 执行参数化 SQL 查询，返回行数组。 */
  async query<T = Record<string, unknown>>(
    sql: string,
    params: readonly unknown[] = [],
  ): Promise<T[]> {
    const [rows] = await this.pool.query(sql, params as unknown[]);
    return rows as unknown as T[];
  }

  /** 执行参数化 SQL 查询并返回第一行。 */
  async queryOne<T = Record<string, unknown>>(
    sql: string,
    params: readonly unknown[] = [],
  ): Promise<T | null> {
    const rows = await this.query<T>(sql, params);
    return rows[0] ?? null;
  }

  /** 执行写操作，返回 ResultSetHeader（insertId / affectedRows）。 */
  async execute(sql: string, params: readonly unknown[] = []): Promise<ResultSetHeader> {
    const [result] = await this.pool.query(sql, params as unknown[]);
    return result as ResultSetHeader;
  }

  /** 在独立连接上执行事务；回调内应使用 queryOn / executeOn 或 conn.query。 */
  async transaction<T>(fn: (conn: TransactionConnection) => Promise<T>): Promise<T> {
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();
      const result = await fn(conn);
      await conn.commit();
      return result;
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  /** 健康检查。 */
  async ping(): Promise<void> {
    await this.pool.query('SELECT 1');
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

/** 事务连接上的参数化查询。 */
export async function queryOn<T = Record<string, unknown>>(
  conn: TransactionConnection,
  sql: string,
  params: readonly unknown[] = [],
): Promise<T[]> {
  const [rows] = await conn.query(sql, params as unknown[]);
  return rows as unknown as T[];
}

/** 事务连接上的单行查询。 */
export async function queryOneOn<T = Record<string, unknown>>(
  conn: TransactionConnection,
  sql: string,
  params: readonly unknown[] = [],
): Promise<T | null> {
  const rows = await queryOn<T>(conn, sql, params);
  return rows[0] ?? null;
}

/** 事务连接上的写操作。 */
export async function executeOn(
  conn: TransactionConnection,
  sql: string,
  params: readonly unknown[] = [],
): Promise<ResultSetHeader> {
  const [result] = await conn.query(sql, params as unknown[]);
  return result as ResultSetHeader;
}

export { schema };
