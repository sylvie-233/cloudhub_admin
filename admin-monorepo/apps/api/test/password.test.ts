import { describe, expect, it } from 'vitest';

import { DEFAULT_PASSWORD, hashPassword, verifyPassword } from '../src/utils/password.js';

describe('密码工具', () => {
  it('默认密码为 admin123', () => {
    expect(DEFAULT_PASSWORD).toBe('admin123');
  });

  it('哈希结果不可逆且带 bcrypt 标识', async () => {
    const hashed = await hashPassword(DEFAULT_PASSWORD);

    expect(hashed).not.toBe(DEFAULT_PASSWORD);
    expect(hashed.startsWith('$2')).toBe(true);
    expect(hashed.length).toBeGreaterThan(50);
  });

  it('正确密码校验通过，错误密码校验失败', async () => {
    const hashed = await hashPassword('secret-pass');

    await expect(verifyPassword('secret-pass', hashed)).resolves.toBe(true);
    await expect(verifyPassword('secret-pass-wrong', hashed)).resolves.toBe(false);
  });

  it('空哈希直接判定失败', async () => {
    await expect(verifyPassword('admin123', '')).resolves.toBe(false);
  });
});
