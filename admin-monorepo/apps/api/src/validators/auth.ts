import { z } from 'zod';

import { idSchema } from './common.js';

export const loginSchema = z.object({
  userName: z.string().trim().min(1, '请输入登录账号').max(50, '账号长度不能超过 50 位'),
  password: z.string().min(1, '请输入密码').max(100, '密码长度不能超过 100 位'),
  postId: idSchema.optional(),
});

export type LoginBody = z.infer<typeof loginSchema>;
