import { z } from 'zod';

import { idSchema, statusSchema } from './common.js';

export const postQuerySchema = z.object({
  orgId: idSchema,
});

export const createPostSchema = z.object({
  orgId: idSchema,
  parentId: z.coerce.number().int().min(0).optional(),
  postName: z.string().trim().min(1, '请输入岗位名称').max(64, '岗位名称不能超过 64 位'),
  postCode: z.string().trim().max(64, '岗位编码不能超过 64 位').optional(),
  postSort: z.coerce.number().int().min(0).optional(),
  status: statusSchema.optional(),
  isLeader: z.boolean().optional(),
});

export const updatePostSchema = z.object({
  orgId: idSchema.optional(),
  parentId: z.coerce.number().int().min(0).optional(),
  postName: z.string().trim().min(1, '岗位名称不能为空').max(64).optional(),
  postCode: z.string().trim().min(1, '岗位编码不能为空').max(64).optional(),
  postSort: z.coerce.number().int().min(0).optional(),
  status: statusSchema.optional(),
  isLeader: z.boolean().optional(),
});

export type CreatePostBody = z.infer<typeof createPostSchema>;
export type UpdatePostBody = z.infer<typeof updatePostSchema>;
