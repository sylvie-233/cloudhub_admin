import { DatabaseClient } from '@cloudhub/db';

import { env } from '../config/env.js';

/**
 * 应用级数据库实例：连接参数来自环境变量，
 * schema、连接池与事务能力由共享包 @cloudhub/db 提供。
 */
export const dbClient = new DatabaseClient({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  connectionLimit: env.DB_CONNECTION_LIMIT,
});

export const db = dbClient.db;
export const pool = dbClient.pool;

export * from '@cloudhub/db';
