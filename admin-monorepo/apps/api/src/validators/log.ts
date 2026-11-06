import { z } from 'zod';

import { datetimeSchema, idSchema, pageSchema, statusSchema } from './common.js';

export const logininforQuerySchema = z.object({
  ...pageSchema,
  keyword: z.string().trim().max(100).optional(),
  status: statusSchema.optional(),
  days: z.coerce.number().int().min(1).max(365).optional(),
  startTime: datetimeSchema.optional(),
  endTime: datetimeSchema.optional(),
});

export const deleteLogsSchema = z.object({
  ids: z.array(idSchema).min(1, '请选择要删除的日志').max(500, '单次最多删除 500 条'),
});

export type LogininforQuery = z.infer<typeof logininforQuerySchema>;
