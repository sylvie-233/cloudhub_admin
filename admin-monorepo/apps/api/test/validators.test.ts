import { describe, expect, it } from 'vitest';
import type { ZodType } from 'zod';

import { loginSchema } from '../src/validators/auth.js';
import { logininforQuerySchema, deleteLogsSchema } from '../src/validators/log.js';
import { createMenuSchema } from '../src/validators/menu.js';
import { createOrgSchema, orgUserQuerySchema } from '../src/validators/org.js';
import { setDataScopeSchema } from '../src/validators/perm.js';
import { createRoleSchema } from '../src/validators/role.js';
import { createUserSchema, userQuerySchema } from '../src/validators/user.js';

/** 断言校验失败并返回首个错误提示，避免到处写类型收窄。 */
function firstError(schema: ZodType, value: unknown): string {
  const result = schema.safeParse(value);
  if (result.success) {
    throw new Error('预期校验失败，实际通过');
  }
  return result.error.issues[0]?.message ?? '';
}

function parse<T>(schema: ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new Error(`预期校验通过：${result.error.issues[0]?.message}`);
  }
  return result.data;
}

describe('登录入参', () => {
  it('去除账号首尾空格并按需转换岗位 ID', () => {
    const data = parse(loginSchema, {
      userName: '  admin  ',
      password: 'admin123',
      postId: '3',
    });

    expect(data.userName).toBe('admin');
    expect(data.postId).toBe(3);
  });

  it('账号为空时校验失败', () => {
    expect(firstError(loginSchema, { userName: '   ', password: 'admin123' })).toBe(
      '请输入登录账号',
    );
  });
});

describe('用户入参', () => {
  it('新增用户的账号与岗位为必填', () => {
    expect(
      firstError(createUserSchema, {
        userName: '1abc',
        nickName: '测试',
        postIds: [1],
      }),
    ).toContain('账号需以字母开头');

    expect(
      firstError(createUserSchema, {
        userName: 'tester',
        nickName: '测试',
        postIds: [],
      }),
    ).toBe('请至少选择一个任职岗位');
  });

  it('邮箱与手机号允许为空但填写时必须符合格式', () => {
    const valid = parse(createUserSchema, {
      userName: 'tester',
      nickName: '测试',
      postIds: [1],
      email: '',
      phonenumber: '',
    });
    expect(valid.email).toBe('');
    expect(valid.phonenumber).toBe('');

    expect(
      firstError(createUserSchema, {
        userName: 'tester',
        nickName: '测试',
        postIds: [1],
        email: 'not-an-email',
      }),
    ).toBe('邮箱格式不正确');

    expect(
      firstError(createUserSchema, {
        userName: 'tester',
        nickName: '测试',
        postIds: [1],
        phonenumber: '21234567890',
      }),
    ).toBe('手机号格式不正确');
  });

  it('分页参数转换为数字并限制上限', () => {
    const data = parse(userQuerySchema, { page: '2', pageSize: '20' });
    expect(data.page).toBe(2);
    expect(data.pageSize).toBe(20);

    expect(firstError(userQuerySchema, { pageSize: '101' })).toContain('Too big');
  });

  it('includeSub 未传时默认为 true，显式 false 时关闭', () => {
    expect(parse(userQuerySchema, {}).includeSub).toBe(true);
    expect(parse(userQuerySchema, { includeSub: 'false' }).includeSub).toBe(false);
  });
});

describe('组织入参', () => {
  it('上级组织默认根节点并去除名称空格', () => {
    const data = parse(createOrgSchema, { orgName: '  研发中心  ' });

    expect(data.parentId).toBe(0);
    expect(data.orgName).toBe('研发中心');
  });

  it('上级组织不能为负数', () => {
    expect(firstError(createOrgSchema, { parentId: '-1', orgName: '研发中心' })).toBe(
      '上级组织不能为负数',
    );
  });

  it('组织成员查询的 includeSub 转换与分页一致', () => {
    const data = parse(orgUserQuerySchema, { includeSub: 'false', page: '1' });

    expect(data.includeSub).toBe(false);
    expect(data.page).toBe(1);
    expect(firstError(orgUserQuerySchema, { pageSize: '0' })).toContain('Too small');
  });
});

describe('日志入参', () => {
  it('接受日期或完整时间格式', () => {
    expect(parse(logininforQuerySchema, { startTime: '2026-11-09' }).startTime).toBe(
      '2026-11-09',
    );
    expect(
      parse(logininforQuerySchema, { startTime: '2026-11-09 08:30:00' }).startTime,
    ).toBe('2026-11-09 08:30:00');
  });

  it('拒绝非约定格式的时间', () => {
    expect(firstError(logininforQuerySchema, { startTime: '2026/11/09' })).toBe(
      '时间格式应为 YYYY-MM-DD 或 YYYY-MM-DD HH:mm:ss',
    );
  });

  it('天数范围限制在 1 到 365', () => {
    expect(firstError(logininforQuerySchema, { days: '0' })).toContain('Too small');
    expect(firstError(logininforQuerySchema, { days: '366' })).toContain('Too big');
  });

  it('删除日志需提供 1 到 500 个 ID', () => {
    expect(firstError(deleteLogsSchema, { ids: [] })).toBe('请选择要删除的日志');
    expect(firstError(deleteLogsSchema, { ids: [0] })).toContain('Too small');
    const tooMany = Array.from({ length: 501 }, (_, index) => index + 1);
    expect(firstError(deleteLogsSchema, { ids: tooMany })).toBe('单次最多删除 500 条');
  });
});

describe('角色、菜单与权限入参', () => {
  it('权限字符必须以字母开头且只允许约定字符', () => {
    const valid = parse(createRoleSchema, {
      roleName: '研发主管',
      roleKey: 'research:lead',
    });
    expect(valid.roleKey).toBe('research:lead');

    expect(
      firstError(createRoleSchema, { roleName: '研发主管', roleKey: '1research' }),
    ).toContain('权限字符需以字母开头');
  });

  it('数据范围只接受枚举值', () => {
    expect(firstError(createRoleSchema, {
      roleName: '研发主管',
      roleKey: 'research',
      dataScope: '6',
    })).toContain('Invalid');
  });

  it('菜单类型只接受 M / C / F', () => {
    expect(
      firstError(createMenuSchema, { menuName: '用户管理', menuType: 'X' }),
    ).toContain('Invalid');
  });

  it('数据范围设置允许空组织列表但校验组织 ID', () => {
    const data = parse(setDataScopeSchema, { dataScope: '2', orgIds: [] });
    expect(data.orgIds).toEqual([]);

    expect(firstError(setDataScopeSchema, { dataScope: '9' })).toContain('Invalid');
  });
});
