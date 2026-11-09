import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/db/index.js', async () => {
  const { createDbMockModule } = await import('./helpers.js');
  return createDbMockModule();
});

import { dbClient } from '../src/db/index.js';
import { resolveDataScope } from '../src/services/permission.service.js';
import { asDbMock } from './helpers.js';

const db = asDbMock(dbClient);

beforeEach(() => {
  db.query.mockReset();
});

describe('数据范围解析', () => {
  it('无角色时兜底为仅本人', async () => {
    db.query.mockResolvedValueOnce([]);

    const result = await resolveDataScope(1);

    expect(result).toEqual({ scope: '5', mode: 'self', orgIds: [] });
    expect(db.query).toHaveBeenCalledTimes(1);
    expect(db.query.mock.calls[0]?.[1]).toEqual([1]);
  });

  it('多角色取数值最小（最宽）的一档', async () => {
    db.query.mockResolvedValueOnce([
      { roleId: 2, dataScope: '3' },
      { roleId: 3, dataScope: '1' },
      { roleId: 4, dataScope: '5' },
    ]);

    const result = await resolveDataScope(8);

    expect(result).toEqual({ scope: '1', mode: 'all', orgIds: [] });
    expect(db.query).toHaveBeenCalledTimes(1);
  });

  it('仅本人范围不再查询组织', async () => {
    db.query.mockResolvedValueOnce([{ roleId: 2, dataScope: '5' }]);

    const result = await resolveDataScope(2);

    expect(result).toEqual({ scope: '5', mode: 'self', orgIds: [] });
    expect(db.query).toHaveBeenCalledTimes(1);
  });

  it('自定义范围返回角色勾选的组织', async () => {
    db.query
      .mockResolvedValueOnce([{ roleId: 2, dataScope: '2' }])
      .mockResolvedValueOnce([{ orgId: 101 }, { orgId: 103 }]);

    const result = await resolveDataScope(3);

    expect(result).toEqual({ scope: '2', mode: 'orgs', orgIds: [101, 103] });
    expect(db.query).toHaveBeenCalledTimes(2);
  });

  it('本组织范围返回任职岗位所属组织', async () => {
    db.query
      .mockResolvedValueOnce([{ roleId: 2, dataScope: '3' }])
      .mockResolvedValueOnce([{ orgId: 100 }, { orgId: 101 }]);

    const result = await resolveDataScope(4);

    expect(result).toEqual({ scope: '3', mode: 'orgs', orgIds: [100, 101] });
    expect(db.query).toHaveBeenCalledTimes(2);
  });

  it('本组织及以下范围沿 ancestors 展开下级组织', async () => {
    db.query
      .mockResolvedValueOnce([{ roleId: 2, dataScope: '4' }])
      .mockResolvedValueOnce([{ orgId: 100 }])
      .mockResolvedValueOnce([{ orgId: 100 }, { orgId: 101 }, { orgId: 103 }]);

    const result = await resolveDataScope(5);

    expect(result).toEqual({ scope: '4', mode: 'orgs', orgIds: [100, 101, 103] });
    expect(db.query.mock.calls[2]?.[1]).toEqual([100, 100]);
  });

  it('本组织及以下但没有任职岗位时返回空组织集合', async () => {
    db.query
      .mockResolvedValueOnce([{ roleId: 2, dataScope: '4' }])
      .mockResolvedValueOnce([]);

    const result = await resolveDataScope(6);

    expect(result).toEqual({ scope: '4', mode: 'orgs', orgIds: [] });
    expect(db.query).toHaveBeenCalledTimes(2);
  });
});
