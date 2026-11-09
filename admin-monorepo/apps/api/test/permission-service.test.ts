import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/db/index.js', async () => {
  const { createDbMockModule } = await import('./helpers.js');
  return createDbMockModule();
});

import { dbClient } from '../src/db/index.js';
import {
  getPermissionSources,
  getRoleMenuIds,
  getUserMenus,
} from '../src/services/permission.service.js';
import type { MenuNavRow } from '../src/sql/permission.sql.js';
import { asDbMock } from './helpers.js';

const db = asDbMock(dbClient);

function menuRow(
  menuId: number,
  parentId: number,
  orderNum: number,
  overrides: Partial<MenuNavRow> = {},
): MenuNavRow {
  return {
    menuId,
    menuName: `菜单${menuId}`,
    parentId,
    orderNum,
    path: `menu-${menuId}`,
    component: null,
    menuType: 'C',
    status: '0',
    perms: null,
    icon: '',
    ...overrides,
  };
}

beforeEach(() => {
  db.query.mockReset();
});

describe('用户菜单树', () => {
  it('按父子关系组装并排序，孤立节点作为根', async () => {
    db.query.mockResolvedValueOnce([
      menuRow(2, 1, 2),
      menuRow(1, 0, 1, { menuType: 'M', path: 'system' }),
      menuRow(3, 1, 1),
      menuRow(4, 99, 3),
    ]);

    const menus = await getUserMenus(1);

    expect(menus.map((menu) => menu.menuId)).toEqual([1, 4]);
    expect(menus[0]?.children.map((menu) => menu.menuId)).toEqual([3, 2]);
    expect(menus[1]?.children).toEqual([]);
  });
});

describe('角色菜单', () => {
  it('超级管理员返回全量菜单', async () => {
    db.query.mockResolvedValueOnce([{ menuId: 1000 }, { menuId: 1001 }]);

    const ids = await getRoleMenuIds(1);

    expect(ids).toEqual([1000, 1001]);
    expect(db.query.mock.calls[0]?.[0]).toContain('FROM sys_menu');
  });

  it('普通角色返回已授权菜单', async () => {
    db.query.mockResolvedValueOnce([{ menuId: 1001 }, { menuId: 1002 }]);

    const ids = await getRoleMenuIds(2);

    expect(ids).toEqual([1001, 1002]);
    expect(db.query.mock.calls[0]?.[1]).toEqual([2]);
  });
});

describe('权限来源拆分', () => {
  it('按角色、岗位与组织归并并去重排序', async () => {
    db.query
      .mockResolvedValueOnce([
        {
          roleId: 2,
          roleName: '运营',
          roleKey: 'operator',
          dataScope: '3',
          menuIds: '1001,1002',
        },
      ])
      .mockResolvedValueOnce([{ menuId: 1001 }])
      .mockResolvedValueOnce([{ postId: 5 }])
      .mockResolvedValueOnce([{ menuId: 1002 }])
      .mockResolvedValueOnce([
        { orgId: 100, ancestors: '0' },
        { orgId: 101, ancestors: '0,100' },
      ])
      .mockResolvedValueOnce([{ menuId: 1001 }, { menuId: 1003 }])
      .mockResolvedValueOnce([{ menuId: 1003 }, { menuId: 1004 }]);

    const sources = await getPermissionSources(7);

    expect(sources.roles).toEqual([
      { roleId: 2, roleName: '运营', roleKey: 'operator', dataScope: '3', menuIds: [1001] },
    ]);
    expect(sources.postIds).toEqual([5]);
    expect(sources.postMenuIds).toEqual([1002]);
    expect(sources.orgMenuIds).toEqual([1001, 1003, 1004]);
    expect(db.query).toHaveBeenCalledTimes(7);
  });
});
