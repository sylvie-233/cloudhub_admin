import { z } from 'zod';

import { menuTypeSchema, statusSchema } from './common.js';

const pathSchema = z.string().trim().max(200, '路由地址不能超过 200 位');
const componentSchema = z.string().trim().max(255, '组件路径不能超过 255 位').nullable();
const permsSchema = z.string().trim().max(100, '权限标识不能超过 100 位').nullable();
const iconSchema = z.string().trim().max(100, '图标标识不能超过 100 位');

export const menuQuerySchema = z.object({
  keyword: z.string().trim().max(50).optional(),
  menuType: menuTypeSchema.optional(),
  status: statusSchema.optional(),
});

export const createMenuSchema = z.object({
  menuName: z.string().trim().min(1, '请输入菜单名称').max(50, '菜单名称不能超过 50 位'),
  parentId: z.coerce.number().int().min(0).optional(),
  orderNum: z.coerce.number().int().min(0).optional(),
  path: pathSchema.optional(),
  component: componentSchema.optional(),
  menuType: menuTypeSchema,
  status: statusSchema.optional(),
  perms: permsSchema.optional(),
  icon: iconSchema.optional(),
});

export const updateMenuSchema = z.object({
  menuName: z.string().trim().min(1, '菜单名称不能为空').max(50).optional(),
  parentId: z.coerce.number().int().min(0).optional(),
  orderNum: z.coerce.number().int().min(0).optional(),
  path: pathSchema.optional(),
  component: componentSchema.optional(),
  menuType: menuTypeSchema.optional(),
  status: statusSchema.optional(),
  perms: permsSchema.optional(),
  icon: iconSchema.optional(),
});

export type CreateMenuBody = z.infer<typeof createMenuSchema>;
export type UpdateMenuBody = z.infer<typeof updateMenuSchema>;
