import { formatDate } from '@cloudhub/utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/db/index.js', async () => {
  const { createDbMockModule } = await import('./helpers.js');
  return createDbMockModule();
});

import { dbClient } from '../src/db/index.js';
import { generateBizCode } from '../src/utils/code.js';
import { asDbMock } from './helpers.js';

const db = asDbMock(dbClient);

beforeEach(() => {
  db.queryOne.mockReset();
});

describe('业务编码生成', () => {
  it('组织编码使用 ZZ + yyyymmdd + 6 位序列号', async () => {
    db.queryOne.mockResolvedValueOnce(null);

    const code = await generateBizCode('org');
    const datePart = formatDate().replaceAll('-', '');
    const [sql, params] = db.queryOne.mock.calls[0] as [string, unknown[]];

    expect(code).toBe(`ZZ${datePart}000001`);
    expect(code).toMatch(/^ZZ\d{8}\d{6}$/);
    expect(sql).toContain('sys_org');
    expect(params[0]).toBe(`ZZ${datePart}%`);
  });

  it('岗位编码使用 GW 前缀', async () => {
    db.queryOne.mockResolvedValueOnce(null);

    const code = await generateBizCode('post');
    const datePart = formatDate().replaceAll('-', '');

    expect(code).toBe(`GW${datePart}000001`);
    expect(code).toMatch(/^GW\d{8}\d{6}$/);
  });

  it('在当天最大编码基础上递增', async () => {
    const prefix = `GW${formatDate().replaceAll('-', '')}`;
    db.queryOne.mockResolvedValueOnce({ maxCode: `${prefix}000009` });

    const code = await generateBizCode('post');

    expect(code).toBe(`${prefix}000010`);
  });

  it('历史编码格式异常时回到序列 1', async () => {
    const prefix = `ZZ${formatDate().replaceAll('-', '')}`;
    db.queryOne.mockResolvedValueOnce({ maxCode: `${prefix}ABC` });

    const code = await generateBizCode('org');

    expect(code).toBe(`${prefix}000001`);
  });
});
