import { z } from 'zod';

import { dataScopeSchema, idArraySchema, statusSchema } from './common.js';

const roleKeySchema = z
  .string()
  .trim()
  .min(1, '请输入权限字符')
  .max(100, '权限字符不能超过 100 位')
  .regex(/^[a-zA-Z][a-zA-Z0-9:_-]*$/, '权限字符需以字母开头，只能包含字母、数字、冒号、下划线和短横线');

const remarkSchema = z.string().trim().max(500, '备注不能超过 500 位').nullable();

export const roleQuerySchema = z.object({
  keyword: z.string().trim().max(50).optional(),
  status: statusSchema.optional(),
});

export const createRoleSchema = z.object({
  roleName: z.string().trim().min(1, '请输入角色名称').max(30, '角色名称不能超过 30 位'),
  roleKey: roleKeySchema,
  roleSort: z.coerce.number().int().min(0).optional(),
  dataScope: dataScopeSchema.optional(),
  status: statusSchema.optional(),
  remark: remarkSchema.optional(),
});

export const updateRoleSchema = z.object({
  roleName: z.string().trim().min(1, '角色名称不能为空').max(30).optional(),
  roleKey: roleKeySchema.optional(),
  roleSort: z.coerce.number().int().min(0).optional(),
  dataScope: dataScopeSchema.optional(),
  status: statusSchema.optional(),
  remark: remarkSchema.optional(),
});

export const assignRoleUsersSchema = z.object({
  userIds: idArraySchema,
});

export type CreateRoleBody = z.infer<typeof createRoleSchema>;
export type UpdateRoleBody = z.infer<typeof updateRoleSchema>;
