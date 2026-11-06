import { z } from 'zod';

export const statusSchema = z.enum(['0', '1']);
export const delFlagSchema = z.enum(['0', '2']);
export const sexSchema = z.enum(['0', '1', '2']);
export const menuTypeSchema = z.enum(['M', 'C', 'F']);
export const dataScopeSchema = z.enum(['1', '2', '3', '4', '5']);

export const pageSchema = {
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
};

export const pageQuerySchema = z.object(pageSchema);

/** 查询参数中的布尔值仅接受 true / false。 */
export const includeSubSchema = z
  .enum(['true', 'false'])
  .optional()
  .transform((value) => value !== 'false');

export const datetimeSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}(?: \d{2}:\d{2}:\d{2})?$/, '时间格式应为 YYYY-MM-DD 或 YYYY-MM-DD HH:mm:ss');

export const idSchema = z.coerce.number().int().positive();

export const idArraySchema = z.array(idSchema);
