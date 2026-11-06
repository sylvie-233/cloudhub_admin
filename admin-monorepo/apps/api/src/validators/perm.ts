import { z } from 'zod';

import { dataScopeSchema, idSchema } from './common.js';

export const saveMenusSchema = z.object({
  menuIds: z.array(idSchema),
});

export const setDataScopeSchema = z.object({
  dataScope: dataScopeSchema,
  orgIds: z.array(idSchema).optional(),
});

export type SaveMenusBody = z.infer<typeof saveMenusSchema>;
export type SetDataScopeBody = z.infer<typeof setDataScopeSchema>;
