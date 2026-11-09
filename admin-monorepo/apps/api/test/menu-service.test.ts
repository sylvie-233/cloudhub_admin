import type { CreateMenuInput } from '@cloudhub/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/db/index.js', async () => {
  const { createDbMockModule } = await import('./helpers.js');
  return createDbMockModule();
});

import { dbClient, executeOn } from '../src/db/index.js';
import { createMenu } from '../src/services/menu.service.js';
import type { MenuDbRow } from '../src/sql/menu.sql.js';
import { asDbMock } from './helpers.js';

const db = asDbMock(dbClient);
const executeOnMock = vi.mocked(executeOn);

function menuInput(overrides: Partial<CreateMenuInput> = {}): CreateMenuInput {
  return {
    menuName: '测试菜单',
    menuType: 'C',
    path: 'users',
    component: 'views/UserView.vue',
    ...overrides,
  };
}

type ExecuteResult = Awaited<ReturnType<typeof executeOn>>;

function resultHeader(insertId = 0): ExecuteResult {
  return {
    constructor: { name: 'ResultSetHeader' },
    affectedRows: 1,
    changedRows: 0,
    fieldCount: 0,
    info: '',
    insertId,
    serverStatus: 2,
    warningStatus: 0,
  } as unknown as ExecuteResult;
}

beforeEach(() => {
  db.query.mockReset();
  db.queryOne.mockReset();
  db.execute.mockReset();
  db.transaction.mockReset();
  executeOnMock.mockReset();
});

describe('菜单路由字段校验', () => {
  it('C 菜单缺少路由地址时拒绝', async () => {
    await expect(createMenu(menuInput({ path: '' }), 'admin')).rejects.toThrow(
      '必须填写路由地址',
    );
  });

  it('C 菜单缺少组件路径时拒绝', async () => {
    await expect(createMenu(menuInput({ component: null }), 'admin')).rejects.toThrow(
      '必须填写组件路径',
    );
  });

  it('路由地址不能占用内置页面', async () => {
    await expect(createMenu(menuInput({ path: '/dashboard/' }), 'admin')).rejects.toThrow(
      '内置静态页面',
    );
  });

  it('路由地址重复时返回冲突菜单名称', async () => {
    db.queryOne.mockResolvedValueOnce({ menuId: 1001, menuName: '用户管理' });

    await expect(createMenu(menuInput(), 'admin')).rejects.toThrow(
      '已被菜单「用户管理」占用',
    );
  });

  it('目录类型自动清空路由字段', async () => {
    db.transaction.mockImplementationOnce(
      async (callback: (conn: unknown) => Promise<number>) => callback({}),
    );
    executeOnMock
      .mockResolvedValueOnce(resultHeader(2000))
      .mockResolvedValueOnce(resultHeader());
    const inserted: MenuDbRow = {
      menuId: 2000,
      menuName: '测试菜单',
      parentId: 0,
      orderNum: 0,
      path: '',
      component: null,
      menuType: 'M',
      status: '0',
      perms: null,
      icon: '',
      createBy: 'admin',
      createTime: '2026-11-09 00:00:00',
      updateBy: '',
      updateTime: null,
    };
    db.queryOne.mockResolvedValueOnce(inserted);

    const menu = await createMenu(
      menuInput({ menuType: 'M', path: 'system', component: 'views/UserView.vue' }),
      'admin',
    );

    expect(menu.path).toBe('');
    expect(menu.component).toBeNull();
    const insertParams = executeOnMock.mock.calls[0]?.[2] as unknown[];
    expect(insertParams[3]).toBe('');
    expect(insertParams[4]).toBeNull();
    const updateParams = executeOnMock.mock.calls[1]?.[2] as unknown[];
    expect(updateParams).toEqual([2000]);
  });

  it('C 菜单组件路径统一规范化为 views/ 开头、.vue 结尾', async () => {
    db.queryOne.mockResolvedValueOnce(null);
    db.transaction.mockImplementationOnce(
      async (callback: (conn: unknown) => Promise<number>) => callback({}),
    );
    executeOnMock
      .mockResolvedValueOnce(resultHeader(2001))
      .mockResolvedValueOnce(resultHeader());
    db.queryOne.mockResolvedValueOnce({
      menuId: 2001,
      menuName: '测试菜单',
      parentId: 0,
      orderNum: 0,
      path: 'users',
      component: 'views/UserView.vue',
      menuType: 'C',
      status: '0',
      perms: 'system:user:list',
      icon: '',
      createBy: 'admin',
      createTime: '2026-11-09 00:00:00',
      updateBy: '',
      updateTime: null,
    } satisfies MenuDbRow);

    const menu = await createMenu(
      menuInput({ path: '/users/', component: 'UserView' }),
      'admin',
    );

    expect(menu.path).toBe('users');
    expect(menu.component).toBe('views/UserView.vue');
    const insertParams = executeOnMock.mock.calls[0]?.[2] as unknown[];
    expect(insertParams[3]).toBe('users');
    expect(insertParams[4]).toBe('views/UserView.vue');
  });
});
