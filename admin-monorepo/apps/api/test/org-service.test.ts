import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/db/index.js', async () => {
  const { createDbMockModule } = await import('./helpers.js');
  return createDbMockModule();
});

import { dbClient } from '../src/db/index.js';
import {
  getOrgAncestorIds,
  getOrgDescendantIds,
  getOrgPathMap,
} from '../src/services/org.service.js';
import { asDbMock } from './helpers.js';

const db = asDbMock(dbClient);

beforeEach(() => {
  db.query.mockReset();
  db.queryOne.mockReset();
});

describe('组织路径', () => {
  it('拼接从根到自身的完整路径', async () => {
    db.query.mockResolvedValueOnce([
      { orgId: 100, orgName: '云枢科技集团', parentId: 0 },
      { orgId: 101, orgName: '深圳总部', parentId: 100 },
      { orgId: 103, orgName: '研发中心', parentId: 101 },
      { orgId: 102, orgName: '长沙分公司', parentId: 100 },
    ]);

    const paths = await getOrgPathMap();

    expect(paths.get(100)).toBe('云枢科技集团');
    expect(paths.get(101)).toBe('云枢科技集团 / 深圳总部');
    expect(paths.get(103)).toBe('云枢科技集团 / 深圳总部 / 研发中心');
    expect(paths.get(102)).toBe('云枢科技集团 / 长沙分公司');
  });

  it('父子关系成环时不会无限递归', async () => {
    db.query.mockResolvedValueOnce([
      { orgId: 1, orgName: 'A', parentId: 2 },
      { orgId: 2, orgName: 'B', parentId: 1 },
    ]);

    const paths = await getOrgPathMap();

    expect(paths.get(1)).toBeTypeOf('string');
    expect(paths.get(2)).toBeTypeOf('string');
    expect(paths.size).toBe(2);
  });
});

describe('组织层级', () => {
  it('祖级链过滤掉根节点 0，只保留正整数', async () => {
    db.queryOne.mockResolvedValueOnce({ ancestors: '0,100,101' });

    const ids = await getOrgAncestorIds(103);

    expect(ids).toEqual([100, 101]);
  });

  it('组织不存在时祖级链为空', async () => {
    db.queryOne.mockResolvedValueOnce(null);

    const ids = await getOrgAncestorIds(999);

    expect(ids).toEqual([]);
  });

  it('下级组织包含自身', async () => {
    db.query.mockResolvedValueOnce([{ orgId: 100 }, { orgId: 101 }]);

    const ids = await getOrgDescendantIds(100);

    expect(ids).toEqual([100, 101]);
    expect(db.query.mock.calls[0]?.[1]).toEqual([100, 100]);
  });
});
