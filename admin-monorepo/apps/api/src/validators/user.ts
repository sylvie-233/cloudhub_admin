import { z } from 'zod';

import { idArraySchema, idSchema, includeSubSchema, pageSchema, sexSchema, statusSchema } from './common.js';

const emailSchema = z
  .string()
  .trim()
  .max(50, '邮箱长度不能超过 50 位')
  .refine((value) => value === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), '邮箱格式不正确');

const phoneSchema = z
  .string()
  .trim()
  .refine((value) => value === '' || /^1\d{10}$/.test(value), '手机号格式不正确');

const passwordSchema = z.string().min(6, '密码至少 6 位').max(32, '密码不能超过 32 位');

export const userQuerySchema = z.object({
  ...pageSchema,
  keyword: z.string().trim().max(50).optional(),
  orgId: idSchema.optional(),
  includeSub: includeSubSchema,
  status: statusSchema.optional(),
});

export const createUserSchema = z.object({
  userName: z
    .string()
    .trim()
    .min(2, '账号至少 2 位')
    .max(30, '账号不能超过 30 位')
    .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, '账号需以字母开头，只能包含字母、数字和下划线'),
  nickName: z.string().trim().min(1, '请输入用户昵称').max(30, '昵称不能超过 30 位'),
  password: passwordSchema.optional(),
  email: emailSchema.optional(),
  phonenumber: phoneSchema.optional(),
  sex: sexSchema.optional(),
  status: statusSchema.optional(),
  postIds: z.array(idSchema).min(1, '请至少选择一个任职岗位'),
  roleIds: idArraySchema.optional(),
});

export const updateUserSchema = z.object({
  nickName: z.string().trim().min(1, '昵称不能为空').max(30).optional(),
  email: emailSchema.optional(),
  phonenumber: phoneSchema.optional(),
  sex: sexSchema.optional(),
  status: statusSchema.optional(),
  postIds: z.array(idSchema).min(1, '请至少保留一个任职岗位').optional(),
  roleIds: idArraySchema.optional(),
});

export const resetPasswordSchema = z.object({
  password: passwordSchema,
});

export const assignRolesSchema = z.object({
  roleIds: idArraySchema,
});

export type UserQueryBody = z.infer<typeof userQuerySchema>;
export type CreateUserBody = z.infer<typeof createUserSchema>;
export type UpdateUserBody = z.infer<typeof updateUserSchema>;
