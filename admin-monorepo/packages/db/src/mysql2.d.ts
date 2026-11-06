/**
 * mysql2 3.24 的 promise 类型在 TypeScript 5.x 下无法正确展开
 * QueryableBase 混入（Pool / PoolConnection 丢失 query 方法）。
 * 这里补齐参数化查询签名，运行时行为不受影响。
 */
declare module 'mysql2/promise' {
  interface Pool {
    query<T = unknown>(sql: string, params?: unknown[]): Promise<[T, unknown[]]>;
  }

  interface PoolConnection {
    query<T = unknown>(sql: string, params?: unknown[]): Promise<[T, unknown[]]>;
  }
}

export {};
