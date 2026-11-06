import { z } from 'zod';

import { idSchema, statusSchema } from './common.js';

export const orgQuerySchema = z.object({
  keyword: z.string().trim().max(50).optional(),
  status: statusSchema.optional(),
});

export const createOrgSchema = z.object({
  parentId: z.coerce.number().int().min(0, '上级组织不能为负数').default(0),
  orgName: z.string().trim().min(1, '请输入组织名称').max(100, '组织名称不能超过 100 位'),
  orgCode: z.string().trim().max(64, '组织编码不能超过 64 位').optional(),
  orderNum: z.coerce.number().int().min(0).optional(),
  status: statusSchema.optional(),
});

export const updateOrgSchema = z.object({
  parentId: z.coerce.number().int().min(0).optional(),
  orgName: z.string().trim().min(1, '组织名称不能为空').max(100).optional(),
  orgCode: z.string().trim().min(1, '组织编码不能为空').max(64).optional(),
  orderNum: z.coerce.number().int().min(0).optional(),
  status: statusSchema.optional(),
});

export const setLeaderSchema = z.object({
  postId: z.union([idSchema, z.null()]),
});

export const orgUserQuerySchema = z.object({
  keyword: z.string().trim().max(50).optional(),
  postId: idSchema.optional(),
  includeSub: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value !== 'false'),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

export type CreateOrgBody = z.infer<typeof createOrgSchema>;
export type UpdateOrgBody = z.infer<typeof updateOrgSchema>;
export type OrgUserQuery = z.infer<typeof orgUserQuerySchema>;
