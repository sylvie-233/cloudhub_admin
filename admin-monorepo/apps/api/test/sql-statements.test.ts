import { describe, expect, it } from 'vitest';

import { buildLogFilter, selectLogininforsPage } from '../src/sql/log.sql.js';
import { buildOrgUserFilter, selectOrgUsersPage } from '../src/sql/org.sql.js';
import { selectPostHeadcountsByIds } from '../src/sql/post.sql.js';
import { selectRoleMenuCount } from '../src/sql/role.sql.js';
import { selectScopeDescendantOrgIds, selectUserMenus } from '../src/sql/permission.sql.js';
import { buildUserListFilter, selectPostsByUserIds } from '../src/sql/user.sql.js';

describe('SQL 筛选构造器', () => {
  it('用户列表无筛选时只保留软删除条件', () => {
    const filter = buildUserListFilter({
      orgFilterIds: null,
      scopeMode: 'all',
      currentUserId: 1,
    });

    expect(filter.sql).toBe(`u.del_flag = '0'`);
    expect(filter.params).toEqual([]);
  });

  it('用户列表关键字转义 LIKE 通配符并保持参数顺序', () => {
    const filter = buildUserListFilter({
      keyword: 'a%b_c\\d',
      status: '0',
      orgFilterIds: [2, 3],
      scopeMode: 'self',
      currentUserId: 9,
    });

    const escaped = `%a\\%b\\_c\\\\d%`;
    expect(filter.params).toEqual([escaped, escaped, escaped, '0', 9, 2, 3]);
    expect(filter.sql).toContain('EXISTS');
    expect(filter.sql).toContain('p.org_id IN (?, ?)');
  });

  it('登录日志筛选器支持关键字、状态、天数与时间范围', () => {
    const filter = buildLogFilter({
      keyword: 'admin',
      status: '1',
      days: 7,
      startTime: '2026-01-01',
      endTime: '2026-12-31',
    });

    expect(filter.params).toEqual([
      '%admin%',
      '%admin%',
      '%admin%',
      '%admin%',
      '%admin%',
      '%admin%',
      '%admin%',
      '1',
      7,
      '2026-01-01',
      '2026-12-31 23:59:59',
    ]);
  });

  it('登录日志结束时间已含时分秒时保持原值', () => {
    const filter = buildLogFilter({ endTime: '2026-12-31 18:30:00' });

    expect(filter.params).toEqual(['2026-12-31 18:30:00']);
  });

  it('组织在岗用户筛选器覆盖组织、岗位、关键字与本人范围', () => {
    const filter = buildOrgUserFilter({
      orgIds: [10, 11],
      postId: 3,
      keyword: 'k',
      scopeMode: 'self',
      currentUserId: 5,
    });

    expect(filter.params).toEqual([10, 11, 3, '%k%', '%k%', '%k%', 5]);
    expect(filter.sql).toContain('p.org_id IN (?, ?)');
    expect(filter.sql).toContain('up.post_id = ?');
    expect(filter.sql).toContain('u.user_id = ?');
  });

  it('分页语句把 pageSize / offset 追加到参数末尾', () => {
    const filter = buildLogFilter({ status: '0' });
    const stmt = selectLogininforsPage(filter, 8, 16);

    expect(stmt.params).toEqual(['0', 8, 16]);
    expect(stmt.sql).toContain('LIMIT ? OFFSET ?');
  });

  it('组织在岗用户分页语句复用同一组筛选参数', () => {
    const filter = buildOrgUserFilter({
      orgIds: [10],
      scopeMode: 'all',
      currentUserId: 1,
    });
    const stmt = selectOrgUsersPage(filter, 20, 0);

    expect(stmt.params).toEqual([10, 20, 0]);
    expect(stmt.sql).toContain('SELECT DISTINCT');
  });
});

describe('SQL 语句参数拼装', () => {
  it('本组织及以下的组织范围把自身与祖级匹配参数各传一遍', () => {
    const stmt = selectScopeDescendantOrgIds([100, 101]);

    expect(stmt.sql).toContain('FIND_IN_SET(?, ancestors) OR FIND_IN_SET(?, ancestors)');
    expect(stmt.params).toEqual([100, 101, 100, 101]);
  });

  it('批量用户岗位支持可选的组织过滤', () => {
    const noOrg = selectPostsByUserIds([1, 2]);
    const withOrg = selectPostsByUserIds([1, 2], [3]);

    expect(noOrg.params).toEqual([1, 2]);
    expect(withOrg.params).toEqual([1, 2, 3]);
    expect(withOrg.sql).toContain('p.org_id IN (?)');
  });

  it('批量岗位人数按 ID 生成对应数量的占位符', () => {
    const stmt = selectPostHeadcountsByIds([4, 5, 6]);

    expect(stmt.params).toEqual([4, 5, 6]);
    expect(stmt.sql).toContain('IN (?, ?, ?)');
  });

  it('超级管理员的菜单数量按全量菜单统计', () => {
    const adminStmt = selectRoleMenuCount(1);
    const roleStmt = selectRoleMenuCount(2);

    expect(adminStmt.params).toEqual([]);
    expect(adminStmt.sql).toContain('FROM sys_menu');
    expect(roleStmt.params).toEqual([2]);
    expect(roleStmt.sql).toContain('sys_role_menu');
  });

  it('用户菜单语句只取启用的目录与菜单', () => {
    const stmt = selectUserMenus(5);

    expect(stmt.params).toEqual([5]);
    expect(stmt.sql).toContain(`m.status = '0'`);
    expect(stmt.sql).toContain(`m.menu_type IN ('M', 'C')`);
  });
});
