import { vi } from 'vitest';

export type MockFn = ReturnType<typeof vi.fn>;

/** 被 mock 的 dbClient 形态，便于在测试中断言调用。 */
export interface DbMockClient {
  query: MockFn;
  queryOne: MockFn;
  execute: MockFn;
  transaction: MockFn;
  ping: MockFn;
}

export function asDbMock(client: unknown): DbMockClient {
  return client as DbMockClient;
}

/** 服务层测试统一替换 db 模块，避免建立真实 MySQL 连接。 */
export function createDbMockModule() {
  return {
    dbClient: {
      query: vi.fn(),
      queryOne: vi.fn(),
      execute: vi.fn(),
      transaction: vi.fn(),
      ping: vi.fn(),
    },
    db: {},
    pool: {},
    executeOn: vi.fn(),
    queryOn: vi.fn(),
    queryOneOn: vi.fn(),
  };
}
